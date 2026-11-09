import path from 'node:path';
import fs from 'node:fs';
import { ASTParser } from './ASTParser.js';
import { ProjectGraph } from './ProjectGraph.js';
import type { ProjectGraphData, BlastRadiusReport, RiskTier, ImpactBreakdown } from '../types/index.js';

export class CallGraphBuilder {
  private parser: ASTParser;
  private graph: ProjectGraph;
  private projectRoot: string;

  constructor(projectRoot: string, tsConfigPath?: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.parser = new ASTParser(this.projectRoot, tsConfigPath);
    this.graph = new ProjectGraph();
  }

  public getGraph(): ProjectGraph {
    return this.graph;
  }

  public getParser(): ASTParser {
    return this.parser;
  }

  /**
   * Scans and builds full graph from project source files
   */
  public async buildInitialGraph(): Promise<ProjectGraphData> {
    this.graph.clear();
    const sourceFiles = this.parser.getProject().getSourceFiles();

    for (const sf of sourceFiles) {
      const parsed = this.parser.parseSourceFile(sf);
      for (const node of parsed.nodes) {
        this.graph.addNode(node);
      }
      for (const edge of parsed.edges) {
        this.graph.addEdge(edge);
      }
    }

    this.graph.recalculateAllMetrics();
    return this.graph.toJSON();
  }

  /**
   * Incremental update: Re-parses a single file and updates only affected nodes and edges
   */
  public updateFile(filePath: string, content?: string): ProjectGraphData {
    const normalizedPath = path.resolve(filePath).replace(/\\/g, '/');
    let sourceFile = this.parser.getProject().getSourceFile(filePath);

    if (!sourceFile) {
      if (content !== undefined) {
        sourceFile = this.parser.getProject().createSourceFile(filePath, content, { overwrite: true });
      } else if (fs.existsSync(filePath)) {
        sourceFile = this.parser.getProject().addSourceFileAtPath(filePath);
      }
    } else {
      if (content !== undefined) {
        sourceFile.replaceWithText(content);
      } else if (fs.existsSync(filePath)) {
        sourceFile.refreshFromFileSystemSync();
      }
    }

    if (!sourceFile) {
      return this.graph.toJSON();
    }

    // Remove existing nodes for this file
    this.graph.removeFileNodesAndEdges(normalizedPath);

    // Parse refreshed file
    const parsed = this.parser.parseSourceFile(sourceFile);
    for (const node of parsed.nodes) {
      this.graph.addNode(node);
    }
    for (const edge of parsed.edges) {
      this.graph.addEdge(edge);
    }

    this.graph.recalculateAllMetrics();
    return this.graph.toJSON();
  }

  /**
   * Removes a file and its nodes from the graph
   */
  public removeFile(filePath: string): ProjectGraphData {
    const normalizedPath = path.resolve(filePath).replace(/\\/g, '/');
    const sourceFile = this.parser.getProject().getSourceFile(filePath);
    if (sourceFile) {
      this.parser.getProject().removeSourceFile(sourceFile);
    }
    this.graph.removeFileNodesAndEdges(normalizedPath);
    this.graph.recalculateAllMetrics();
    return this.graph.toJSON();
  }

  /**
   * Generates a detailed Blast Radius Report for a given target symbol or file
   */
  public generateBlastRadiusReport(nodeId: string): BlastRadiusReport | null {
    const targetNode = this.graph.getNode(nodeId);
    if (!targetNode) return null;

    const directCallers = this.graph.getDirectCallers(nodeId);
    const { nodes: transitiveCallers, maxDepthReached, executionPaths } =
      this.graph.getDownstreamImpact(nodeId, 6);

    const affectedFilesSet = new Set<string>();
    const affectedTestsSet = new Set<string>();
    const affectedPublicAPIs: string[] = [];

    for (const n of [targetNode, ...directCallers, ...transitiveCallers]) {
      affectedFilesSet.add(n.filePath);
      if (n.kind === 'test' || n.filePath.includes('.test.') || n.filePath.includes('.spec.')) {
        affectedTestsSet.add(n.filePath);
      }
      if (n.isExported) {
        affectedPublicAPIs.push(`${path.basename(n.filePath)}:${n.label}`);
      }
    }

    // Transparent breakdown
    const directPoints = directCallers.length * 8;
    const transitivePoints = transitiveCallers.length * 3;
    const depthPoints = maxDepthReached * 5;
    const publicExportPoints = targetNode.isExported ? 20 : 0;
    const uncertainEdges = this.graph.getAllEdges().filter(
      (e) => (e.source === nodeId || e.target === nodeId) && e.confidence === 'uncertain'
    ).length;
    const uncertainPoints = uncertainEdges * 10;

    const totalRaw = directPoints + transitivePoints + depthPoints + publicExportPoints + uncertainPoints;
    const score = Math.min(100, Math.max(0, totalRaw));

    let riskTier: RiskTier = 'LOW';
    if (score >= 80) riskTier = 'CRITICAL';
    else if (score >= 55) riskTier = 'HIGH';
    else if (score >= 25) riskTier = 'MODERATE';

    const breakdown: ImpactBreakdown = {
      directCallersCount: directCallers.length,
      directCallersPoints: directPoints,
      transitiveCallersCount: transitiveCallers.length,
      transitiveCallersPoints: transitivePoints,
      maxDependencyDepth: maxDepthReached,
      depthPoints,
      isPublicExport: targetNode.isExported,
      publicExportPoints,
      affectedTestsCount: affectedTestsSet.size,
      uncertainEdgesCount: uncertainEdges,
      uncertainPoints,
      totalScore: score
    };

    return {
      targetNodeId: targetNode.id,
      targetLabel: targetNode.label,
      targetFile: targetNode.filePath,
      score,
      riskTier,
      breakdown,
      directCallers,
      transitiveCallers,
      affectedFiles: Array.from(affectedFilesSet),
      affectedTests: Array.from(affectedTestsSet),
      affectedPublicAPIs,
      executionPath: executionPaths[0] || [targetNode.id]
    };
  }
}

