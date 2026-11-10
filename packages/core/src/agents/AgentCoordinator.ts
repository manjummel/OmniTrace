import { Project, SourceFile } from 'ts-morph';
import { RealityCheckAgent } from './RealityCheckAgent.js';
import { HardcodeHunterAgent } from './HardcodeHunterAgent.js';
import { ScopeGuardAgent, type ScopeInspectionInput } from './ScopeGuardAgent.js';
import { TestGuardianAgent } from './TestGuardianAgent.js';
import { ImpactAnalystAgent } from './ImpactAnalystAgent.js';
import type { ProjectGraph } from '../analyzer/ProjectGraph.js';
import type { Finding, PolicyConfig, HookInspectionRequest, HookInspectionResponse } from '../types/index.js';

export interface ComprehensiveAnalysisResult {
  findings: Finding[];
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    byAgent: Record<string, number>;
  };
}

export class AgentCoordinator {
  private realityCheck: RealityCheckAgent;
  private hardcodeHunter: HardcodeHunterAgent;
  private scopeGuard: ScopeGuardAgent;
  private testGuardian: TestGuardianAgent;
  private impactAnalyst: ImpactAnalystAgent;

  constructor(private project: Project, private graph: ProjectGraph) {
    this.realityCheck = new RealityCheckAgent();
    this.hardcodeHunter = new HardcodeHunterAgent();
    this.scopeGuard = new ScopeGuardAgent();
    this.testGuardian = new TestGuardianAgent();
    this.impactAnalyst = new ImpactAnalystAgent(graph);
  }

  /**
   * Runs all applicable agents on a single source file
   */
  public analyzeFile(sourceFile: SourceFile, oldContent?: string): Finding[] {
    const findings: Finding[] = [];

    // 1. Reality Check
    findings.push(...this.realityCheck.analyze(sourceFile));

    // 2. Hardcode Hunter
    findings.push(...this.hardcodeHunter.analyze(sourceFile));

    // 3. Test Guardian (if test file)
    findings.push(...this.testGuardian.analyze(sourceFile, oldContent));

    // 4. Impact Analyst
    const filePath = sourceFile.getFilePath().replace(/\\/g, '/');
    const fileNodeId = `file:${filePath}`;
    const { findings: impactFindings } = this.impactAnalyst.analyze(fileNodeId);
    findings.push(...impactFindings);

    return findings;
  }

  /**
   * Runs all agents across the entire project
   */
  public analyzeProject(): ComprehensiveAnalysisResult {
    const allFindings: Finding[] = [];
    const sourceFiles = this.project.getSourceFiles();

    for (const sf of sourceFiles) {
      allFindings.push(...this.analyzeFile(sf));
    }

    return this.summarizeFindings(allFindings);
  }

  /**
   * Pre-edit inspection hook for AI coding agent edit tools
   */
  public inspectProposedChange(
    req: HookInspectionRequest,
    policy: PolicyConfig
  ): HookInspectionResponse {
    const findings: Finding[] = [];

    // 1. Scope Guard check
    const scopeFindings = this.scopeGuard.analyze({
      taskDescription: req.taskDescription,
      modifiedFiles: [req.filePath],
      allowedPaths: policy.allowedModificationPaths
    });
    findings.push(...scopeFindings);

    // 2. In-memory virtual AST evaluation
    let virtualFile: SourceFile | undefined;
    try {
      virtualFile = this.project.createSourceFile(
        `temp_inspect_${Date.now()}.ts`,
        req.newContent,
        { overwrite: true }
      );

      // Run Reality Check on new content
      findings.push(...this.realityCheck.analyze(virtualFile));

      // Run Hardcode Hunter
      findings.push(...this.hardcodeHunter.analyze(virtualFile));

      // Run Test Guardian
      findings.push(...this.testGuardian.analyze(virtualFile, req.oldContent));
    } finally {
      if (virtualFile) {
        this.project.removeSourceFile(virtualFile);
      }
    }

    // Determine decision based on policy
    let action: 'allow' | 'warn' | 'block' = 'allow';
    let reason = 'Change passed all safety evaluations.';

    const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
    const hasSecrets = findings.some((f) => f.agent === 'Hardcode Hunter');
    const hasDeletedTests = findings.some((f) => f.agent === 'Test Guardian' && f.title.includes('Deleted test'));
    const hasScopeViolation = findings.some((f) => f.agent === 'Scope Guard');

    if (policy.failOnHardcodedSecrets && hasSecrets) {
      action = 'block';
      reason = 'Blocked: Hardcoded secret detected in proposed modification.';
    } else if (policy.failOnDeletedTests && hasDeletedTests) {
      action = 'block';
      reason = 'Blocked: Test deletion detected in proposed modification.';
    } else if (policy.blockOnCritical && hasCritical) {
      action = 'block';
      reason = 'Blocked: Critical safety issue detected in proposed change.';
    } else if (policy.quarantineScopeViolations && hasScopeViolation) {
      action = 'warn';
      reason = 'Warning: Proposed edit touches files outside explicit task scope.';
    } else if (findings.length > 0) {
      action = 'warn';
      reason = `Warning: ${findings.length} issue(s) detected in proposed change.`;
    }

    return {
      action,
      reason,
      findings,
      timestamp: Date.now()
    };
  }

  private summarizeFindings(findings: Finding[]): ComprehensiveAnalysisResult {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    const byAgent: Record<string, number> = {};

    for (const f of findings) {
      if (f.severity === 'CRITICAL') critical++;
      else if (f.severity === 'HIGH') high++;
      else if (f.severity === 'MEDIUM') medium++;
      else low++;

      byAgent[f.agent] = (byAgent[f.agent] || 0) + 1;
    }

    return {
      findings,
      summary: {
        totalFindings: findings.length,
        criticalCount: critical,
        highCount: high,
        mediumCount: medium,
        lowCount: low,
        byAgent
      }
    };
  }
}

