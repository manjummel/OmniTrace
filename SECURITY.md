# Security Threat Modeling & Attack Surface Analysis (SECURITY.md)

**Project Name:** OmniTrace / Blast Radius Live  
**Document Version:** 1.0.0  
**Status:** Living Security Assessment & Threat Inventory  
**Target Scope:** Local Engine (`@blast-radius/core`), Local Bridge Server (`@blast-radius/server`), AI Hooks (`@blast-radius/hooks`), MCP Protocol (`@blast-radius/mcp`), and Frontend Web Dashboard (`src/`).

---

## 1. Executive Summary

OmniTrace inspects source code, builds static call graphs, computes blast radius scores, and acts as an autonomous pre-edit guardrail for AI coding agents (Claude Code, Cursor, GitHub Copilot).

Because OmniTrace possesses the capability to:
1. Intercept file modification tools via hooks,
2. Ingest arbitrary source files and diffs into an in-memory Abstract Syntax Tree (AST),
3. Execute automated file patches with rollback capabilities on the host filesystem, and
4. Expose local HTTP/WebSocket endpoints on `localhost`,

it presents distinct threat vectors spanning **arbitrary file system writes**, **Denial of Service (DoS) via crafted ASTs or RegExp**, **Cross-Site Request Forgery (CSRF) via open local CORS**, and **agent evasion/poisoning**.

This document models real-world attack vectors against OmniTrace, evaluates their exploitability, demonstrates Proofs-of-Concept (PoC), and specifies exact technical mitigations.

---

## 2. Threat Classification Matrix

| Threat ID | Vulnerability / Attack Vector | Vulnerable Component | Likelihood | Impact | Severity |
|---|---|---|---|---|---|
| **THR-01** | Arbitrary File Overwrite via Unsanitized `filePath` in Patch Engine | `@blast-radius/core` (`PatchManager`) & `@blast-radius/server` (`/api/findings/:id/fix`) | High | Critical | **CRITICAL** |
| **THR-02** | Localhost DNS Rebinding / Drive-By CSRF against Bridge API | `@blast-radius/server` (CORS wildcard `*` & unauthenticated endpoints) | High | Critical | **CRITICAL** |
| **THR-03** | AST Parser Denial-of-Service (ReDoS / Parser Exhaustion) | `@blast-radius/core` (`HardcodeHunterAgent`, `ScopeGuardAgent`, `ASTParser`) | Medium | High | **HIGH** |
| **THR-04** | Agent Guardrail Bypass via Dynamic Imports & String Obfuscation | `@blast-radius/core` (`RealityCheckAgent`, `TestGuardianAgent`) | High | High | **HIGH** |
| **THR-05** | Hook Execution Hijacking & Infinite Recursion Flaw | `@blast-radius/hooks` (`runHook` / `BLAST_RADIUS_INSPECTION`) | Medium | High | **HIGH** |
| **THR-06** | Stdio MCP Tool Injection & Arbitrary Diff Application | `@blast-radius/mcp` (`fix` tool) | Medium | High | **HIGH** |
| **THR-07** | Secret Leaks via Diagnostic & Parsing Exception Traces | `@blast-radius/core` (`ASTParser`, `AgentCoordinator`) | Low | Medium | **MEDIUM** |
| **THR-08** | In-Memory Resource Starvation via Circular Dependency Chains | `@blast-radius/core` (`ProjectGraph`) | Low | Medium | **MEDIUM** |

---

## 3. Deep-Dive Threat Analysis & Exploitation Scenarios

---

### Threat 01: Arbitrary File Overwrite & Path Traversal in Patch Engine

- **Component:** `packages/core/src/patch/PatchManager.ts` & `packages/server/src/index.ts`
- **Root Cause:**
  `PatchManager.applyPatch(patch)` performs direct write operations:
  ```typescript
  fs.writeFileSync(patch.filePath, patch.newContent, 'utf8');
  ```
  Neither `patch.filePath` nor the `finding.filePath` is validated against `projectRoot` or normalized to disallow path traversal characters (`../`).
