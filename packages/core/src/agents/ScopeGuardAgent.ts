import path from 'node:path';
import type { Finding } from '../types/index.js';

export interface ScopeInspectionInput {
  taskDescription?: string;
  modifiedFiles: string[];
  allowedPaths?: string[];
}

export class ScopeGuardAgent {
  public readonly name = 'Scope Guard' as const;

  private sensitivePatterns = [
    {
      regex: /(^|[/\\])(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
      type: 'LOCKFILE',
      title: 'Unexpected lockfile modification',
      explanation: 'Lockfiles should not be modified autonomously unless dependencies are explicitly being added or upgraded.',
      severity: 'HIGH' as const
    },
    {
      regex: /(^|[/\\])\.github[/\\]workflows[/\\].*\.(ya?ml)$/,
      type: 'CI_WORKFLOW',
      title: 'Unexpected CI pipeline modification',
      explanation: 'Autonomous edits to CI workflow pipelines introduce build security risks and potential deployment tampering.',
      severity: 'CRITICAL' as const
    },
    {
      regex: /(^|[/\\])\.env(\.[a-zA-Z0-9_-]+)?$/,
      type: 'ENV_CONFIG',
      title: 'Unrequested environment file change',
      explanation: 'Modifications to .env configuration files can overwrite production credentials or environment variables.',
      severity: 'HIGH' as const
    },
    {
      regex: /(^|[/\\])(tsconfig|vite\.config|eslint\.config|rollup\.config)\.[a-zA-Z0-9.]+$/,
      type: 'BUILD_CONFIG',
      title: 'Unrequested build configuration change',
      explanation: 'Core compiler, bundler, or linter configuration modified without explicit instruction.',
      severity: 'MEDIUM' as const
    }
  ];

  /**
   * Analyzes modified files against task intent and sensitive file policies
   */
  public analyze(input: ScopeInspectionInput): Finding[] {
    const findings: Finding[] = [];
    const { taskDescription, modifiedFiles, allowedPaths } = input;
    const taskTokens = (taskDescription || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    for (const rawFile of modifiedFiles) {
      const normalizedPath = rawFile.replace(/\\/g, '/');
      const baseName = path.basename(normalizedPath);

      // 1. Check against sensitive file patterns
      for (const pattern of this.sensitivePatterns) {
        if (pattern.regex.test(normalizedPath)) {
          // Check if task explicitly mentions lockfile, ci, workflow, or config
          const isExplicitlyRequested = taskTokens.some((token) =>
            pattern.type.toLowerCase().includes(token) ||
            baseName.toLowerCase().includes(token) ||
            token === 'dependency' ||
            token === 'install' ||
            token === 'workflow'
          );

          if (!isExplicitlyRequested) {
            findings.push({
              id: `sg-sensitive-${normalizedPath}`,
              agent: this.name,
              filePath: normalizedPath,
              line: 1,
              severity: pattern.severity,
              confidence: 0.94,
              title: pattern.title,
              evidence: `File modified: ${normalizedPath}`,
              explanation: `${pattern.explanation} The current task description ("${taskDescription || 'No prompt provided'}") does not appear to justify modifying ${baseName}.`,
              suggestedFix: `Revert changes to ${baseName} unless explicitly requested by the user.`,
              timestamp: Date.now(),
              status: 'ACTIVE'
            });
          }
        }
      }

      // 2. Check against allowedPaths if specified
      if (allowedPaths && allowedPaths.length > 0) {
        const isAllowed = allowedPaths.some((prefix) => {
          const normPrefix = prefix.replace(/\\/g, '/');
          return normalizedPath.startsWith(normPrefix) || normalizedPath.includes(normPrefix);
        });

        if (!isAllowed) {
          findings.push({
            id: `sg-unapproved-path-${normalizedPath}`,
            agent: this.name,
            filePath: normalizedPath,
            line: 1,
            severity: 'HIGH',
            confidence: 0.90,
            title: `Modification outside approved directory scope`,
            evidence: `File modified: ${normalizedPath}`,
            explanation: `The file '${normalizedPath}' is outside the authorized directories: [${allowedPaths.join(', ')}].`,
            suggestedFix: `Restrict modifications to the approved paths or update the task scope permission.`,
            timestamp: Date.now(),
            status: 'ACTIVE'
          });
        }
      }
    }

    return findings;
  }
}

