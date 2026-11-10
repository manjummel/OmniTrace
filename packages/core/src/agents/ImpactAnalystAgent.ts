import type { ProjectGraph } from '../analyzer/ProjectGraph.js';
import type { BlastRadiusReport, Finding, RiskTier } from '../types/index.js';

export interface ImpactAnalysisOptions {
  maxAllowedScore?: number;
}

export class ImpactAnalystAgent {
  public readonly name = 'Impact Analyst' as const;

  constructor(private graph: ProjectGraph) {}

  /**
   * Evaluates impact of modified node or file and returns report & findings if risk threshold is exceeded
   */
  public analyze(nodeId: string, options: ImpactAnalysisOptions = {}): {
    report: BlastRadiusReport | null;
    findings: Finding[];
  } {
    const findings: Finding[] = [];
    const targetNode = this.graph.getNode(nodeId);

    if (!targetNode) {
      return { report: null, findings: [] };
    }

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
        affectedPublicAPIs.push(`${n.filePath}:${n.label}`);
      }
    }

    // Mathematical score calculation
    const directPoints = directCallers.length * 8;
    const transitivePoints = transitiveCallers.length * 3;
    const depthPoints = maxDepthReached * 5;
    const publicExportPoints = targetNode.isExported ? 20 : 0;
    const uncertainEdges = this.graph.getAllEdges().filter(
      (e) => (e.source === nodeId || e.target === nodeId) && e.confidence === 'uncertain'
    ).length;
    const uncertainPoints = uncertainEdges * 10;

    const rawScore = directPoints + transitivePoints + depthPoints + publicExportPoints + uncertainPoints;
    const score = Math.min(100, Math.max(0, rawScore));

    let riskTier: RiskTier = 'LOW';
    if (score >= 80) riskTier = 'CRITICAL';
    else if (score >= 55) riskTier = 'HIGH';
    else if (score >= 25) riskTier = 'MODERATE';

    const maxAllowed = options.maxAllowedScore ?? 75;

    // Generate finding if risk tier is HIGH or CRITICAL or exceeds threshold
    if (score >= maxAllowed) {
      findings.push({
        id: `ia-high-blast-${nodeId}`,
        agent: this.name,
        filePath: targetNode.filePath,
        line: targetNode.line,
        severity: score >= 80 ? 'CRITICAL' : 'HIGH',
        confidence: 0.95,
        title: `High Blast Radius (${score}/100) on '${targetNode.label}'`,
        evidence: `Direct callers: ${directCallers.length}, Transitive consumers: ${transitiveCallers.length}, Affected files: ${affectedFilesSet.size}`,
        explanation: `Modifying '${targetNode.label}' creates a wide downstream blast radius affecting ${affectedFilesSet.size} file(s) across a call depth of ${maxDepthReached}.`,
        suggestedFix: `Run regression tests on all affected consumers (${Array.from(affectedTestsSet).join(', ') || 'No direct tests detected'}) before deploying.`,
        timestamp: Date.now(),
        status: 'ACTIVE'
      });
    }

    // Flag if critical public interface has zero test coverage
    if (targetNode.isExported && affectedTestsSet.size === 0 && directCallers.length > 2) {
      findings.push({
        id: `ia-untested-interface-${nodeId}`,
        agent: this.name,
        filePath: targetNode.filePath,
        line: targetNode.line,
        severity: 'HIGH',
        confidence: 0.91,
        title: `Exported interface '${targetNode.label}' has zero test consumers`,
        evidence: `Exported symbol with ${directCallers.length} callers but 0 automated test suites.`,
        explanation: `This modified export is consumed by multiple modules but has no automated test coverage in the dependency chain.`,
        suggestedFix: `Create a unit test suite covering '${targetNode.label}'.`,
        timestamp: Date.now(),
        status: 'ACTIVE'
      });
    }

    const report: BlastRadiusReport = {
      targetNodeId: targetNode.id,
      targetLabel: targetNode.label,
      targetFile: targetNode.filePath,
      score,
      riskTier,
      breakdown: {
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
      },
      directCallers,
      transitiveCallers,
      affectedFiles: Array.from(affectedFilesSet),
      affectedTests: Array.from(affectedTestsSet),
      affectedPublicAPIs,
      executionPath: executionPaths[0] || [targetNode.id]
    };

    return { report, findings };
  }
}