- **Attack Scenario:**
  1. An attacker places an innocent-looking TypeScript file containing a crafted import error or comment.
  2. The attacker triggers or feeds an external finding payload into the system with:
     ```json
     {
       "id": "exploit-1",
       "filePath": "../../../.ssh/authorized_keys",
       "line": 1
     }
     ```
  3. The `/api/findings/:id/fix` endpoint or MCP `fix` tool executes `applyPatch()`, overwriting system configurations or injecting attacker SSH keys outside the project boundaries.
- **Remediation & Defense-in-Depth:**
  - Enforce strict path resolution and jail validation against `projectRoot`:
    ```typescript
    const resolvedPath = path.resolve(projectRoot, patch.filePath);
    if (!resolvedPath.startsWith(projectRoot + path.sep)) {
      throw new SecurityException("Path traversal attempt detected: target outside workspace root.");
    }
    ```

---

### Threat 02: Drive-By CSRF & Local WebSocket Hijacking via Open CORS

- **Component:** `packages/server/src/index.ts`
- **Root Cause:**
  The server starts Express with default open CORS:
  ```typescript
  this.app.use(cors()); // Allows any Origin header, including http://malicious-website.com
  ```
  And starts WebSocket without validating the `Origin` header during handshake:
  ```typescript
  this.wss = new WebSocketServer({ server: this.httpServer });
  ```
- **Attack Scenario:**
  1. A developer runs `npm run server` or `npm run dev` on port 4567.
  2. The developer visits an untrusted website (e.g. `https://attacker.com/blog.html`) while working.
  3. JavaScript on `attacker.com` sends a background `POST` request to `http://localhost:4567/api/findings/fnd-1/fix` with `{"apply": true}`.
  4. Because the browser permits the request (or bypasses simple preflight restrictions) and no authentication token/CSRF token is required, the attacker silently forces file writes or manipulates project policies.
- **Remediation & Defense-in-Depth:**
  - Restrict CORS origin strictly to trusted local origins (`http://localhost:3000`, `http://127.0.0.1:3000`).
  - Require an in-memory session token (`X-OmniTrace-Token`) generated on server startup, which must be passed in headers for all state-changing endpoints (`POST /api/*`).
  - Validate `req.headers.origin` during WebSocket `connection` upgrade.

---

### Threat 03: Regular Expression Denial-of-Service (ReDoS) & AST Memory Exhaustion

- **Component:** `packages/core/src/agents/HardcodeHunterAgent.ts` & `ScopeGuardAgent.ts`
- **Root Cause:**
  `HardcodeHunterAgent` uses complex regular expressions across untrusted file lines:
  ```typescript
  regex: /(?:[a-zA-Z]:[/\\]{1,2}(?:Users|Documents and Settings)[/\\]{1,2}[^'"\s]+|\/(?:Users|home)\/[^'"\s]+)/g
  ```
  `ScopeGuardAgent` parses task intent using tokenization that can be exploited by gigabyte-sized diffs or deeply nested repetitive string literals.
- **Attack Scenario:**
  1. A malicious PR or dependency injects an auto-generated file with 50,000 characters on a single line matching backtracking prefixes.
  2. The local watcher triggers `analyzeFile()`.
  3. Node.js thread event-loop freezes on regex execution, causing the Claude Code hook to time out and the local dev server to stop responding.
- **Remediation & Defense-in-Depth:**
  - Limit the line length analyzed by regex to $\le 1024$ characters.
  - Set a hard file size cap (e.g., skip files $> 2\text{ MB}$ or minified bundles like `*.min.js`).
  - Use regex with linear execution guarantees or safe pre-filters.

---

### Threat 04: Guardrail Evasion via Dynamic Execution & AST De-structuring

