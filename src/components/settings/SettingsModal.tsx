import React, { useState } from 'react';
import { Settings, Shield, Sliders, Database, CheckCircle2, Lock } from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const [blockOnCritical, setBlockOnCritical] = useState(true);
  const [failOnHardcodedSecrets, setFailOnHardcodedSecrets] = useState(true);
  const [failOnDeletedTests, setFailOnDeletedTests] = useState(true);
  const [quarantineScopeViolations, setQuarantineScopeViolations] = useState(true);
  const [maxImpactScore, setMaxImpactScore] = useState(80);
  const [savedMsg, setSavedMsg] = useState(false);

  const handleSave = () => {
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-surface border border-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Safety Policy & Guardrail Configuration
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Set enforcement thresholds for the Claude Code hook and MCP inspection server.
          </p>
        </div>

        {savedMsg && (
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-4 h-4" /> Policy Updated!
          </span>
        )}
      </div>

      {/* Policy Toggles */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Autonomous Pre-Edit Interception Rules
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Block on Hardcoded Secrets</span>
              <span className="text-[11px] text-slate-400">
                Immediately blocks edits introducing AWS keys, OpenAI tokens, JWTs, or local paths.
              </span>
            </div>
            <input
              type="checkbox"
              checked={failOnHardcodedSecrets}
              onChange={(e) => setFailOnHardcodedSecrets(e.target.checked)}
              className="w-4 h-4 text-primary rounded bg-background border-border"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Block on Deleted Tests</span>
              <span className="text-[11px] text-slate-400">
                Blocks AI coding agents from silently deleting failing unit tests or assertion blocks.
              </span>
            </div>
            <input
              type="checkbox"
              checked={failOnDeletedTests}
              onChange={(e) => setFailOnDeletedTests(e.target.checked)}
              className="w-4 h-4 text-primary rounded bg-background border-border"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Block on Critical AST Errors</span>
              <span className="text-[11px] text-slate-400">
                Blocks edits referencing non-existent modules or missing exports that cause runtime crashes.
              </span>
            </div>
            <input
              type="checkbox"
              checked={blockOnCritical}
              onChange={(e) => setBlockOnCritical(e.target.checked)}
              className="w-4 h-4 text-primary rounded bg-background border-border"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Quarantine Out-of-Scope Modifications</span>
              <span className="text-[11px] text-slate-400">
                Flags modifications touching lockfiles or CI configs when not explicitly mentioned in prompt.
              </span>
            </div>
            <input
              type="checkbox"
              checked={quarantineScopeViolations}
              onChange={(e) => setQuarantineScopeViolations(e.target.checked)}
              className="w-4 h-4 text-primary rounded bg-background border-border"
            />
          </label>
        </div>
      </div>

      {/* Threshold Slider */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          Maximum Permitted Blast Radius Score
        </h3>
        <p className="text-xs text-slate-400">
          Modifications exceeding this mathematical risk threshold will trigger mandatory developer confirmation.
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono font-semibold text-slate-300">
            <span>Threshold: {maxImpactScore} / 100</span>
            <span className={maxImpactScore >= 80 ? 'text-rose-400' : 'text-amber-400'}>
              {maxImpactScore >= 80 ? 'CRITICAL RISK ONLY' : 'STRICT AUDIT'}
            </span>
          </div>
          <input
            type="range"
            min="40"
            max="95"
            value={maxImpactScore}
            onChange={(e) => setMaxImpactScore(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Privacy Guarantee & Storage */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          Source Code Sovereignty Guarantee
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Blast Radius Live operates <strong className="text-emerald-400">100% locally</strong>. All AST parsing, call graph calculations, and agent evaluations are computed in Node.js memory on your workstation. Source files are never transmitted to cloud servers.
        </p>
        <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-border flex items-center justify-between">
          <span>Cloud Metadata Sync:</span>
          <span className="text-slate-400">Offline / Local-Only Mode</span>
        </div>
      </div>

      <div className="text-right">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded text-xs font-mono font-semibold transition shadow"
        >
          Save Policy Changes
        </button>
      </div>
    </div>
  );
};

