import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { RealityCheckAgent } from '../src/agents/RealityCheckAgent.js';

describe('Agent: Reality Check', () => {
  let project: Project;
  let realityCheck: RealityCheckAgent;

  beforeEach(() => {
    const parser = new ASTParser();
    project = parser.getProject();
    realityCheck = new RealityCheckAgent();
  });

  it('should detect non-existent imports and missing named exports', () => {
    // Module A: exports only 'validExport'
    project.createSourceFile('src/moduleA.ts', `
      export const validExport = 42;
    `, { overwrite: true });

    // Module B: imports non-existent export 'missingExport' and non-existent file './ghost'
    const consumer = project.createSourceFile('src/consumer.ts', `
      import { missingExport } from './moduleA';
      import { something } from './ghost';
    `, { overwrite: true });

    const findings = realityCheck.analyze(consumer);

    expect(findings.length).toBeGreaterThanOrEqual(2);
    const missingExportFinding = findings.find(f => f.title.includes('has no exported member'));
    expect(missingExportFinding).toBeDefined();
    expect(missingExportFinding?.severity).toBe('CRITICAL');

    const ghostFinding = findings.find(f => f.title.includes('Unresolved module import'));
    expect(ghostFinding).toBeDefined();
    expect(ghostFinding?.severity).toBe('CRITICAL');
  });

  it('should detect function calls with insufficient arguments', () => {
    const sf = project.createSourceFile('src/calculator.ts', `
      function divide(numerator: number, denominator: number): number {
        return numerator / denominator;
      }
      export function run() {
        return divide(10); // Missing denominator
      }
    `, { overwrite: true });

    const findings = realityCheck.analyze(sf);
    const argFinding = findings.find(f => f.title.includes('Expected at least 2 argument(s)'));
    expect(argFinding).toBeDefined();
    expect(argFinding?.severity).toBe('HIGH');
  });
});
