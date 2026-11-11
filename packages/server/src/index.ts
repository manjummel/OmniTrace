import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import {
  CallGraphBuilder,
  FileWatcher,
  AgentCoordinator,
  PatchManager,
  type PolicyConfig,
  type Finding
} from '@blast-radius/core';

export interface ServerOptions {
  port?: number;
  projectRoot?: string;
  policy?: Partial<PolicyConfig>;
}

export class BlastRadiusServer {
  private app: express.Express;
  private httpServer: any;
  private wss: WebSocketServer;
  private builder: CallGraphBuilder;
  private watcher: FileWatcher;
  private coordinator: AgentCoordinator;
  private patchManager: PatchManager;
  private projectRoot: string;
  private policy: PolicyConfig;
  private activeFindings: Finding[] = [];
  private clients: Set<WebSocket> = new Set();

  constructor(options: ServerOptions = {}) {
    const port = options.port || 4567;
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());

    this.policy = {
      blockOnCritical: true,
      quarantineScopeViolations: true,
      failOnHardcodedSecrets: true,
      failOnDeletedTests: true,
      maxAllowedImpactScore: 80,
      allowedModificationPaths: [],
      ignoredPaths: ['**/node_modules/**', '**/dist/**'],
      ...options.policy
    };

    this.builder = new CallGraphBuilder(this.projectRoot);
    this.coordinator = new AgentCoordinator(
      this.builder.getParser().getProject(),
      this.builder.getGraph()
    );
    this.patchManager = new PatchManager();
    this.watcher = new FileWatcher(this.builder, this.projectRoot);

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.httpServer = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupRoutes();
    this.setupWebSocket();
    this.setupWatcher();
  }

  private setupRoutes(): void {
    // 1. Graph State
    this.app.get('/api/graph', async (req, res) => {
      let data = this.builder.getGraph().toJSON();
      if (data.nodes.length === 0) {
        data = await this.builder.buildInitialGraph();
      }
      res.json(data);
    });

    // 2. Findings
    this.app.get('/api/findings', (req, res) => {
      const result = this.coordinator.analyzeProject();
      this.activeFindings = result.findings.filter(
        (f) => !this.patchManager.isDismissed(f.id)
      );
      res.json({
        findings: this.activeFindings,
        summary: result.summary
      });
    });

    // 3. Dismiss Finding
    this.app.post('/api/findings/:id/dismiss', (req, res) => {
      const id = req.params.id;
      const reason = req.body?.reason || 'Dismissed by developer';
      this.patchManager.dismissFinding(id, reason);

      this.activeFindings = this.activeFindings.filter((f) => f.id !== id);
      this.broadcast('finding:dismissed', { id, reason });
      res.json({ success: true, id, reason });
    });

    // 4. Fix Finding
    this.app.post('/api/findings/:id/fix', (req, res) => {
      const id = req.params.id;
      const apply = Boolean(req.body?.apply);

      const finding = this.activeFindings.find((f) => f.id === id);
      if (!finding) {
        return res.status(404).json({ error: `Finding '${id}' not found.` });
      }

      const patch = this.patchManager.generateFix(finding);
      if (!patch) {
        return res.status(400).json({ error: 'Could not generate automated patch.' });
      }

      if (apply) {
        const result = this.patchManager.applyPatch(patch);
        if (result.success) {
          // Re-index file
          this.builder.updateFile(patch.filePath);
          this.activeFindings = this.activeFindings.filter((f) => f.id !== id);
          this.broadcast('finding:fixed', { id, rollbackId: result.rollbackId });
          return res.json({ success: true, rollbackId: result.rollbackId });
        } else {
          return res.status(500).json({ error: result.error });
        }
      }

      res.json({ patch });
    });

    // 5. Rollback Patch
    this.app.post('/api/rollback/:rollbackId', (req, res) => {
      const rollbackId = req.params.rollbackId;
      const ok = this.patchManager.rollback(rollbackId);
      res.json({ success: ok });
    });

    // 6. Impact Report for Symbol/Node
    this.app.get('/api/impact/:nodeId', (req, res) => {
      const nodeId = decodeURIComponent(req.params.nodeId);
      const report = this.builder.generateBlastRadiusReport(nodeId);
      if (!report) {
        return res.status(404).json({ error: 'Node not found in graph' });
      }
      res.json(report);
    });

    // 7. Hotspots
    this.app.get('/api/hotspots', (req, res) => {
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const hotspots = this.builder.getGraph().getHotspots(limit);
      res.json(hotspots);
    });

    // 8. Pre-edit Hook Interception Endpoint
    this.app.post('/api/inspect-diff', (req, res) => {
      const inspectionReq = req.body;
      const response = this.coordinator.inspectProposedChange(inspectionReq, this.policy);
      res.json(response);
    });

    // 9. System Status & Config
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'ONLINE',
        projectRoot: this.projectRoot,
        totalNodes: this.builder.getGraph().getAllNodes().length,
        totalEdges: this.builder.getGraph().getAllEdges().length,
        policy: this.policy,
        firebaseSyncEnabled: Boolean(process.env.FIREBASE_PROJECT_ID)
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      // Send initial hello
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now()
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  private broadcast(type: string, payload: any): void {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private setupWatcher(): void {
    this.watcher.onUpdate((graphData, event, filePath) => {
      this.broadcast('graph:updated', { event, filePath, summary: graphData.summary });

      // Re-run agents on updated file
      const sourceFile = this.builder.getParser().getProject().getSourceFile(filePath);
      if (sourceFile) {
        const fileFindings = this.coordinator.analyzeFile(sourceFile);
        if (fileFindings.length > 0) {
          this.broadcast('findings:detected', { filePath, findings: fileFindings });
        }
      }
    });

    this.watcher.start();
  }

  public async start(port?: number): Promise<number> {
    const p = port || 4567;
    await this.builder.buildInitialGraph();
    return new Promise((resolve) => {
      this.httpServer.listen(p, () => {
        resolve(p);
      });
    });
  }

  public async stop(): Promise<void> {
    await this.watcher.stop();
    this.wss.close();
    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const server = new BlastRadiusServer();
  const port = parseInt(process.env.PORT || '4567', 10);
  server.start(port).then((p) => {
    console.log(`[Blast Radius Live Server] Running on http://localhost:${p}`);
  });
}

