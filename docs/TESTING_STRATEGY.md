# Blast Radius Live — Testing Strategy & Verification Plan

## 1. Testing Philosophy
Blast Radius Live is developer infrastructure. If it reports false positives or false negatives, developers will disable it. Therefore, testing must be rigorous, deterministic, and cover real AST edge cases.

---

## 2. Test Suites & Coverage Targets

### 2.1 Unit Tests (`packages/core/test/`)
- **Target Coverage**: $\ge 90\%$ code coverage across all core modules.
- **Components Tested**:
  1. `GraphBuilder`: Parses sample TypeScript files with relative imports, barrel files (`index.ts`), dynamic imports, and circular dependencies.
  2. `RealityCheckAgent`:
     - Positives: Missing imports, wrong named exports, wrong parameter count, unexported identifiers.
     - Negatives: Valid imports, polymorphic overloads, standard library global symbols (`console`, `setTimeout`, `fetch`).
  3. `HardcodeHunterAgent`:
     - Positives: AWS access key, OpenAI API key, GitHub token, Basic Auth URL, `/Users/name/` path.
     - Negatives: Standard UUIDs, hashes, CSS classes, base64 asset strings.
     - Verification: Ensures secrets are strictly redacted in returned finding evidence.
  4. `ScopeGuardAgent`:
     - Positives: Unrequested changes to `package-lock.json`, modification to unrelated directories.
     - Negatives: Normal refactor touching directly related files.
  5. `TestGuardianAgent`:
     - Positives: `it.only(...)`, `test.skip(...)`, deleted test block, empty arrow function body, `expect(true).toBe(true)`.
     - Negatives: Well-formed assertions with multiple test cases.
  6. `ImpactAnalystAgent`:
     - Verification of Impact Score calculation, transitive depth traversal, and test file mapping.

### 2.2 Integration Tests (`packages/mcp/test/`, `packages/hooks/test/`)
- **Claude Code Hook**:
  - Test simulated `Edit` tool payload with a hardcoded secret $\to$ Hook exits with `block`.
  - Test simulated `Edit` tool payload with clean refactor $\to$ Hook exits with `allow`.
  - Test timeout simulation: hook responds within timeout threshold.
  - Test recursion detection: `BLAST_RADIUS_ACTIVE=1` returns early without infinite loop.
- **MCP Server**:
  - Initialize stdio MCP client, list tools, call `impact`, `hotspots`, `findings`, and `fix`.

### 2.3 UI & Component Tests (`src/test/`)
- 2D React Flow graph rendering and node selection.
- Findings triage panel interactions (Dismiss, Fix, Copy prompt).
- Theme toggles, search filtering, and error states.

---

## 3. Edge Cases Test Matrix

| Edge Case | Expected System Behavior | Test Identifier |
|---|---|---|
| **Circular Dependencies** (`a.ts` $\leftrightarrow$ `b.ts`) | Graph detects cycle without infinite loop; marks cycle in metrics. | `TC-EDGE-01` |
| **Dynamic Import** (`import(dynamicVar)`) | Graph creates edge with `confidence: 'uncertain'`. | `TC-EDGE-02` |
| **Empty Repository** (no `.ts`/`.js` files) | Graph initializes with 0 nodes; UI shows friendly empty state guide. | `TC-EDGE-03` |
| **Broken Syntax in File** (syntax error) | Parser captures diagnostic without crashing; displays syntax error finding. | `TC-EDGE-04` |
| **Renamed or Deleted File** | File watcher unlinks node; downstream callers update blast radius. | `TC-EDGE-05` |
| **Offline / Missing Firebase** | Operates seamlessly in local-only mode; no failed network spam. | `TC-EDGE-06` |
| **High Entropy Non-Secret** (e.g. SHA-256 hash) | Distinguishes between secret tokens and checksum hashes. | `TC-EDGE-07` |
| **Concurrent File Modifications** | Debounces file events and batches incremental AST updates. | `TC-EDGE-08` |

