import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { ProjectGraph } from '../src/analyzer/ProjectGraph.js';
import { RealityCheckAgent } from '../src/agents/RealityCheckAgent.js';
import { HardcodeHunterAgent } from '../src/agents/HardcodeHunterAgent.js';
import { ScopeGuardAgent } from '../src/agents/ScopeGuardAgent.js';
import { TestGuardianAgent } from '../src/agents/TestGuardianAgent.js';
import { ImpactAnalystAgent } from '../src/agents/ImpactAnalystAgent.js';
import { AgentCoordinator } from '../src/agents/AgentCoordinator.js';
import type { PolicyConfig } from '../src/types/index.js';

describe('Milestone 4: The Five Specialized Analysis Agents', () => {
  let project: Project;
  let graph: ProjectGraph;

  beforeEach(() => {
    const parser = new ASTParser();
    project = parser.getProject();
    graph = new ProjectGraph();
  });

  describe('Agent 1: Reality Check', () => {
    it('should detect non-existent imports and missing named exports', () => {
      const realityCheck = new RealityCheckAgent();

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
      const realityCheck = new RealityCheckAgent();

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

  describe('Agent 2: Hardcode Hunter', () => {
    it('should detect credentials and safely redact evidence', () => {
      const hunter = new HardcodeHunterAgent();

      const sf = project.createSourceFile('src/secrets.ts', `
        const awsKey = "AKIA1234567890ABCDEF";
        const openAiKey = "sk-proj-abc1234567890xyz9876543210abcd";
        const localPath = "C:\\\\Users\\\\JohnDoe\\\\project\\\\secret.json";
      `, { overwrite: true });

      const findings = hunter.analyze(sf);

      expect(findings.length).toBeGreaterThanOrEqual(3);

      const awsFinding = findings.find(f => f.title.includes('AWS Access Key'));
      expect(awsFinding).toBeDefined();
      expect(awsFinding?.evidence).not.toContain('AKIA1234567890ABCDEF'); // Must be redacted
      expect(awsFinding?.evidence).toContain('••••');

      const openAiFinding = findings.find(f => f.title.includes('OpenAI API Key'));
      expect(openAiFinding).toBeDefined();
      expect(openAiFinding?.evidence).not.toContain('abc1234567890xyz');
      expect(openAiFinding?.evidence).toContain('••••');
    });

    it('should correctly calculate Shannon entropy for random keys', () => {
      const hunter = new HardcodeHunterAgent();
      const lowEntropy = hunter.calculateEntropy('aaaaaaaaaaaaaa');
      const highEntropy = hunter.calculateEntropy('d8f37b92ac71e405f6e8a1b2c3d4');

      expect(lowEntropy).toBeLessThan(1.0);
      expect(highEntropy).toBeGreaterThan(3.5);
    });
  });

  describe('Agent 3: Scope Guard', () => {
    it('should flag unauthorized lockfile and CI pipeline edits', () => {
      const scopeGuard = new ScopeGuardAgent();

      const findings = scopeGuard.analyze({
        taskDescription: 'Fix button color on login page',
        modifiedFiles: [
          'src/components/LoginButton.tsx',
          'package-lock.json',
          '.github/workflows/deploy.yml'
        ]
      });

      expect(findings.length).toBe(2);
      expect(findings.some(f => f.title.includes('lockfile'))).toBe(true);
      expect(findings.some(f => f.title.includes('CI pipeline'))).toBe(true);
    });

    it('should allow lockfile changes when explicitly requested', () => {
      const scopeGuard = new ScopeGuardAgent();

      const findings = scopeGuard.analyze({
        taskDescription: 'Upgrade dependencies and update package-lock.json',
        modifiedFiles: ['package-lock.json']
      });

      expect(findings.length).toBe(0);
    });
  });

  describe('Agent 4: Test Guardian', () => {
    it('should detect .only focus, .skip flags, empty tests, and tautological assertions', () => {
      const testGuardian = new TestGuardianAgent();

      const sf = project.createSourceFile('src/auth.test.ts', `
        describe.only('Auth Suite', () => {
          it('should test something', () => {
            expect(true).toBe(true); // Tautology!
          });

          it.skip('should skip this test', () => {
            console.log('skipped');
          });

          it('empty test case', () => {});
        });
      `, { overwrite: true });

      const findings = testGuardian.analyze(sf);

      expect(findings.some(f => f.title.includes('Exclusive test focus'))).toBe(true);
      expect(findings.some(f => f.title.includes('Skipped test'))).toBe(true);
      expect(findings.some(f => f.title.includes('Tautological assertion'))).toBe(true);
      expect(findings.some(f => f.title.includes('Empty test body'))).toBe(true);
    });

    it('should detect silently deleted test blocks', () => {
      const testGuardian = new TestGuardianAgent();

      const oldTestContent = `
        it('validates user token', () => { expect(token).toBeDefined(); });
        it('rejects expired token', () => { expect(err).toBeNull(); });
      `;

      // New content where 'rejects expired token' was deleted
      const sf = project.createSourceFile('src/token.test.ts', `
        it('validates user token', () => { expect(token).toBeDefined(); });
      `, { overwrite: true });

      const findings = testGuardian.analyze(sf, oldTestContent);
      const deletedFinding = findings.find(f => f.title.includes('Deleted test case'));
      expect(deletedFinding).toBeDefined();
      expect(deletedFinding?.title).toContain('rejects expired token');
    });
  });

  describe('Agent 5: Impact Analyst & Agent Coordinator', () => {
    it('should evaluate proposed changes and enforce safety policies', () => {
      const coordinator = new AgentCoordinator(project, graph);

      const policy: PolicyConfig = {
        blockOnCritical: true,
        quarantineScopeViolations: true,
        failOnHardcodedSecrets: true,
        failOnDeletedTests: true,
        maxAllowedImpactScore: 80,
        allowedModificationPaths: ['src/'],
        ignoredPaths: []
      };

      // 1. Proposed change with hardcoded secret -> Should be BLOCKED
      const secretEdit = coordinator.inspectProposedChange({
        tool: 'Edit',
        filePath: 'src/config.ts',
        newContent: 'export const secret = "AKIA1234567890ABCDEF";',
        taskDescription: 'Add configuration'
      }, policy);

      expect(secretEdit.action).toBe('block');
      expect(secretEdit.reason).toContain('Hardcoded secret');

      // 2. Clean proposed change -> Should be ALLOWED
      const cleanEdit = coordinator.inspectProposedChange({
        tool: 'Edit',
        filePath: 'src/utils.ts',
        newContent: 'export function square(n: number): number { return n * n; }',
        taskDescription: 'Add square utility function'
      }, policy);

      expect(cleanEdit.action).toBe('allow');
    });
  });
});

