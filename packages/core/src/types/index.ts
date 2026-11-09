export type NodeKind = 'file' | 'function' | 'class' | 'interface' | 'variable' | 'test';

export type EdgeType = 'imports' | 'calls' | 'instantiates' | 'inherits' | 'tests';

export type EdgeConfidence = 'exact' | 'uncertain';

export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface NodeMetrics {
  incomingCallsCount: number;
  outgoingCallsCount: number;
  transitiveImpactCount: number;
  blastRadiusScore: number;
  riskTier: RiskTier;
  hasFindings: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  filePath: string;
  line: number;
  column: number;
  isExported: boolean;
  metrics: NodeMetrics;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  confidence: EdgeConfidence;
  line?: number;
}

export interface ProjectGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lastUpdated: number;
  summary: {
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalEdges: number;
    highestImpactScore: number;
  };
}

export type AgentName =
  | 'Reality Check'
  | 'Hardcode Hunter'
  | 'Scope Guard'
  | 'Test Guardian'
  | 'Impact Analyst';

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingStatus = 'ACTIVE' | 'DISMISSED' | 'FIXED';

export interface Finding {
  id: string;
  agent: AgentName;
  filePath: string;
  line: number;
  column?: number;
  severity: FindingSeverity;
  confidence: number; // 0.0 - 1.0
  title: string;
  evidence: string;
  explanation: string;
  suggestedFix?: string;
  timestamp: number;
  status: FindingStatus;
  dismissalReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ImpactBreakdown {
  directCallersCount: number;
  directCallersPoints: number;
  transitiveCallersCount: number;
  transitiveCallersPoints: number;
  maxDependencyDepth: number;
  depthPoints: number;
  isPublicExport: boolean;
  publicExportPoints: number;
  affectedTestsCount: number;
  uncertainEdgesCount: number;
  uncertainPoints: number;
  totalScore: number;
}

export interface BlastRadiusReport {
  targetNodeId: string;
  targetLabel: string;
  targetFile: string;
  score: number;
  riskTier: RiskTier;
  breakdown: ImpactBreakdown;
  directCallers: GraphNode[];
  transitiveCallers: GraphNode[];
  affectedFiles: string[];
  affectedTests: string[];
  affectedPublicAPIs: string[];
  executionPath: string[]; // Node IDs representing sample call chain
}

export interface Hotspot {
  nodeId: string;
  label: string;
  filePath: string;
  kind: NodeKind;
  fanIn: number;
  fanOut: number;
  blastRadiusScore: number;
  activeFindingsCount: number;
  riskTier: RiskTier;
}

export interface PolicyConfig {
  blockOnCritical: boolean;
  quarantineScopeViolations: boolean;
  failOnHardcodedSecrets: boolean;
  failOnDeletedTests: boolean;
  maxAllowedImpactScore: number;
  allowedModificationPaths: string[];
  ignoredPaths: string[];
}

export interface HookInspectionRequest {
  tool: 'Edit' | 'Write' | 'Bash' | string;
  filePath: string;
  oldContent?: string;
  newContent: string;
  taskDescription?: string;
}

export interface HookInspectionResponse {
  action: 'allow' | 'warn' | 'block';
  reason: string;
  findings: Finding[];
  impactScore?: number;
  timestamp: number;
}

