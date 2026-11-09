# Blast Radius Live — Product Requirements Document (PRD)

**Document Version:** 1.0.0  
**Status:** Approved & Implementation-Ready  
**Author:** Principal Software Architect & Product Engineering Team  
**Last Updated:** November 2026  

---

## 1. Product Overview

### 1.1 Executive Summary
**Blast Radius Live** is a developer infrastructure tool and code intelligence engine designed to safeguard codebases against unintended, dangerous, or breaking changes introduced by autonomous AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex, etc.) and human developers.

AI coding agents can generate and alter code at superhuman speed, but they introduce new classes of software risks:
- Hallucinated or non-existent imports and APIs.
- Silent deletion or weakening of unit test assertions (`.only`, `expect(true).toBe(true)`).
- Hardcoded secrets, keys, and environment variables embedded directly in source files.
- Scope creep and rogue modifications outside the user's initial prompt (modifying lockfiles, config files, CI pipelines).
- Cascading architectural breakages across downstream callers and consumers.

Blast Radius Live observes code modifications in real time, computes static dependency graphs, detects risk using five specialized deterministic analysis agents, surfaces an interactive 2D/3D visualization of the blast radius, and directly integrates into the AI agent workflow via pre-edit interception hooks and Model Context Protocol (MCP) server endpoints.

### 1.2 Core Philosophy & Non-Negotiable Rules
1. **Local-First & Privacy Guaranteed**: Raw source code is analyzed strictly on the developer's local machine using AST parsing (TypeScript Compiler API / ts-morph). Source code is never sent to external servers or Firebase without explicit user opt-in.
2. **Deterministic Static Analysis First**: Static compiler diagnostics and AST rules are prioritized over LLM guesswork. Uncertainty is explicitly classified rather than faked.
3. **Actionable Findings**: Every finding is backed by file path, line numbers, snippet evidence, severity, confidence rating, and recommended remediation.
4. **No Phantom Integrations or Broken Controls**: Every UI button, MCP tool, and CLI hook is backed by actual executable logic.

---

## 2. Target Personas & Use Cases

### 2.1 Personas
1. **AI-Assisted Software Engineers (Claude Code / Cursor / Copilot)**: Want instant verification before allowing an agent to write multi-file edits.
2. **Tech Leads & Senior Code Reviewers**: Need an architectural overview of PR blast radius, high-risk hot spots, and dependency fan-out.
3. **DevSecOps Engineers**: Require pre-commit and pre-edit prevention of secret leakage, test ablation, and lockfile tampering.

### 2.2 Primary Workflows
- **Workflow A — Pre-Edit Interception (Claude Code Hook)**: Claude Code executes an edit tool. The Blast Radius hook inspects the proposed diff, runs the 5 agents, and allows, warns, or blocks the operation based on policy before any file is touched.
- **Workflow B — Real-Time Live Watcher & 2D/3D Dashboard**: Developer works in VS Code / Cursor while Blast Radius Live dashboard runs in another pane/window. File edits trigger instant AST incremental re-parsing, updating the dependency graph and highlighting impacted nodes in real time.
- **Workflow C — AI-Agent Introspection via MCP**: Agent uses MCP tools (`impact`, `hotspots`, `findings`, `fix`) to inspect its own potential blast radius and self-correct before presenting the final pull request.

---

## 3. Product Scope & Functional Architecture

