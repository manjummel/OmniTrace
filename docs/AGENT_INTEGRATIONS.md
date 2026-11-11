# Blast Radius Live — Coding Agent Integration Architecture & Adapters

Blast Radius Live provides native integrations and adapters across AI coding agent environments: **Claude Code**, **Cursor**, and **GitHub Copilot**.

---

## 1. Integration Capability Matrix

| Feature | Claude Code | Cursor | GitHub Copilot |
|---|---|---|---|
| **PreToolUse Interception** | Supported (via PreToolUse CLI hook) | Partial (via MCP approval prompt or workspace save listener) | Not supported in Copilot Chat; supported via pre-commit Git hook |
| **Model Context Protocol (MCP)** | Supported (Stdio transport) | Supported (Cursor MCP config) | In development by GitHub |
| **Real-time Live Watcher** | Supported (Background file watcher) | Supported (Background file watcher) | Supported (Background file watcher) |
| **Automated Patch Remediation** | Supported (via `fix` tool) | Supported (via `fix` tool) | Supported via CLI / Patch manager |

---

## 2. Claude Code Integration

### 2.1 PreToolUse Interception Hook
Configure `~/.claude/settings.json` or `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "tool == 'Edit' || tool == 'Write'",
        "command": "node ./packages/hooks/dist/index.js --tool $TOOL_NAME --file $FILE_PATH"
      }
    ]
  }
}
```

### 2.2 Behavior:
- When Claude proposes an edit, Blast Radius Live runs AST analysis on the virtual in-memory content.
- If a hardcoded secret, deleted test, or broken export is introduced:
  - Exit code `1`: Blocks the tool invocation.
  - Outputs actionable explanation back to Claude to prompt self-correction.
- Exit code `0`: Permits execution.

---

## 3. Cursor Integration

### 3.1 Model Context Protocol (MCP) Setup
1. In Cursor, open **Settings $\to$ Features $\to$ MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Name: `blast-radius`
4. Type: `command`
5. Command: `node /path/to/Blast radius/packages/mcp/dist/index.js`
6. Tools available in Cursor Agent:
   - `impact`: Ask Cursor *"What is the blast radius if I change calculateTaxRate?"*
   - `hotspots`: Ask Cursor *"List the top dependency hotspots in this repo."*
   - `findings`: Ask Cursor *"Check for any active safety findings before submitting PR."*
   - `fix`: Ask Cursor *"Generate and preview an automated fix for finding ID fnd-1."*

---

## 4. GitHub Copilot & Pre-Commit Hook Integration

For environments lacking PreToolUse runtime hooks, integrate via Git pre-commit:
Create `.git/hooks/pre-commit`:
```bash
#!/bin/sh
echo "[Blast Radius] Running pre-commit code safety audit..."
node ./packages/hooks/dist/index.js --task "Pre-commit verification"
if [ $? -ne 0 ]; then
  echo "Commit blocked by Blast Radius Live."
  exit 1
fi
```

