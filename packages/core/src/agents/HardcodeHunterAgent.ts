import { SourceFile, SyntaxKind, StringLiteral } from 'ts-morph';
import type { Finding } from '../types/index.js';

interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: 'HIGH' | 'CRITICAL';
  description: string;
}

export class HardcodeHunterAgent {
  public readonly name = 'Hardcode Hunter' as const;

  private patterns: SecretPattern[] = [
    {
      name: 'AWS Access Key',
      regex: /\b(AKIA[0-9A-Z]{16})\b/g,
      severity: 'CRITICAL',
      description: 'Hardcoded Amazon Web Services Access Key ID detected.'
    },
    {
      name: 'GitHub Token',
      regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})\b/g,
      severity: 'CRITICAL',
      description: 'Hardcoded GitHub Personal Access Token detected.'
    },
    {
      name: 'OpenAI API Key',
      regex: /\b(sk-[a-zA-Z0-9_\-]{20,})\b/g,
      severity: 'CRITICAL',
      description: 'Hardcoded OpenAI / LLM API Key detected.'
    },
    {
      name: 'Private Key',
      regex: /-----BEGIN\s+(?:[A-Z\s]+)?PRIVATE\s+KEY-----/g,
      severity: 'CRITICAL',
      description: 'Embedded cryptographic private key block detected.'
    },
    {
      name: 'Credential-bearing URL',
      regex: /https?:\/\/[a-zA-Z0-9_.-]+:[^@\s]+@[a-zA-Z0-9_.-]+/g,
      severity: 'CRITICAL',
      description: 'URL containing embedded plaintext username and password.'
    },
    {
      name: 'Hardcoded Local Filesystem Path',
      regex: /(?:[a-zA-Z]:[/\\]{1,2}(?:Users|Documents and Settings)[/\\]{1,2}[^'"\s]+|\/(?:Users|home)\/[^'"\s]+)/g,
      severity: 'HIGH',
      description: 'Hardcoded user-specific workstation path embedded in source.'
    }
  ];

  /**
   * Calculates Shannon Entropy of a string to evaluate randomness
   */
  public calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    const frequencies: Record<string, number> = {};
    for (const char of str) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    const len = str.length;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /**
   * Masks secret values to prevent leakage in logs, UI, or cloud storage
   */
  public maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '••••••••';
    }
    const prefix = secret.slice(0, 4);
    const suffix = secret.slice(-4);
    const maskedLen = Math.min(24, Math.max(6, secret.length - 8));
    return `${prefix}${'•'.repeat(maskedLen)}${suffix}`;
  }

  /**
   * Analyzes source file for secrets, credentials, and local paths
   */
  public analyze(sourceFile: SourceFile): Finding[] {
    const findings: Finding[] = [];
    const rawPath = sourceFile.getFilePath();
    const filePath = rawPath.replace(/\\/g, '/');
    const text = sourceFile.getFullText();
    const lines = text.split('\n');

    // 1. Regex pattern check across all lines
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      for (const pattern of this.patterns) {
        // Reset regex state
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.regex.exec(lineText)) !== null) {
          const matchedSecret = match[0];
          const redacted = this.maskSecret(matchedSecret);
          const safeEvidence = lineText.replace(matchedSecret, redacted).trim();

          findings.push({
            id: `hh-pattern-${filePath}-${lineNum}-${pattern.name.replace(/\s+/g, '_')}`,
            agent: this.name,
            filePath,
            line: lineNum,
            severity: pattern.severity,
            confidence: 0.98,
            title: `${pattern.name} detected`,
            evidence: safeEvidence,
            explanation: `${pattern.description} Storing secrets in source files violates security best practices and exposes credentials.`,
            suggestedFix: `Extract credential into an environment variable (e.g. process.env.API_KEY) and store in a secure secret store or .env file.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }
      }
    });

    // 2. High Entropy String Literal Analysis
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.StringLiteral) {
        const strLit = node as StringLiteral;
        const val = strLit.getLiteralValue();
        const line = strLit.getStartLineNumber();

        // Check if string looks like an API key or secret token (> 24 chars, no spaces, high entropy)
        if (val.length >= 24 && !val.includes(' ') && !val.startsWith('http://') && !val.startsWith('https://')) {
          const entropy = this.calculateEntropy(val);

          // Threshold for high randomness typical of cryptographic tokens
          if (entropy > 4.5) {
            // Check if already captured by regex pattern
            const alreadyCaptured = findings.some(f => f.line === line);
            if (!alreadyCaptured) {
              const redacted = this.maskSecret(val);
              const safeEvidence = strLit.getText().replace(val, redacted);

              findings.push({
                id: `hh-entropy-${filePath}-${line}`,
                agent: this.name,
                filePath,
                line,
                severity: 'HIGH',
                confidence: 0.88,
                title: `Suspicious high-entropy secret token (Entropy: ${entropy.toFixed(2)})`,
                evidence: safeEvidence,
                explanation: `Detected string literal with high Shannon entropy (${entropy.toFixed(2)} bits/char), characteristic of cryptographic keys, access tokens, or sensitive hashes.`,
                suggestedFix: `Store sensitive credentials in environment variables rather than embedding in code.`,
                timestamp: Date.now(),
                status: 'ACTIVE'
              });
            }
          }
        }
      }
    });

    return findings;
  }
}
