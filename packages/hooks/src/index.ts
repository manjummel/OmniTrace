#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Project } from 'ts-morph';
import { ProjectGraph } from '@blast-radius/core';
import { AgentCoordinator } from '@blast-radius/core';
import type { PolicyConfig, HookInspectionRequest } from '@blast-radius/core';

// 1. Recursion Guard
if (process.env.BLAST_RADIUS_INSPECTION === '1') {
  // Already in an inspection sub-process; allow to avoid recursion
  process.exit(0);
}
process.env.BLAST_RADIUS_INSPECTION = '1';

// Default policy
const defaultPolicy: PolicyConfig = {
  blockOnCritical: true,
  quarantineScopeViolations: true,
  failOnHardcodedSecrets: true,
  failOnDeletedTests: true,
  maxAllowedImpactScore: 80,
  allowedModificationPaths: [],
  ignoredPaths: ['**/node_modules/**', '**/dist/**']
};

/**
 * Parses CLI arguments or stdin payload from Claude Code
 */
async function readHookPayload(): Promise<HookInspectionRequest> {
  const args = process.argv.slice(2);
  let tool = 'Edit';
  let filePath = '';
  let newContent = '';
  let oldContent: string | undefined;
  let taskDescription = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) tool = args[++i];
    if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
    if (args[i] === '--task' && args[i + 1]) taskDescription = args[++i];
  }

  // Check if stdin has data
  if (!process.stdin.isTTY) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        tool = parsed.tool || tool;
        filePath = parsed.filePath || parsed.path || filePath;
        newContent = parsed.newContent || parsed.content || newContent;
        oldContent = parsed.oldContent;
        taskDescription = parsed.taskDescription || parsed.prompt || taskDescription;
      } else if (!newContent) {
        newContent = raw;
      }
    } catch {
      // Stdin parsing failed, fall back to file on disk
    }
  }

  if (filePath && !newContent && fs.existsSync(filePath)) {
    newContent = fs.readFileSync(filePath, 'utf8');
  }

  return { tool, filePath, newContent, oldContent, taskDescription };
}

export async function runHook(): Promise<number> {
  const timeoutMs = parseInt(process.env.BLAST_RADIUS_TIMEOUT_MS || '3000', 10);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Blast Radius inspection timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const inspectionPromise = (async () => {
    const payload = await readHookPayload();

    if (!payload.filePath || !payload.newContent) {
      // Nothing to inspect, allow
      return 0;
    }

    const project = new Project({
      compilerOptions: { allowJs: true, target: 99 }
    });
    const graph = new ProjectGraph();
    const coordinator = new AgentCoordinator(project, graph);

    const result = coordinator.inspectProposedChange(payload, defaultPolicy);

    if (result.action === 'block') {
      console.error(`\n🚨 [BLAST RADIUS BLOCKED EDIT] ${result.reason}`);
      for (const finding of result.findings) {
        console.error(`  - [${finding.severity}] ${finding.agent}: ${finding.title}`);
        console.error(`    File: ${finding.filePath}:${finding.line}`);
        console.error(`    Fix: ${finding.suggestedFix || 'Review code manually'}\n`);
      }
      return 1; // Exit with failure to block Claude Code tool execution
    }

    if (result.action === 'warn') {
      console.warn(`\n⚠️  [BLAST RADIUS WARNING] ${result.reason}`);
      for (const finding of result.findings) {
        console.warn(`  - [${finding.severity}] ${finding.agent}: ${finding.title} (${finding.filePath}:${finding.line})`);
      }
      return 0; // Allow with warning
    }

    console.log(`[Blast Radius] Proposed change passed safety checks.`);
    return 0;
  })();

  try {
    return await Promise.race([inspectionPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[Blast Radius Hook Warning] ${err.message}. Failing open to avoid blocking workflow.`);
    return 0;
  }
}

// Execute CLI when run directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runHook().then((code) => process.exit(code));
}

