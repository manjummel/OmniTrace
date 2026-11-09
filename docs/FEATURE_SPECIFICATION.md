# Blast Radius Live — Detailed Feature Specifications

This document defines the exact processing logic, inputs, outputs, failure modes, security guarantees, and acceptance criteria for all system components.

---

## FEATURE 1: Live Repository Graph

### 1.1 Purpose
Build and maintain an in-memory, bi-directional static dependency and call graph representing the repository's files, exports, functions, classes, and cross-file calls, with incremental re-indexing upon filesystem change events.

### 1.2 User Story
*As a developer or reviewer, I want to see the architectural structure of my project and visually track which downstream symbols and files are affected by a modified file or function in real time.*

### 1.3 Input
- File system path to the target repository.
- File change events: `{ filePath: string, event: 'add' | 'change' | 'unlink', content?: string }`.
- Configuration: ignore patterns (`node_modules`, `dist`, `.git`), TSConfig path.

### 1.4 Processing Logic
1. **Source Discovery**: Scan project root for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files.
2. **AST Parsing**: Initialize `ts-morph` `Project`. Parse source files into an AST.
3. **Symbol & Export Extraction**:
   - Extract declared top-level functions, classes, interfaces, and variable exports.
   - For each symbol, capture `{ name, kind, line, col, isExported }`.
4. **Import & Call Resolution**:
   - Resolve `import ... from '...'` statements to concrete project files or external packages.
   - For call expressions `foo(...)` or `obj.method(...)`, determine the definition node via TypeScript type checker.
   - Mark unresolved or dynamic calls (e.g. `import(expr)` or `eval`) with `confidence: 'uncertain'`.
5. **Graph Construction**:
   - Nodes: `{ id, label, kind: 'file' | 'function' | 'class', path, line, loc, metrics }`.
   - Edges: `{ source, target, type: 'imports' | 'calls' | 'instantiates', confidence: 'exact' | 'uncertain' }`.
6. **Incremental Update**: When a single file changes, re-parse only that file AST, re-bind its edges, and recalculate affected paths without rescanning the whole repo.

### 1.5 Output
- Graph Data Model: `{ nodes: GraphNode[], edges: GraphEdge[], lastUpdated: number }`.
- Downstream impact list for any queried node ID.

### 1.6 UI Behavior
- 2D React Flow canvas with custom nodes (badges for functions, classes, file types, risk colors).
- Clicking a node highlights its direct callers (yellow) and transitive downstream blast radius (orange/red).
- Node inspection panel displays file path, line numbers, exports, and incoming/outgoing edge lists.
- Search bar filters nodes by name or file path.

### 1.7 Acceptance Criteria & Test Cases
- **TC-G1**: Correctly identifies imports from relative paths `./utils` and `../services`.
- **TC-G2**: Correctly identifies function calls across files and assigns edge type `calls`.
- **TC-G3**: Flags dynamic imports as `uncertain` confidence.
- **TC-G4**: Incremental file modification updates only the target node and its direct connections in `< 200ms`.

---

## FEATURE 2: Reality Check Agent

### 2.1 Purpose
Detect references to non-existent imports, missing exports, mismatched parameter counts, and invalid method invocations introduced by AI coding agents.

### 2.2 Processing Logic
1. Inspect AST of modified or newly added files.
2. Check every `ImportDeclaration`:
   - Verify if the module specifier resolves to an installed package in `node_modules` or a local file.
   - For named imports `import { x } from './foo'`, verify that `foo` actually exports symbol `x`.
3. Check every `CallExpression`:
   - Resolve target function signature.
   - Compare argument count against minimum required and maximum permitted parameters.
   - Flag invocations with insufficient arguments or missing required positional arguments.
4. Compiler Diagnostic Collection: Capture TypeScript semantic diagnostics (`ts.DiagnosticCategory.Error`) relevant to identifier resolution (e.g., TS2304 "Cannot find name", TS2307 "Cannot find module", TS2305 "Module has no exported member", TS2554 "Expected N arguments, but got M").

### 2.3 Output Finding Structure
```json
{
  "id": "rc-1718000000-1",
  "agent": "Reality Check",
  "file": "src/services/payment.ts",
  "line": 42,
  "severity": "CRITICAL",
  "confidence": 0.98,
  "title": "Non-existent export 'calculateTaxRate' imported from './tax'",
  "evidence": "import { calculateTaxRate } from './tax';",
  "explanation": "File './tax.ts' exports 'getTaxRate' and 'TAX_TABLE', but does not export 'calculateTaxRate'. This will crash at runtime.",
  "suggestedFix": "Change import to: import { getTaxRate } from './tax';"
}
```

