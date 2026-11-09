# Blast Radius Live — Architecture Decision Log (ADR)

| Decision ID | Title | Date | Status |
|---|---|---|---|
| ADR-001 | TypeScript Compiler API and `ts-morph` for Static Analysis | 2026-11-09 | Accepted |
| ADR-002 | Monorepo Structure with Core, MCP, Hooks, Server, and UI | 2026-11-09 | Accepted |
| ADR-003 | Local-First Architecture with Optional Firebase Sync | 2026-11-09 | Accepted |
| ADR-004 | React Flow for 2D Graph & Three.js / R3F for 3D Graph | 2026-11-09 | Accepted |
| ADR-005 | Claude Code Hook Integration via PreToolUse CLI Script | 2026-11-09 | Accepted |
| ADR-006 | Strict In-Memory Secret Redaction Before Persistence | 2026-11-09 | Accepted |

---

### ADR-001: TypeScript Compiler API & `ts-morph`
- **Context**: Need accurate static analysis for TypeScript/JavaScript codebases, capable of resolving cross-file imports, exports, and call hierarchies without running the code.
- **Alternatives Considered**:
  - Babel Parser: Fast, but does not provide type-checker symbol binding or cross-file navigation.
  - Tree-sitter: Excellent multi-language parser, but lacks TypeScript semantic type resolution out-of-the-box.
- **Decision**: Use `ts-morph` wrapping the TypeScript Compiler API. It provides high-level AST manipulation, symbol resolution, type diagnostics, and incremental updates.
- **Consequences**: Fast, robust, and native TS support. For non-TS files in future milestones, tree-sitter bindings can be layered.

---

### ADR-002: Modular Monorepo Structure
- **Context**: The product consists of an analysis engine, MCP server, CLI/hook runners, local server, and a web dashboard.
- **Decision**: Structure as a clean npm workspace:
  - `packages/core`: Pure library for AST parsing, call graph, and the 5 agents.
  - `packages/mcp`: MCP stdio server wrapper.
  - `packages/hooks`: Claude Code and agent integration hooks.
  - `packages/server`: Express + WebSocket local server bridge.
  - `src/`: React + Vite frontend application.
- **Consequences**: Enables clean code reuse, independent unit testing, and isolated distribution.

---

### ADR-003: Local-First Architecture with Optional Firebase Sync
- **Context**: Enterprise developers cannot upload proprietary codebases to third-party clouds.
- **Decision**: All AST analysis, graph building, and agent evaluations execute locally. Cloud sync with Firebase is strictly opt-in and restricted to metadata, counts, and team policy settings.
- **Consequences**: Zero telemetry or raw code leaks. Works completely offline.

---

### ADR-004: Dual Visualization Engine (React Flow 2D + Three.js 3D)
- **Context**: Developers need both a precise, interactive 2D node-wire diagram for inspecting specific callers and an intuitive 3D spatial view for large architecture overviews.
- **Decision**: Use React Flow (`@xyflow/react`) for the 2D graph with custom node types, and Three.js with React Three Fiber (`@react-three/fiber`, `@react-three/drei`) for the 3D spatial graph.
- **Consequences**: Offers both high-precision engineering inspection and macro-level spatial comprehension.

---

### ADR-005: PreToolUse Interception Hook for Claude Code
- **Context**: Claude Code allows configuring hooks that execute before tools are executed.
- **Decision**: Implement a Node CLI command `blast-radius hook --tool Edit` that reads proposed diffs from Claude Code, passes them through the 5 agents, and yields exit code 0 (allow), exit code 1 (block), or standard output warning.
- **Consequences**: Protects against dangerous AI edits before they hit disk.

