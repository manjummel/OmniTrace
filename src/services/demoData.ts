import type { ProjectGraphData, Finding, Hotspot } from '@blast-radius/core';

export const DEMO_GRAPH_DATA: ProjectGraphData = {
  lastUpdated: Date.now(),
  summary: {
    totalFiles: 8,
    totalFunctions: 14,
    totalClasses: 3,
    totalEdges: 21,
    highestImpactScore: 92
  },
  nodes: [
    {
      id: 'file:src/core/security.ts',
      label: 'security.ts',
      kind: 'file',
      filePath: 'src/core/security.ts',
      line: 1,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 6,
        outgoingCallsCount: 2,
        transitiveImpactCount: 11,
        blastRadiusScore: 92,
        riskTier: 'CRITICAL',
        hasFindings: true
      }
    },
    {
      id: 'func:src/core/security.ts:verifyToken:14',
      label: 'verifyToken',
      kind: 'function',
      filePath: 'src/core/security.ts',
      line: 14,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 5,
        outgoingCallsCount: 1,
        transitiveImpactCount: 8,
        blastRadiusScore: 84,
        riskTier: 'CRITICAL',
        hasFindings: true
      }
    },
    {
      id: 'file:src/services/payment.ts',
      label: 'payment.ts',
      kind: 'file',
      filePath: 'src/services/payment.ts',
      line: 1,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 3,
        outgoingCallsCount: 4,
        transitiveImpactCount: 6,
        blastRadiusScore: 68,
        riskTier: 'HIGH',
        hasFindings: true
      }
    },
    {
      id: 'class:src/services/payment.ts:PaymentProcessor',
      label: 'PaymentProcessor',
      kind: 'class',
      filePath: 'src/services/payment.ts',
      line: 18,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 3,
        outgoingCallsCount: 3,
        transitiveImpactCount: 5,
        blastRadiusScore: 65,
        riskTier: 'HIGH',
        hasFindings: false
      }
    },
    {
      id: 'func:src/services/payment.ts:chargeCard:45',
      label: 'chargeCard',
      kind: 'function',
      filePath: 'src/services/payment.ts',
      line: 45,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 2,
        outgoingCallsCount: 2,
        transitiveImpactCount: 4,
        blastRadiusScore: 52,
        riskTier: 'MODERATE',
        hasFindings: true
      }
    },
    {
      id: 'file:src/api/checkout.ts',
      label: 'checkout.ts',
      kind: 'file',
      filePath: 'src/api/checkout.ts',
      line: 1,
      column: 1,
      isExported: false,
      metrics: {
        incomingCallsCount: 1,
        outgoingCallsCount: 3,
        transitiveImpactCount: 2,
        blastRadiusScore: 32,
        riskTier: 'MODERATE',
        hasFindings: true
      }
    },
    {
      id: 'file:src/utils/tax.ts',
      label: 'tax.ts',
      kind: 'file',
      filePath: 'src/utils/tax.ts',
      line: 1,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 2,
        outgoingCallsCount: 0,
        transitiveImpactCount: 3,
        blastRadiusScore: 40,
        riskTier: 'MODERATE',
        hasFindings: false
      }
    },
    {
      id: 'file:test/payment.test.ts',
      label: 'payment.test.ts',
      kind: 'test',
      filePath: 'test/payment.test.ts',
      line: 1,
      column: 1,
      isExported: false,
      metrics: {
        incomingCallsCount: 0,
        outgoingCallsCount: 4,
        transitiveImpactCount: 0,
        blastRadiusScore: 15,
        riskTier: 'LOW',
        hasFindings: true
      }
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'file:src/services/payment.ts',
      target: 'file:src/core/security.ts',
      type: 'imports',
      confidence: 'exact'
    },
    {
      id: 'e2',
      source: 'file:src/api/checkout.ts',
      target: 'file:src/services/payment.ts',
      type: 'imports',
      confidence: 'exact'
    },
    {
      id: 'e3',
      source: 'file:src/services/payment.ts',
      target: 'file:src/utils/tax.ts',
      type: 'imports',
      confidence: 'exact'
    },
    {
      id: 'e4',
      source: 'func:src/services/payment.ts:chargeCard:45',
      target: 'func:src/core/security.ts:verifyToken:14',
      type: 'calls',
      confidence: 'exact'
    },
    {
      id: 'e5',
      source: 'file:test/payment.test.ts',
      target: 'file:src/services/payment.ts',
      type: 'imports',
      confidence: 'exact'
    },
    {
      id: 'e6',
      source: 'class:src/services/payment.ts:PaymentProcessor',
      target: 'func:src/services/payment.ts:chargeCard:45',
      type: 'calls',
      confidence: 'exact'
    }
  ]
};

