# OmniTrace 🛡️⚡
### *Real-Time Code Intelligence, Blast Radius Visualization & Safety Guardrails for AI Coding Agents*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-green.svg)](https://nodejs.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

OmniTrace observes code modifications in real time, deterministically maps dependency blast radiuses, catches breaking changes before they hit production, and protects codebases with pre-edit interception hooks and Model Context Protocol (MCP) integrations.

---

## 🌟 Key Features

- **Live Dependency & Call Graph**: Deterministic static mapping powered by `ts-morph` and the TypeScript Compiler API. Resolves cross-file imports, exports, functions, classes, and call hierarchies with $< 150\text{ms}$ incremental re-indexing.
- **Five Specialized Deterministic Analysis Agents**:
  1. 🔍 **Reality Check**: Detects non-existent imports, missing exported symbols, unresolved identifiers, and parameter count mismatches.
  2. 🔒 **Hardcode Hunter**: Catches hardcoded API keys, JWTs, cloud credentials, and local filesystem paths with safe in-memory redaction.
  3. 🎯 **Scope Guard**: Compares git diffs against prompt intent; flags unauthorized edits to `package-lock.json`, CI workflows, or environment files.
  4. 🧪 **Test Guardian**: Identifies deleted tests, `.only` focus locks, `.skip` flags, empty test bodies, and tautological assertions (`expect(true).toBe(true)`).
  5. 💥 **Impact Analyst**: Traces direct & downstream callers, calculates an explainable mathematical Blast Radius Score, and identifies affected test suites.
- **Pre-Edit Protection for AI Agents**: Intercepts `Edit` and `Write` actions before they touch disk, blocking high-risk modifications based on configurable safety policies.
- **Model Context Protocol (MCP) Server**: Exposes `impact`, `hotspots`, `findings`, and `fix` tools for Claude Code, Cursor, and GitHub Copilot.
- **Local-First & Privacy Guaranteed**: Runs 100% locally. Raw source code never leaves your computer.

---

## 🏗️ Repository Architecture

```text
OmniTrace/
├── docs/               # PRD, Architecture, Security, Roadmap, Decision Log
├── packages/
│   ├── core/           # AST parser, static call graph, 5 analysis agents
│   ├── mcp/            # MCP server implementation (stdio)
│   ├── hooks/          # Claude Code PreToolUse hook scripts
│   └── server/         # Express + WebSocket local server bridge
├── src/                # Modern React 18 + Vite + Tailwind UI
├── firestore.rules     # Optional Cloud Firestore security rules
└── package.json        # Workspace configuration
```

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run Tests
```bash
npx vitest run
```

### 3. Programmatic Usage Example
```typescript
import { CallGraphBuilder } from '@blast-radius/core';

// Initialize the static call graph builder for a project
const builder = new CallGraphBuilder(process.cwd());

// Perform initial repository scan and build dependency graph
const graphData = await builder.buildInitialGraph();
console.log(`Indexed ${graphData.nodes.length} nodes and ${graphData.edges.length} edges.`);

// Calculate downstream blast radius for a specific symbol or file
const report = builder.generateBlastRadiusReport('file:src/services/payment.ts');
if (report) {
  console.log(`Target: ${report.targetLabel}`);
  console.log(`Blast Radius Score: ${report.score}/100 (${report.riskTier} RISK)`);
  console.log(`Direct Callers: ${report.directCallers.length}`);
  console.log(`Transitive Impact: ${report.transitiveCallers.length} consumers affected`);
}
```

---

## 🔒 Security & Privacy by Design

- **Local-First & Offline**: All AST parsing and dependency calculations run locally in Node.js memory. Raw source code is never uploaded to external servers.
- **Deterministic**: Prioritizes compiler diagnostics and AST structures over unpredictable LLM guesswork.
- **Safe Secret Masking**: Credentials detected in source code are automatically redacted in findings, logs, and evidence payloads.

---

## 📖 Documentation

- [Product Requirements Document (PRD)](./docs/PRD.md)
- [Feature Specifications](./docs/FEATURE_SPECIFICATION.md)
- [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md)
- [Database & Storage Schema](./docs/DATABASE_SCHEMA.md)
- [Testing Strategy](./docs/TESTING_STRATEGY.md)
- [Security & Privacy](./docs/SECURITY_AND_PRIVACY.md)
- [Decision Log](./docs/DECISION_LOG.md)

---

## 📄 License
[Apache-2.0](./LICENSE) © 2026 Manjunath (manjummel)
