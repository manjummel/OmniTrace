import { describe, it, expect } from 'vitest';
import { PatchManager } from '../src/patch/PatchManager.js';
import type { Finding } from '../src/types/index.js';

describe('Milestone 5: Patch Manager & Findings Remediation', () => {
  it('should generate a proposed fix for .only test focus and generate AI prompt', () => {
    const manager = new PatchManager();

    const finding: Finding = {
      id: 'fnd-tg-1',
      agent: 'Test Guardian',
      filePath: 'test/auth.test.ts',
      line: 12,
      severity: 'CRITICAL',
      confidence: 0.99,
      title: "Exclusive test focus 'it.only' detected",
      evidence: "it.only('tests login', () => {",
      explanation: 'Focus suppresses other tests.',
      suggestedFix: 'Remove .only prefix',
      timestamp: Date.now(),
      status: 'ACTIVE'
    };

    const fileContent = `
      describe('Suite', () => {
        it.only('tests login', () => {
          expect(1).toBe(1);
        });
      });
    `;

    const patch = manager.generateFix(finding, fileContent);
    expect(patch).toBeDefined();
    expect(patch?.newContent).not.toContain('it.only');
    expect(patch?.newContent).toContain("it('tests login'");

    // Test AI Prompt generation
    const prompt = manager.generateAIPrompt(finding);
    expect(prompt).toContain('Blast Radius Live Safety Finding');
    expect(prompt).toContain('Test Guardian');
    expect(prompt).toContain('test/auth.test.ts');
    expect(prompt).toContain('Guardrail Constraints');
  });

  it('should track dismissals with custom reasons', () => {
    const manager = new PatchManager();
    manager.dismissFinding('finding-123', 'False positive in benchmark file');

    expect(manager.isDismissed('finding-123')).toBe(true);
    expect(manager.getDismissalReason('finding-123')).toBe('False positive in benchmark file');
    expect(manager.isDismissed('finding-999')).toBe(false);
  });
});

