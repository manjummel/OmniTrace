import { SourceFile, SyntaxKind, CallExpression } from 'ts-morph';
import type { Finding } from '../types/index.js';

export class TestGuardianAgent {
  public readonly name = 'Test Guardian' as const;

  /**
   * Analyzes test files for suppressed, skipped, tautological, or empty test cases
   */
  public analyze(sourceFile: SourceFile, oldContent?: string): Finding[] {
    const findings: Finding[] = [];
    const rawPath = sourceFile.getFilePath();
    const filePath = rawPath.replace(/\\/g, '/');

    const isTestFile =
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('__tests__');

    if (!isTestFile) {
      return findings;
    }

    const currentTestTitles = new Set<string>();

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const call = node as CallExpression;
        const line = call.getStartLineNumber();
        const expr = call.getExpression();
        const exprText = expr.getText();
        const fullCallText = call.getText();

        // 1. Detect .only test focus (suppresses entire remainder of suite)
        if (
          exprText === 'it.only' ||
          exprText === 'test.only' ||
          exprText === 'describe.only' ||
          exprText === 'fit' ||
          exprText === 'fdescribe'
        ) {
          findings.push({
            id: `tg-only-${filePath}-${line}`,
            agent: this.name,
            filePath,
            line,
            severity: 'CRITICAL',
            confidence: 0.99,
            title: `Exclusive test focus '${exprText}' detected`,
            evidence: fullCallText.split('\n')[0],
            explanation: `Using '${exprText}' disables execution of all other test suites in CI and pre-commit checks, masking breakages across the codebase.`,
            suggestedFix: `Remove the '.only' or 'f' prefix to run the full test suite.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }

        // 2. Detect .skip or disabled tests
        if (
          exprText === 'it.skip' ||
          exprText === 'test.skip' ||
          exprText === 'describe.skip' ||
          exprText === 'xit' ||
          exprText === 'xtest' ||
          exprText === 'xdescribe'
        ) {
          findings.push({
            id: `tg-skip-${filePath}-${line}`,
            agent: this.name,
            filePath,
            line,
            severity: 'HIGH',
            confidence: 0.98,
            title: `Skipped test '${exprText}' detected`,
            evidence: fullCallText.split('\n')[0],
            explanation: `The test case was marked as skipped with '${exprText}', silently bypassing assertion verification.`,
            suggestedFix: `Re-enable the test case and fix underlying implementation errors.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }

        // Record test title for deletion check
        if (['it', 'test'].includes(exprText) || exprText.startsWith('it.') || exprText.startsWith('test.')) {
          const args = call.getArguments();
          if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
            const title = (args[0] as any).getLiteralValue();
            currentTestTitles.add(title);

            // 3. Detect empty test bodies: it("...", () => {})
            if (args.length >= 2) {
              const fnArg = args[1];
              if (
                fnArg.getKind() === SyntaxKind.ArrowFunction ||
                fnArg.getKind() === SyntaxKind.FunctionExpression
              ) {
                const body = (fnArg as any).getBody();
                if (body && body.getKind() === SyntaxKind.Block) {
                  const statements = body.getStatements();
                  if (statements.length === 0) {
                    findings.push({
                      id: `tg-empty-${filePath}-${line}`,
                      agent: this.name,
                      filePath,
                      line,
                      severity: 'HIGH',
                      confidence: 0.95,
                      title: `Empty test body in '${title}'`,
                      evidence: fullCallText,
                      explanation: `Test case '${title}' contains zero executable statements or assertions, producing a false positive passing result.`,
                      suggestedFix: `Add meaningful assertions or remove incomplete placeholder test.`,
                      timestamp: Date.now(),
                      status: 'ACTIVE'
                    });
                  }
                }
              }
            }
          }
        }

        // 4. Detect Tautological Assertions
        // e.g. expect(true).toBe(true), expect(1).toBe(1)
        if (fullCallText.includes('expect(')) {
          const isTautology =
            /expect\s*\(\s*true\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*true\s*\)/.test(fullCallText) ||
            /expect\s*\(\s*1\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*1\s*\)/.test(fullCallText) ||
            /expect\s*\(\s*false\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*false\s*\)/.test(fullCallText) ||
            /assert\s*\(\s*true\s*\)/.test(fullCallText);

          if (isTautology) {
            findings.push({
              id: `tg-tautology-${filePath}-${line}`,
              agent: this.name,
              filePath,
              line,
              severity: 'CRITICAL',
              confidence: 0.99,
              title: `Tautological assertion in test case`,
              evidence: fullCallText,
              explanation: `Assertion trivially evaluates to true without testing any production code logic or state. AI agents sometimes insert this to fake passing test suites.`,
              suggestedFix: `Assert actual return values or side effects of the system under test.`,
              timestamp: Date.now(),
              status: 'ACTIVE'
            });
          }
        }
      }
    });

    // 5. Detect Deleted Tests (if oldContent is supplied)
    if (oldContent) {
      const oldTestRegex = /(?:it|test)\s*\(\s*['"`](.*?)['"`]/g;
      let match: RegExpExecArray | null;
      while ((match = oldTestRegex.exec(oldContent)) !== null) {
        const oldTitle = match[1];
        if (!currentTestTitles.has(oldTitle)) {
          findings.push({
            id: `tg-deleted-${filePath}-${oldTitle.replace(/\s+/g, '_')}`,
            agent: this.name,
            filePath,
            line: 1,
            severity: 'CRITICAL',
            confidence: 0.95,
            title: `Deleted test case: "${oldTitle}"`,
            evidence: `Test "${oldTitle}" was present in previous version but deleted.`,
            explanation: `AI coding agents may silently delete failing tests to make suites pass rather than fixing the underlying defects.`,
            suggestedFix: `Restore test case "${oldTitle}" and ensure the code under test satisfies its requirements.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }
      }
    }

    return findings;
  }
}

