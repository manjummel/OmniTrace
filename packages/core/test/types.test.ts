import { describe, it, expect } from 'vitest';
import type { GraphNode, Finding } from '../src/types/index.js';

describe('Shared Data Types and Contracts', () => {
  it('should define and instantiate a valid GraphNode model', () => {
    const node: GraphNode = {
      id: 'file:src/utils/math.ts:sum',
      label: 'sum',
      kind: 'function',
      filePath: 'src/utils/math.ts',
      line: 10,
      column: 1,
      isExported: true,
      metrics: {
        incomingCallsCount: 4,
        outgoingCallsCount: 0,
        transitiveImpactCount: 9,
        blastRadiusScore: 45,
        riskTier: 'MODERATE',
        hasFindings: false
      }
    };

    expect(node.id).toBe('file:src/utils/math.ts:sum');
    expect(node.kind).toBe('function');
    expect(node.metrics.blastRadiusScore).toBe(45);
    expect(node.metrics.riskTier).toBe('MODERATE');
  });

  it('should define and instantiate a valid Finding model', () => {
    const finding: Finding = {
      id: 'fnd-1',
      agent: 'Reality Check',
      filePath: 'src/services/billing.ts',
      line: 24,
      severity: 'CRITICAL',
      confidence: 0.99,
      title: 'Import not found',
      evidence: "import { foo } from './bar';",
      explanation: "Module './bar' does not export 'foo'.",
      timestamp: Date.now(),
      status: 'ACTIVE'
    };

    expect(finding.agent).toBe('Reality Check');
    expect(finding.severity).toBe('CRITICAL');
    expect(finding.status).toBe('ACTIVE');
  });
});
