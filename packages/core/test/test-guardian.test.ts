import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { TestGuardianAgent } from '../src/agents/TestGuardianAgent.js';

describe('Agent: Test Guardian', () => {
  let project: Project;
  let testGuardian: TestGuardianAgent;

  beforeEach(() => {
    const parser = new ASTParser();
    project = parser.getProject();
    testGuardian = new TestGuardianAgent();
  });

  it('should detect .only focus, .skip flags, empty tests, and tautological assertions', () => {
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