export const DEMO_FINDINGS: Finding[] = [
  {
    id: 'fnd-demo-1',
    agent: 'Reality Check',
    filePath: 'src/services/payment.ts',
    line: 12,
    severity: 'CRITICAL',
    confidence: 0.98,
    title: "Non-existent export 'calculateTaxRate' imported from '../utils/tax'",
    evidence: "import { calculateTaxRate } from '../utils/tax';",
    explanation: "File '../utils/tax.ts' exports 'getTaxRate' and 'TAX_TABLE', but does not export 'calculateTaxRate'. This will crash during module evaluation.",
    suggestedFix: "Change import to: import { getTaxRate } from '../utils/tax';",
    timestamp: Date.now() - 1000 * 60 * 5,
    status: 'ACTIVE'
  },
  {
    id: 'fnd-demo-2',
    agent: 'Hardcode Hunter',
    filePath: 'src/services/payment.ts',
    line: 34,
    severity: 'CRITICAL',
    confidence: 0.99,
    title: 'OpenAI API Key detected in source file',
    evidence: 'const client = new OpenAI({ apiKey: "sk-proj-••••••••••••••••••••••••4bX9" });',
    explanation: 'Detected hardcoded LLM secret token. Storing credentials in repository code violates secret management policies.',
    suggestedFix: 'Extract credential to process.env.OPENAI_API_KEY.',
    timestamp: Date.now() - 1000 * 60 * 12,
    status: 'ACTIVE'
  },
  {
    id: 'fnd-demo-3',
    agent: 'Test Guardian',
    filePath: 'test/payment.test.ts',
    line: 22,
    severity: 'CRITICAL',
    confidence: 0.99,
    title: "Exclusive test focus 'it.only' detected",
    evidence: "it.only('validates card checksum before submission', async () => {",
    explanation: "Exclusive focus flag '.only' prevents all other tests in the repository from executing in CI, masking downstream breakages.",
    suggestedFix: "Remove '.only' prefix to re-enable the full test suite.",
    timestamp: Date.now() - 1000 * 60 * 18,
    status: 'ACTIVE'
  },
  {
    id: 'fnd-demo-4',
    agent: 'Scope Guard',
    filePath: 'package-lock.json',
    line: 1,
    severity: 'HIGH',
    confidence: 0.94,
    title: 'Unexpected lockfile modification outside task prompt scope',
    evidence: 'File modified: package-lock.json (+42 lines, -18 lines)',
    explanation: "Current prompt was 'fix tax calculation rounding'. AI agent autonomously changed lockfile dependencies without user request.",
    suggestedFix: 'Revert package-lock.json changes unless dependencies are intentionally upgraded.',
    timestamp: Date.now() - 1000 * 60 * 25,
    status: 'ACTIVE'
  },
  {
    id: 'fnd-demo-5',
    agent: 'Impact Analyst',
    filePath: 'src/core/security.ts',
    line: 14,
    severity: 'CRITICAL',
    confidence: 0.95,
    title: "High Blast Radius (84/100) on 'verifyToken'",
    evidence: 'Direct callers: 5, Transitive consumers: 8, Affected files: 5',
    explanation: "Function 'verifyToken' is imported and called across payment, checkout, and auth pipelines. A signature change here breaks 5 downstream services.",
    suggestedFix: 'Preserve backward compatibility or introduce overload signatures.',
    timestamp: Date.now() - 1000 * 60 * 30,
    status: 'ACTIVE'
  }
];

export const DEMO_HOTSPOTS: Hotspot[] = [
  {
    nodeId: 'file:src/core/security.ts',
    label: 'security.ts',
    filePath: 'src/core/security.ts',
    kind: 'file',
    fanIn: 6,
    fanOut: 2,
    blastRadiusScore: 92,
    activeFindingsCount: 2,
    riskTier: 'CRITICAL'
  },
  {
    nodeId: 'func:src/core/security.ts:verifyToken:14',
    label: 'verifyToken',
    filePath: 'src/core/security.ts',
    kind: 'function',
    fanIn: 5,
    fanOut: 1,
    blastRadiusScore: 84,
    activeFindingsCount: 1,
    riskTier: 'CRITICAL'
  },
  {
    nodeId: 'file:src/services/payment.ts',
    label: 'payment.ts',
    filePath: 'src/services/payment.ts',
    kind: 'file',
    fanIn: 3,
    fanOut: 4,
    blastRadiusScore: 68,
    activeFindingsCount: 2,
    riskTier: 'HIGH'
  },
  {
    nodeId: 'class:src/services/payment.ts:PaymentProcessor',
    label: 'PaymentProcessor',
    filePath: 'src/services/payment.ts',
    kind: 'class',
    fanIn: 3,
    fanOut: 3,
    blastRadiusScore: 65,
    activeFindingsCount: 0,
    riskTier: 'HIGH'
  }
];

