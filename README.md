# OmniTrace

Deterministic code intelligence, blast radius visualization, and pre-edit safety hooks for AI coding agents. Analyzes AST changes locally in real time and integrates with Claude Code, Cursor, and MCP runtimes.

## Features

- **Static Call & Dependency Graph**: Incremental AST analysis powered by TypeScript compiler diagnostics.
- **Pre-Edit Safety Hooks**: Intercepts agent file writes before disk writes occur.
- **Deterministic Analyzers**:
  - `Reality Check`: Broken imports and mismatched parameters.
  - `Hardcode Hunter`: Secret and credential detection with auto-masking.
  - `Scope Guard`: Catches unexpected diffs outside prompt scope.
  - `Test Guardian`: Flags deleted tests, `.only` focus locks, and tautological assertions.
  - `Impact Analyst`: Traces transitive callers and calculates blast radius scores (0–100).
- **MCP Server**: Stdio tools (`impact`, `hotspots`, `findings`, `fix`).
- **Interactive UI**: 2D/3D graph visualization via React Flow and Three.js.

## Quickstart

```bash
git clone https://github.com/manjummel/OmniTrace.git
cd OmniTrace
npm install
npm test
npm run dev
```

## MCP Setup

Add to your MCP config:

```json
{
  "mcpServers": {
    "omnitrace": {
      "command": "node",
      "args": ["path/to/OmniTrace/packages/mcp/dist/index.js"]
    }
  }
}
```

## Structure

- `packages/core`: AST parser, graph engine, analyzers
- `packages/hooks`: Pre-tool interception hooks
- `packages/mcp`: MCP stdio server
- `packages/server`: WebSocket & Express sync bridge
- `src`: Graph visualizer frontend

## License

[Apache-2.0](./LICENSE)

