import type {
  GraphNode,
  GraphEdge,
  ProjectGraphData,
  Hotspot,
  RiskTier
} from '../types/index.js';

export class ProjectGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private callersMap: Map<string, Set<string>> = new Map(); // targetId -> Set of sourceIds
  private calleesMap: Map<string, Set<string>> = new Map(); // sourceId -> Set of targetIds
  private lastUpdated: number = Date.now();

  constructor() {}

  public clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.callersMap.clear();
    this.calleesMap.clear();
    this.lastUpdated = Date.now();
  }

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.callersMap.has(node.id)) {
      this.callersMap.set(node.id, new Set());
    }
    if (!this.calleesMap.has(node.id)) {
      this.calleesMap.set(node.id, new Set());
    }
    this.lastUpdated = Date.now();
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public addEdge(edge: GraphEdge): void {
    // Avoid duplicate edges
    const exists = this.edges.some(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        e.type === edge.type
    );
    if (!exists) {
      this.edges.push(edge);

      if (!this.callersMap.has(edge.target)) {
        this.callersMap.set(edge.target, new Set());
      }
      this.callersMap.get(edge.target)!.add(edge.source);

      if (!this.calleesMap.has(edge.source)) {
        this.calleesMap.set(edge.source, new Set());
      }
      this.calleesMap.get(edge.source)!.add(edge.target);

      this.lastUpdated = Date.now();
    }
  }

  public getAllEdges(): GraphEdge[] {
    return [...this.edges];
  }

  public removeFileNodesAndEdges(filePath: string): void {
    const nodeIdsToRemove = new Set<string>();
    for (const [id, node] of this.nodes.entries()) {
      if (node.filePath === filePath) {
        nodeIdsToRemove.add(id);
      }
    }

    for (const id of nodeIdsToRemove) {
      this.nodes.delete(id);
      this.callersMap.delete(id);
      this.calleesMap.delete(id);
    }

    // Clean up edges
    this.edges = this.edges.filter((edge) => {
      const drop =
        nodeIdsToRemove.has(edge.source) || nodeIdsToRemove.has(edge.target);
      return !drop;
    });

    // Rebuild maps
    this.rebuildAdjacencyMaps();
    this.lastUpdated = Date.now();
  }

  private rebuildAdjacencyMaps(): void {
    this.callersMap.clear();
    this.calleesMap.clear();
    for (const id of this.nodes.keys()) {
      this.callersMap.set(id, new Set());
      this.calleesMap.set(id, new Set());
    }
    for (const edge of this.edges) {
      if (this.nodes.has(edge.target) && this.nodes.has(edge.source)) {
        this.callersMap.get(edge.target)?.add(edge.source);
        this.calleesMap.get(edge.source)?.add(edge.target);
      }
    }
  }

  /**
   * Get direct callers (nodes calling or importing this target)
   */
  public getDirectCallers(nodeId: string): GraphNode[] {
    const callerIds = this.callersMap.get(nodeId) || new Set();
    const result: GraphNode[] = [];
    for (const id of callerIds) {
      const node = this.nodes.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Get direct dependencies (nodes that this node calls or imports)
   */
  public getDirectDependencies(nodeId: string): GraphNode[] {
    const calleeIds = this.calleesMap.get(nodeId) || new Set();
    const result: GraphNode[] = [];
    for (const id of calleeIds) {
      const node = this.nodes.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Traverse reverse edges (callers) recursively to compute downstream blast radius
   */
  public getDownstreamImpact(
    targetNodeId: string,
    maxDepth: number = 6
  ): { nodes: GraphNode[]; maxDepthReached: number; executionPaths: string[][] } {
    const visited = new Set<string>();
    const impacted: GraphNode[] = [];
    const executionPaths: string[][] = [];

    const queue: Array<{ id: string; depth: number; path: string[] }> = [
      { id: targetNodeId, depth: 0, path: [targetNodeId] }
    ];
    let maxDepthReached = 0;

    while (queue.length > 0) {
      const { id, depth, path } = queue.shift()!;
      if (depth > maxDepthReached) {
        maxDepthReached = depth;
      }

      const callers = this.callersMap.get(id) || new Set();
      for (const callerId of callers) {
        if (!visited.has(callerId)) {
          visited.add(callerId);
          const callerNode = this.nodes.get(callerId);
          if (callerNode) {
            impacted.push(callerNode);
          }
          if (depth + 1 <= maxDepth) {
            const nextPath = [...path, callerId];
            executionPaths.push(nextPath);
            queue.push({ id: callerId, depth: depth + 1, path: nextPath });
          }
        }
      }
    }

    return { nodes: impacted, maxDepthReached, executionPaths };
  }

  /**
   * Computes risk metrics and blast radius score for every node in the graph
   */
  public recalculateAllMetrics(): void {
    for (const node of this.nodes.values()) {
      const directCallers = this.getDirectCallers(node.id);
      const { nodes: downstream, maxDepthReached } = this.getDownstreamImpact(
        node.id,
        6
      );

      const incomingCount = directCallers.length;
      const outgoingCount = (this.calleesMap.get(node.id) || new Set()).size;
      const transitiveCount = downstream.length;

      // Transparent blast radius score formula
      let score = 0;
      score += incomingCount * 8;
      score += transitiveCount * 3;
      score += maxDepthReached * 5;
      if (node.isExported) {
        score += 20;
      }
      if (node.kind === 'file') {
        score += 10;
      }

      // Check uncertain edges
      const uncertainEdges = this.edges.filter(
        (e) => (e.source === node.id || e.target === node.id) && e.confidence === 'uncertain'
      ).length;
      score += uncertainEdges * 10;

      // Clamp to 100
      const finalScore = Math.min(100, Math.max(0, score));

      let riskTier: RiskTier = 'LOW';
      if (finalScore >= 80) riskTier = 'CRITICAL';
      else if (finalScore >= 55) riskTier = 'HIGH';
      else if (finalScore >= 25) riskTier = 'MODERATE';

      node.metrics = {
        incomingCallsCount: incomingCount,
        outgoingCallsCount: outgoingCount,
        transitiveImpactCount: transitiveCount,
        blastRadiusScore: finalScore,
        riskTier,
        hasFindings: node.metrics?.hasFindings || false
      };
    }
    this.lastUpdated = Date.now();
  }

  /**
   * Retrieves high-risk dependency hot spots in descending order
   */
  public getHotspots(limit: number = 10): Hotspot[] {
    const list: Hotspot[] = [];
    for (const node of this.nodes.values()) {
      list.push({
        nodeId: node.id,
        label: node.label,
        filePath: node.filePath,
        kind: node.kind,
        fanIn: node.metrics.incomingCallsCount,
        fanOut: node.metrics.outgoingCallsCount,
        blastRadiusScore: node.metrics.blastRadiusScore,
        activeFindingsCount: 0,
        riskTier: node.metrics.riskTier
      });
    }

    return list
      .sort((a, b) => b.blastRadiusScore - a.blastRadiusScore)
      .slice(0, limit);
  }

  public toJSON(): ProjectGraphData {
    const nodes = this.getAllNodes();
    let highestScore = 0;
    let files = 0;
    let funcs = 0;
    let classes = 0;

    for (const n of nodes) {
      if (n.metrics.blastRadiusScore > highestScore) {
        highestScore = n.metrics.blastRadiusScore;
      }
      if (n.kind === 'file') files++;
      if (n.kind === 'function') funcs++;
      if (n.kind === 'class') classes++;
    }

    return {
      nodes,
      edges: this.getAllEdges(),
      lastUpdated: this.lastUpdated,
      summary: {
        totalFiles: files,
        totalFunctions: funcs,
        totalClasses: classes,
        totalEdges: this.edges.length,
        highestImpactScore: highestScore
      }
    };
  }
}

