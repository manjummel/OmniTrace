import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ASTParser } from '../src/analyzer/ASTParser.js';
import { ProjectGraph } from '../src/analyzer/ProjectGraph.js';
import { AgentCoordinator } from '../src/agents/AgentCoordinator.js';
import type { PolicyConfig } from '../src/types/index.js';

describe('Agent: Agent Coordinator & Safety Policy Enforcement', () => {
  let project: Project;
  let graph: ProjectGraph;
  let coordinator: AgentCoordinator;

  beforeEach(() => {
    const parser = new ASTParser();
    project = parser.getProject();
    graph = new ProjectGraph();
    coordinator = new AgentCoordinator(project, graph);
  });

  it('should evaluate proposed changes and block hardcoded secrets', () => {
    const policy: PolicyConfig = {
      blockOnCritical: true,
      quarantineScopeViolations: true,
      failOnHardcodedSecrets: true,
      failOnDeletedTests: true,
      maxAllowedImpactScore: 80,
      allowedModificationPaths: ['src/'],
      ignoredPaths: []
    };

    const secretEdit = coordinator.inspectProposedChange({
      tool: 'Edit',
      filePath: 'src/config.ts',
      newContent: 'export const secret = "AKIA1234567890ABCDEF";',
      taskDescription: 'Add configuration'
    }, policy);

    expect(secretEdit.action).toBe('block');
    expect(secretEdit.reason).toContain('Hardcoded secret');
  });

  it('should permit clean proposed changes', () => {
    const policy: PolicyConfig = {
      blockOnCritical: true,
      quarantineScopeViolations: true,
      failOnHardcodedSecrets: true,
      failOnDeletedTests: true,
      maxAllowedImpactScore: 80,
      allowedModificationPaths: ['src/'],
      ignoredPaths: []
    };

    const cleanEdit = coordinator.inspectProposedChange({
      tool: 'Edit',
      filePath: 'src/utils.ts',
      newContent: 'export function square(n: number): number { return n * n; }',
      taskDescription: 'Add square utility function'
    }, policy);

    expect(cleanEdit.action).toBe('allow');
    expect(cleanEdit.findings.length).toBe(0);
  });
});