---

## FEATURE 3: Hardcode Hunter Agent

### 3.1 Purpose
Prevent AI agents and developers from committing hardcoded API keys, JWTs, private keys, database URLs, AWS secrets, or hardcoded absolute OS paths.

### 3.2 Processing Logic
1. **Regex Pattern Matcher**:
   - AWS Keys (`AKIA[0-9A-Z]{16}`)
   - GitHub Personal Access Tokens (`ghp_[a-zA-Z0-9]{36}`)
   - OpenAI Keys (`sk-[a-zA-Z0-9]{32,}`)
   - Generic API Keys (`api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]`)
   - Private Keys (`-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----`)
   - Credential URLs (`https?://[^:\s]+:[^@\s]+@[a-zA-Z0-9.-]+`)
   - Hardcoded local paths (`C:\\Users\\...`, `/home/...`, `/Users/...`)
2. **Shannon Entropy Analysis**:
   - Compute Shannon entropy on string literals $> 20$ chars.
   - High entropy ($H > 4.5$) without spaces or standard dictionary words flags high probability of cryptographic secrets.
3. **Safe Redaction**:
   - Finding evidence masks the secret: `sk-proj-••••••••••••••••3aB8`.
   - Never write raw secret to disk, logs, or Firebase.

---

## FEATURE 4: Scope Guard Agent

### 4.1 Purpose
Verify that file modifications made by an AI coding agent strictly align with the requested task and do not touch unrelated files, lockfiles, or configurations without authorization.

### 4.2 Processing Logic
1. Inputs:
   - User Task Intent (e.g., `"Add password reset email endpoint"`).
   - Changed Files list (`git status` or diff).
2. Semantic & Path Classification:
   - Identify sensitive files: `package-lock.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.env*`, `.github/workflows/*`.
   - Classify changed files into:
     - `IN_SCOPE`: Directly matches path patterns inferred from prompt keywords.
     - `SUSPICIOUS`: Modification to configuration or lockfile when prompt was pure feature code.
     - `OUT_OF_SCOPE`: Edits to completely unrelated modules (e.g. prompt was "fix login", but agent edited `analytics/reporter.ts`).
3. Output finding if out-of-scope files or unauthorized lockfile changes are detected.

---

## FEATURE 5: Test Guardian Agent

### 5.1 Purpose
Detect silent test degradation: deleted test blocks, skipped tests (`.skip`), focus locks (`.only`), tautological assertions, or emptied test bodies.

### 5.2 Processing Logic
1. Target test files (`*.test.ts`, `*.spec.ts`, `__tests__/*`).
2. AST traversal for:
   - `describe.only`, `it.only`, `test.only`: Flags warning that entire test suite is being suppressed.
   - `describe.skip`, `it.skip`, `xit`, `xtest`: Flags skipped tests.
   - Tautological assertions:
     - `expect(true).toBe(true)`
     - `expect(1).toBe(1)`
     - `expect(result).toBeDefined()` without further checks.
   - Empty test bodies: `it("should do something", () => {})`.
   - Test block deletion: Compare Git HEAD test AST symbol names against working tree test AST symbol names to identify deleted tests.

---

## FEATURE 6: Impact Analyst Agent

### 6.1 Purpose
Quantify the downstream blast radius when a file or function signature is changed, providing an explainable, deterministic Impact Score and dependency chain.

### 6.2 Impact Score Formula
$$\text{Score} = \min\left(100, \sum w_i \cdot f_i\right)$$
- $C_{\text{direct}}$: Direct callers count ($\times 8$ pts each)
- $C_{\text{transitive}}$: Transitive downstream callers ($\times 3$ pts each)
- $D_{\text{depth}}$: Maximum dependency graph depth ($\times 5$ pts per level)
- $P_{\text{public}}$: Is a public exported interface modified? ($+25$ pts)
- $T_{\text{affected}}$: Number of test suites referencing affected module (inversely mitigates or highlights untested paths)
- $U_{\text{uncertain}}$: Dynamic or uncertain call edges in path ($+10$ pts penalty)

### 6.3 Severity Tier
- $0 - 25$: Low Risk (Localized change, few or no callers).
- $26 - 60$: Moderate Risk (Internal module with multiple consumers).
- $61 - 85$: High Risk (Core utility or public service interface).
- $86 - 100$: Critical Blast Radius (Breaking change to widely imported primitive).

