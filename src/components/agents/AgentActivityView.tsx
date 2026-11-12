import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, Shield, Clock, Terminal } from 'lucide-react';

interface HookAuditRecord {
  id: string;
  timestamp: string;
  tool: string;
  file: string;
  action: 'allow' | 'warn' | 'block';
  reason: string;
  latencyMs: number;
}

const SAMPLE_HOOK_LOGS: HookAuditRecord[] = [
  {
    id: 'evt-101',
    timestamp: 'Just now',
    tool: 'Edit',
    file: 'src/services/payment.ts',
    action: 'block',
    reason: 'Blocked: Hardcoded secret (OpenAI Key) and missing export calculateTaxRate detected.',
    latencyMs: 142
  },
  {
    id: 'evt-102',
    timestamp: '2 mins ago',
    tool: 'Write',
    file: 'test/payment.test.ts',
    action: 'block',
    reason: "Blocked: Test Guardian detected 'it.only' exclusive focus flag.",
    latencyMs: 88
  },
  {
    id: 'evt-103',
    timestamp: '5 mins ago',
    tool: 'Edit',
    file: 'package-lock.json',
    action: 'warn',
    reason: 'Warning: Scope Guard flagged unexpected lockfile modification outside prompt scope.',
    latencyMs: 64
  },
  {
    id: 'evt-104',
    timestamp: '12 mins ago',
    tool: 'Edit',
    file: 'src/utils/math.ts',
    action: 'allow',
    reason: 'Passed: AST verified, zero findings, localized impact score (18/100).',
    latencyMs: 95
  }
];

export const AgentActivityView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            AI Coding Agent PreToolUse Interception Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit stream of Claude Code, Cursor, and MCP tool call inspections before disk modification.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/60 px-3 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Interception Hook Active</span>
        </div>
      </div>

      <div className="space-y-3">
        {SAMPLE_HOOK_LOGS.map((record) => (
          <div
            key={record.id}
            className="bg-surface border border-border rounded-lg p-4 font-mono text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-start md:items-center gap-3">
              <div
                className={`p-2 rounded-md ${
                  record.action === 'block'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : record.action === 'warn'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {record.action === 'block' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : record.action === 'warn' ? (
                  <Shield className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 uppercase">{record.action}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-primary font-semibold">{record.tool}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-slate-300 font-bold">{record.file}</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">{record.reason}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-500 text-[11px] shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-border">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{record.latencyMs}ms</span>
              </div>
              <span>{record.timestamp}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Integration Configuration Snippet */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="font-semibold text-slate-200 text-sm mb-2 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          Claude Code Hook Configuration (`settings.json`)
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Configure Claude Code to run Blast Radius Live before executing file-editing tools:
        </p>
        <div className="bg-[#070a0e] p-3 rounded border border-border text-xs font-mono text-emerald-400 overflow-x-auto">
          <pre>{`{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "tool == 'Edit' || tool == 'Write'",
        "command": "node ./packages/hooks/dist/index.js --tool $TOOL_NAME --file $FILE_PATH"
      }
    ]
  }
}`}</pre>
        </div>
      </div>
    </div>
  );
};