### 3.1 Feature Matrix
| Feature | Module | Core Functionality | Status |
|---|---|---|---|
| **Live Repository Graph** | `@blast-radius/core`, UI | AST-based symbol & dependency extraction; 2D React Flow & 3D Three.js force visualization; incremental diffing | In Scope (Milestones 2, 3, 8) |
| **Reality Check Agent** | `@blast-radius/core/agents` | Detects missing imports, unresolved symbols, mismatched parameter counts, invalid member accesses | In Scope (Milestone 4) |
| **Hardcode Hunter Agent** | `@blast-radius/core/agents` | Shannon entropy & regex secret detection, credential URLs, hardcoded absolute paths, credentials redaction | In Scope (Milestone 4) |
| **Scope Guard Agent** | `@blast-radius/core/agents` | Compares git diffs with user prompt/intent; flags unexpected config, lockfile, or unrelated file changes | In Scope (Milestone 4) |
| **Test Guardian Agent** | `@blast-radius/core/agents` | Detects deleted test blocks, skipped tests (`describe.skip`, `.only`), tautological assertions (`toBe(true)`), empty tests | In Scope (Milestone 4) |
| **Impact Analyst Agent** | `@blast-radius/core/agents` | Direct & transitive caller tracing, public API break analysis, test coverage mapping, quantitative impact score | In Scope (Milestone 4) |
| **Findings Management** | `@blast-radius/ui` | Interactive finding triage, "Fix It" with patch preview & rollback, AI Prompt generator, local dismissal | In Scope (Milestone 5) |
| **Claude Code Hooks** | `@blast-radius/hooks` | PreToolUse CLI hook (`Edit`, `Write`), recursion guard, timeout guard, configurable blocking policy | In Scope (Milestone 6) |
| **MCP Server** | `@blast-radius/mcp` | Stdio MCP protocol server exposing `impact`, `hotspots`, `findings`, `fix` tools | In Scope (Milestone 6) |
| **Firebase Cloud Sync** | `@blast-radius/server`, Firebase | User auth, team project metadata, policy sync, anonymized stats (Local-first fallback default) | In Scope (Milestone 7) |
| **Spatial 3D & WebXR** | `@blast-radius/ui/graph-3d` | WebXR-ready 3D force-directed repository graph for immersive inspection | In Scope (Milestone 8, 9) |

---

## 4. Engineering Review Loops

### Review 1 — Product Completeness
- [x] All 5 agents specified with input, logic, output, evidence, and remediation.
- [x] User actions on findings defined ("Fix it", "Ask", "Copy prompt for AI", "Dismiss").
- [x] Integration mechanisms for Claude Code (PreToolUse hook) and MCP specified.
- [x] Clear separation between Local-First runtime (works 100% offline) and optional Firebase cloud sync.
- [x] Transparent Impact Score formula with documented weighted factors.

### Review 2 — Architecture and Security
- [x] Local analysis engine executes entirely on developer machine; zero raw code exfiltration.
- [x] Safe secret redaction: hardcoded credentials detected by Hardcode Hunter are masked before display or logging.
- [x] Infinite recursion guard for hooks: execution environment variables `BLAST_RADIUS_INSPECTION=1` prevent hook loops.
- [x] Incremental AST graph updates avoid full repository rescanning on single file modifications.
- [x] Strict input schema validation for all MCP tool invocations.

### Review 3 — Implementation Readiness
- [x] Dependencies verified: Node v24 LTS compatible, TypeScript strict mode, ts-morph, @modelcontextprotocol/sdk, React Flow, Three.js / R3F.
- [x] Monorepo workspace configuration structured with shared types and modular packages.
- [x] Vitest suite planned for unit and integration testing of AST analyzers and agents.
- [x] Graceful degradation: If Firebase credentials are not provided, UI displays local-only mode seamlessly with no console errors or mock data masquerading as real sync.

---

## 5. Open Technical Decisions & Resolutions

1. **AST Engine Choice**:
   - *Option A*: Babel parser. (Lacks full cross-file type resolution).
   - *Option B*: TypeScript Compiler API with `ts-morph`. (Provides full symbol binding, cross-file references, type diagnostics, and node navigation).
   - *Resolution*: Adopt `ts-morph` and native `typescript` for deterministic static analysis.
2. **Hook Execution Strategy**:
   - *Resolution*: Node.js CLI binary (`blast-radius hook`) designed to receive Claude Code JSON payload via stdin or arguments, returning exit code 0 (allow), 1 (block), or warning JSON payload on stdout.
3. **Graph Rendering Performance**:
   - *Resolution*: React Flow handles up to 1,000 nodes smoothly in 2D. 3D force graph uses Three.js instanced meshes or WebGL node points to handle larger codebases efficiently.

