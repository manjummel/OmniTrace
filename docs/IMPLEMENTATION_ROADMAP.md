# Blast Radius Live — Implementation Roadmap

This roadmap organizes the development into nine verifiable, incremental engineering milestones.

---

## Milestone 1: Workspace Architecture & Shared Types
- **Goal**: Initialize monorepo structure, TypeScript configuration, package dependency management, and shared data contracts.
- **Deliverables**:
  - Root `package.json` with workspace configuration.
  - Package `@blast-radius/core`: Base types (`GraphNode`, `GraphEdge`, `Finding`, `Policy`).
  - TypeScript strict configuration across all packages.
  - Vitest test harness setup.
- **Verification**: `npm test` runs with zero failures; shared types compile cleanly.

---

## Milestone 2: AST Scanner, Dependency Extractor & Call Graph
- **Goal**: Implement deterministic static analysis engine using `ts-morph` and the TypeScript Compiler API.
- **Deliverables**:
  - `SourceScanner`: File tree traversal with ignore patterns.
  - `ASTParser`: Extracts symbols, functions, classes, exports, and imports.
  - `CallGraphBuilder`: Computes cross-file caller/callee references.
  - `ProjectGraph`: Bi-directional in-memory graph with query methods (`getCallers`, `getDownstreamImpact`).
- **Verification**: Unit tests parsing sample multi-file TypeScript fixtures verify 100% accurate node & edge creation.

---

## Milestone 3: Live 2D Interactive Call Graph
- **Goal**: Build interactive 2D graph interface in React using React Flow.
- **Deliverables**:
  - React Flow graph canvas with custom node components (File, Function, Class).
  - Dynamic node status indicators (Modified, Impacted, Normal).
  - Search & filter bar for nodes and file paths.
  - Side drawer showing node details, signature, exports, callers, and blast radius chain.
- **Verification**: Browser component render test verifies node selection, path highlight, and search filtering.

---

## Milestone 4: Five Specialized Analysis Agents
- **Goal**: Implement and test the 5 deterministic inspection agents.
- **Deliverables**:
  - **Reality Check**: Detects non-existent imports, missing exports, and argument count mismatches.
  - **Hardcode Hunter**: High-entropy string detector and secret regex rules with safe redaction.
  - **Scope Guard**: Detects out-of-scope files, unauthorized lockfile edits, and config tampering.
  - **Test Guardian**: Detects deleted tests, `.only`, `.skip`, empty test bodies, and tautological assertions.
  - **Impact Analyst**: Calculates blast radius depth, caller counts, and mathematical Impact Score.
- **Verification**: Comprehensive unit test suite with positive & negative test cases for each agent.

---

## Milestone 5: Findings Management & Remediation Engine
- **Goal**: End-to-end triage interface for findings with actionable developer controls.
- **Deliverables**:
  - Findings list and detail view with code evidence and explanations.
  - **"Fix It"**: Generates AST-based diff patch, displays preview, and permits 1-click apply & rollback.
  - **"Ask"**: Generates local contextual explanation of finding evidence.
  - **"Copy Prompt for AI"**: Produces structured markdown prompt containing exact file paths, errors, and constraints.
  - **"Dismiss"**: Records local dismissal with reason and avoids re-triggering unless file changes meaningfully.
- **Verification**: Patch generation and rollback verified via integration tests.

---

## Milestone 6: Claude Code Integration & MCP Server
- **Goal**: Pre-edit interception hook for Claude Code and official MCP server for agent self-introspection.
- **Deliverables**:
  - `PreToolUse` hook CLI script (`blast-radius hook`): Intercepts `Edit` and `Write` tool calls, validates proposed content, enforces safety policies, avoids recursion.
  - MCP Server (`@blast-radius/mcp`): Exposes `impact`, `hotspots`, `findings`, and `fix` tools over stdio.
  - Detailed integration guide and config snippets for `settings.json`.
- **Verification**: Hook test simulating Claude Code tool payload verifies `allow`, `warn`, and `block` actions. MCP tools validated via MCP client test.

---

## Milestone 7: Local Server & Optional Firebase Cloud Sync
- **Goal**: Local Express/WebSocket server bridging engine to UI; optional Firebase configuration.
- **Deliverables**:
  - Express + WebSocket server (`@blast-radius/server`) streaming file events and findings.
  - Firestore security rules (`firestore.rules`) and optional sync service.
  - Graceful degradation: Seamless operation when Firebase credentials are omitted.
- **Verification**: Server start, WebSocket connection test, API endpoint validation.

---

## Milestone 8: 3D Spatial Dependency Graph & Heatmap
- **Goal**: Immersive 3D force-directed repository graph and risk heatmap.
- **Deliverables**:
  - Three.js / React Three Fiber 3D graph canvas with node interaction and particle paths.
  - Interactive Heatmap view grouping risk by module and directory.
  - WebXR spatial navigation exploration readiness.
- **Verification**: 3D canvas render and interactive node selection verification.

---

## Milestone 9: Cursor/Copilot Adapters & Final End-to-End QA
- **Goal**: Adapters for other coding agents, full end-to-end testing, documentation finalization.
- **Deliverables**:
  - Cursor & GitHub Copilot integration adapters and event normalization docs.
  - Full project test suite execution (Vitest, lint, typecheck).
  - Living `docs/PROGRESS.md` update.
  - Final root `README.md` and distribution bundle.
- **Verification**: Full test suite passes; production build succeeds without warnings.

