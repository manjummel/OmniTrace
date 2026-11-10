import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../types/index.js';

export interface ProposedPatch {
  findingId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  diffSummary: string;
  timestamp: number;
}

export interface RollbackSnapshot {
  patchId: string;
  filePath: string;
  content: string;
  timestamp: number;
}

export class PatchManager {
  private rollbackSnapshots: Map<string, RollbackSnapshot> = new Map();
  private dismissedFindings: Map<string, { reason: string; timestamp: number }> = new Map();

  /**
   * Generates a proposed fix patch for a given finding
   */
  public generateFix(finding: Finding, fileContent?: string): ProposedPatch | null {
    const rawContent = fileContent ?? (fs.existsSync(finding.filePath) ? fs.readFileSync(finding.filePath, 'utf8') : null);
    if (!rawContent) return null;

    let modifiedContent = rawContent;
    let diffSummary = '';

    // Handle Reality Check: missing named export
    if (finding.agent === 'Reality Check' && finding.title.includes('has no exported member') && finding.suggestedFix) {
      if (finding.suggestedFix.includes('{') && finding.evidence) {
        // e.g. Replace import { missing } with suggested
        const match = finding.suggestedFix.match(/\{ (.*?) \}/);
        if (match) {
          const newName = match[1];
          const oldName = finding.title.match(/'(.*?)'/)?.[1];
          if (oldName) {
            modifiedContent = rawContent.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
            diffSummary = `Replaced '${oldName}' with valid export '${newName}'`;
          }
        }
      }
    }
    // Handle Hardcode Hunter: replace secret with process.env
    else if (finding.agent === 'Hardcode Hunter') {
      const lines = rawContent.split('\n');
      if (finding.line >= 1 && finding.line <= lines.length) {
        const targetLine = lines[finding.line - 1];
        const envVarName = `SECRET_${path.basename(finding.filePath, path.extname(finding.filePath)).toUpperCase()}_KEY`;
        
        // Simple heuristic replacement of string literal with process.env.KEY
        const patchedLine = targetLine.replace(
          /(['"][^'"]{16,}['"])/,
          `process.env.${envVarName} || ""`
        );

        if (patchedLine !== targetLine) {
          lines[finding.line - 1] = patchedLine;
          modifiedContent = lines.join('\n');
          diffSummary = `Extracted secret to process.env.${envVarName}`;
        }
      }
    }
    // Handle Test Guardian: remove .only
    else if (finding.agent === 'Test Guardian' && finding.title.includes('Exclusive test focus')) {
      modifiedContent = rawContent
        .replace(/\b(it|test|describe)\.only\b/g, '$1')
        .replace(/\b(fit|fdescribe)\b/g, (m) => (m === 'fit' ? 'it' : 'describe'));
      diffSummary = `Removed exclusive .only focus to re-enable full test suite.`;
    }
    // Handle Test Guardian: remove .skip
    else if (finding.agent === 'Test Guardian' && finding.title.includes('Skipped test')) {
      modifiedContent = rawContent
        .replace(/\b(it|test|describe)\.skip\b/g, '$1')
        .replace(/\b(xit|xtest|xdescribe)\b/g, (m) => (m === 'xit' ? 'it' : m === 'xtest' ? 'test' : 'describe'));
      diffSummary = `Re-enabled skipped test by removing .skip prefix.`;
    }

    if (modifiedContent === rawContent) {
      // Generic fallback comment patch
      diffSummary = `Annotated finding with remediation TODO`;
      const lines = rawContent.split('\n');
      if (finding.line >= 1 && finding.line <= lines.length) {
        lines.splice(finding.line - 1, 0, `// TODO [Blast Radius - ${finding.agent}]: ${finding.title}`);
        modifiedContent = lines.join('\n');
      }
    }

    return {
      findingId: finding.id,
      filePath: finding.filePath,
      oldContent: rawContent,
      newContent: modifiedContent,
      diffSummary,
      timestamp: Date.now()
    };
  }

  /**
   * Applies the proposed patch to disk and saves rollback snapshot
   */
  public applyPatch(patch: ProposedPatch): { success: boolean; rollbackId: string; error?: string } {
    try {
      const rollbackId = `rb_${patch.findingId}_${Date.now()}`;
      
      // Save rollback snapshot
      this.rollbackSnapshots.set(rollbackId, {
        patchId: rollbackId,
        filePath: patch.filePath,
        content: patch.oldContent,
        timestamp: Date.now()
      });

      fs.writeFileSync(patch.filePath, patch.newContent, 'utf8');
      return { success: true, rollbackId };
    } catch (err: any) {
      return { success: false, rollbackId: '', error: err.message };
    }
  }

  /**
   * Rolls back an applied patch using the saved snapshot
   */
  public rollback(rollbackId: string): boolean {
    const snapshot = this.rollbackSnapshots.get(rollbackId);
    if (!snapshot) return false;

    try {
      fs.writeFileSync(snapshot.filePath, snapshot.content, 'utf8');
      this.rollbackSnapshots.delete(rollbackId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dismisses a finding locally with user reason
   */
  public dismissFinding(findingId: string, reason: string): void {
    this.dismissedFindings.set(findingId, {
      reason,
      timestamp: Date.now()
    });
  }

  public isDismissed(findingId: string): boolean {
    return this.dismissedFindings.has(findingId);
  }

  public getDismissalReason(findingId: string): string | undefined {
    return this.dismissedFindings.get(findingId)?.reason;
  }

  /**
   * Generates a copyable AI prompt for Claude Code, Cursor, Copilot, etc.
   */
  public generateAIPrompt(finding: Finding): string {
    return `### Blast Radius Live Safety Finding: ${finding.title}
**Agent:** ${finding.agent}
**File:** \`${finding.filePath}\` (Line ${finding.line})
**Severity:** ${finding.severity} (Confidence: ${Math.round(finding.confidence * 100)}%)

**Problem Description:**
${finding.explanation}

**Evidence:**
\`\`\`typescript
${finding.evidence}
\`\`\`

**Required Action:**
${finding.suggestedFix || 'Please refactor the code to resolve this issue.'}

**Guardrail Constraints:**
1. Do not modify files outside \`${path.dirname(finding.filePath)}\`.
2. Do not delete or skip test assertions.
3. Do not hardcode credentials or secrets.
`;
  }
}

