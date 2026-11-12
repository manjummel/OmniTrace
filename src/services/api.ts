import type { ProjectGraphData, Finding, Hotspot, BlastRadiusReport } from '@blast-radius/core';
import { DEMO_GRAPH_DATA, DEMO_FINDINGS, DEMO_HOTSPOTS } from './demoData';

const SERVER_BASE_URL = 'http://localhost:4567';

export class ApiService {
  private isDemoMode: boolean = false;

  constructor() {
    this.isDemoMode = localStorage.getItem('blast_radius_demo_mode') === 'true';
  }

  public getIsDemoMode(): boolean {
    return this.isDemoMode;
  }

  public setIsDemoMode(enabled: boolean): void {
    this.isDemoMode = enabled;
    localStorage.setItem('blast_radius_demo_mode', String(enabled));
  }

  public async getGraph(): Promise<ProjectGraphData> {
    if (this.isDemoMode) {
      return DEMO_GRAPH_DATA;
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/graph`);
      if (!res.ok) throw new Error('Failed to fetch live graph');
      return await res.json();
    } catch {
      // Fallback to demo mode if server is not reachable
      return DEMO_GRAPH_DATA;
    }
  }

  public async getFindings(): Promise<{ findings: Finding[]; summary: any }> {
    if (this.isDemoMode) {
      return {
        findings: DEMO_FINDINGS,
        summary: {
          totalFindings: DEMO_FINDINGS.length,
          criticalCount: DEMO_FINDINGS.filter((f) => f.severity === 'CRITICAL').length,
          highCount: DEMO_FINDINGS.filter((f) => f.severity === 'HIGH').length,
          mediumCount: 0,
          lowCount: 0,
          byAgent: {
            'Reality Check': 1,
            'Hardcode Hunter': 1,
            'Test Guardian': 1,
            'Scope Guard': 1,
            'Impact Analyst': 1
          }
        }
      };
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/findings`);
      if (!res.ok) throw new Error('Failed to fetch findings');
      return await res.json();
    } catch {
      return {
        findings: DEMO_FINDINGS,
        summary: {
          totalFindings: DEMO_FINDINGS.length,
          criticalCount: 4,
          highCount: 1,
          mediumCount: 0,
          lowCount: 0,
          byAgent: {}
        }
      };
    }
  }

  public async getHotspots(): Promise<Hotspot[]> {
    if (this.isDemoMode) {
      return DEMO_HOTSPOTS;
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/hotspots`);
      if (!res.ok) throw new Error('Failed to fetch hotspots');
      return await res.json();
    } catch {
      return DEMO_HOTSPOTS;
    }
  }

  public async getImpactReport(nodeId: string): Promise<BlastRadiusReport | null> {
    if (this.isDemoMode) {
      const node = DEMO_GRAPH_DATA.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      return {
        targetNodeId: node.id,
        targetLabel: node.label,
        targetFile: node.filePath,
        score: node.metrics.blastRadiusScore,
        riskTier: node.metrics.riskTier,
        breakdown: {
          directCallersCount: node.metrics.incomingCallsCount,
          directCallersPoints: node.metrics.incomingCallsCount * 8,
          transitiveCallersCount: node.metrics.transitiveImpactCount,
          transitiveCallersPoints: node.metrics.transitiveImpactCount * 3,
          maxDependencyDepth: 3,
          depthPoints: 15,
          isPublicExport: node.isExported,
          publicExportPoints: node.isExported ? 20 : 0,
          affectedTestsCount: 1,
          uncertainEdgesCount: 0,
          uncertainPoints: 0,
          totalScore: node.metrics.blastRadiusScore
        },
        directCallers: DEMO_GRAPH_DATA.nodes.filter((n) => n.id !== node.id).slice(0, 3),
        transitiveCallers: DEMO_GRAPH_DATA.nodes.filter((n) => n.id !== node.id).slice(3, 6),
        affectedFiles: [node.filePath, 'src/services/payment.ts', 'src/api/checkout.ts'],
        affectedTests: ['test/payment.test.ts'],
        affectedPublicAPIs: [`${node.filePath}:${node.label}`],
        executionPath: [node.id, 'file:src/services/payment.ts', 'file:src/api/checkout.ts']
      };
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/impact/${encodeURIComponent(nodeId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public async dismissFinding(findingId: string, reason: string): Promise<boolean> {
    if (this.isDemoMode) {
      const idx = DEMO_FINDINGS.findIndex((f) => f.id === findingId);
      if (idx !== -1) {
        DEMO_FINDINGS[idx].status = 'DISMISSED';
        DEMO_FINDINGS[idx].dismissalReason = reason;
      }
      return true;
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/findings/${findingId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async fixFinding(findingId: string, apply: boolean): Promise<any> {
    if (this.isDemoMode) {
      return {
        success: true,
        rollbackId: `rb_demo_${Date.now()}`,
        patch: {
          findingId,
          diffSummary: 'Demo automated fix applied successfully.',
          newContent: '// Demo corrected content\n'
        }
      };
    }
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/findings/${findingId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply })
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  }

  public async checkServerStatus(): Promise<{ online: boolean; projectRoot?: string }> {
    try {
      const res = await fetch(`${SERVER_BASE_URL}/api/status`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return { online: true, projectRoot: data.projectRoot };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  }
}

export const api = new ApiService();