- **Component:** `packages/core/src/agents/RealityCheckAgent.ts` & `TestGuardianAgent.ts`
- **Root Cause:**
  Static AST analysis checks for explicit syntax tokens such as `it.only`, `test.skip`, `expect(true).toBe(true)`, and `import { ... }`.
- **Evasion Tactics:**
  1. **Dynamic property access:**
     ```typescript
     const suite = it;
     suite['on' + 'ly']('bypassed focus test', () => { ... });
     ```
  2. **Indirect tautologies:**
     ```typescript
     const flag = 1 === 1;
     expect(flag).toBe(Boolean(1));
     ```
  3. **Reflection-based imports:**
     ```typescript
     const mod = await import(Buffer.from("Li9ub25FeGlzdGVudA==", "base64").toString());
     ```
- **Remediation & Defense-in-Depth:**
  - Mark any dynamic property assignment on testing primitives (`it`, `test`, `describe`) as `confidence: 'uncertain'` with a medium severity finding.
  - Treat all computed call expressions on test runners as potentially suspicious.

---

### Threat 05: Hook Environment Spoofing & Recursion Bypass

- **Component:** `packages/hooks/src/index.ts`
- **Root Cause:**
  The hook checks an environment variable to prevent recursion:
  ```typescript
  if (process.env.BLAST_RADIUS_INSPECTION === '1') {
    process.exit(0);
  }
  ```
- **Attack Scenario:**
  1. An autonomous agent or script running in the terminal executes with `BLAST_RADIUS_INSPECTION=1` set globally in its process environment.
  2. All pre-edit inspection checks silently exit with status code `0`, completely turning off protection without user knowledge.
- **Remediation & Defense-in-Depth:**
  - Rather than a plain global environment variable, use a transient UUID token or process parent verification (`process.ppid`) to track legitimate internal subprocess loops.
  - Log an explicit warning whenever an inspection bypass occurs.

---

### Threat 06: MCP Tool Output Injection & Unauthorized Autonomous Commits

- **Component:** `packages/mcp/src/index.ts`
- **Root Cause:**
  The MCP `fix` tool permits applying fixes when `{ apply: true }` is supplied:
  ```typescript
  if (apply) {
    const applyResult = this.patchManager.applyPatch(patch);
    ...
  }
  ```
  If an autonomous agent is given access to MCP tools without human-in-the-loop validation, an LLM could enter an automated loop fixing issues incorrectly and altering critical business logic.
- **Remediation & Defense-in-Depth:**
  - Maintain `{ apply: true }` behind a strict configuration policy (`allowAutonomousFixes: false` by default).
  - Require the user to approve all patch diffs in the local UI or terminal prompt before committing modifications to disk.

---

## 4. Hardening Recommendations & Security Checklist

```
[ ] 1. Path Traversal Guard:
       Normalize and verify all file paths against projectRoot in PatchManager.ts.

[ ] 2. CORS & CSRF Defense:
       Lock down Express CORS to localhost/127.0.0.1 and inject a local session bearer token.

[ ] 3. WebSocket Handshake Validation:
       Verify request origin headers before accepting WebSocket connections.

[ ] 4. ReDoS & Input Sanity:
       Cap scanned file sizes (max 2 MB) and truncate line evaluation lengths (max 1024 chars).

[ ] 5. Secure Secret Masking:
       Ensure zero secret tokens are persisted to disk in .blast-radius/state.json.

[ ] 6. Safe Patch Rollback Quorum:
       Maintain atomic rollback snapshots in memory with disk write confirmation.
```

---

## 5. Security Disclosure & Reporting Vulnerabilities

If you discover a security vulnerability in OmniTrace / Blast Radius Live, please do not file a public GitHub issue. Instead:
1. Contact the maintainers directly at `security@blastradius.live` or via private repository vulnerability reporting.
2. Provide a reproducible Proof-of-Concept (PoC).
3. Coordinate a responsible disclosure timeline (standard 90-day window).

