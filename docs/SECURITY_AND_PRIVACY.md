# Blast Radius Live — Security and Privacy Architecture

## 1. Core Security & Privacy Principles

1. **Source Code Sovereignty**: Your codebase never leaves your local workstation by default. AST parsing, call graph calculation, and agent evaluations are performed entirely in local Node.js memory.
2. **Deterministic Redaction**: Any secret detected by the Hardcode Hunter Agent is masked before it is stored in findings history, displayed in the web UI, or transmitted over local IPC.
3. **No Phantom Cloud Dependencies**: Blast Radius Live runs 100% offline without requiring internet access or cloud tokens.
4. **Agent Sandboxing & Recursion Guards**: PreToolUse hooks enforce strict execution bounds to avoid denial-of-service through recursive agent calls or hanging processes.

---

## 2. Hardcoded Secret Redaction Policy

When Hardcode Hunter identifies credentials, secrets, or access tokens:
- **Display Redaction**: The secret is replaced with a masked format preserving only the prefix and suffix (e.g. `sk-proj-••••••••••••••••••••3x9Q`).
- **Memory Redaction**: Full secret strings are wiped from finding objects before serializing to disk or syncing to optional cloud backends.
- **Log Sanitation**: Standard output and error logs never contain raw captured credentials.

---

## 3. Claude Code Hook & PreToolUse Security

### 3.1 Infinite Recursion Prevention
When a Claude Code hook executes Blast Radius Live, an environment flag is injected:
```bash
BLAST_RADIUS_INSPECTION=1
```
Any subsequent child process or tool invocation inspecting the file checks this variable. If present, it bypasses re-hooking to prevent circular invocation loops.

### 3.2 Timeouts & Fail-Safe Defaults
- **Timeout Threshold**: PreToolUse hook commands have a strict hard timeout of `3000ms`.
- **Fail-Safe Mode**: If the hook process encounters an unhandled exception or times out, it logs a clear warning and defaults to `action: 'warn'` (or user-configured policy: `fail-open` vs `fail-closed`).
- **Transparent Audit**: Every hook decision outputs structured JSON to standard error/log containing decision rationale, timestamp, and active policy.

---

## 4. Model Context Protocol (MCP) Permissions

The Blast Radius MCP server operates via `stdio` communication:
- **Read-Only Inspection**: Tools `impact`, `hotspots`, and `findings` are strictly read-only and make zero file modifications.
- **Interactive Patch Approval (`fix`)**: The `fix` tool only proposes unified diff patches. It requires explicit boolean parameter `apply: true` and will only write to the target file if the local policy `allowAutonomousFixes` is explicitly enabled.

---

## 5. Firebase Access Control & Security Rules

For optional cloud synchronization:
- Cloud Firestore rules enforce strict owner-only access: `request.auth.uid == resource.data.ownerId`.
- No proprietary code content is allowed in Firestore documents; documents are strictly limited to anonymized metrics, counts, and policy definitions.
- Admin SDK secrets or service account keys are never packaged or exposed in frontend code bundles.

