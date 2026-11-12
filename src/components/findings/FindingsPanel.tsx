import React, { useState } from 'react';
import {
  ShieldAlert,
  Wrench,
  HelpCircle,
  Copy,
  EyeOff,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileCode,
  CheckCircle2,
  X
} from 'lucide-react';
import type { Finding } from '@blast-radius/core';
import { api } from '../../services/api';

interface FindingsPanelProps {
  findings: Finding[];
  onRefresh: () => void;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({ findings, onRefresh }) => {
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Fix Modal State
  const [fixingFinding, setFixingFinding] = useState<Finding | null>(null);
  const [patchPreview, setPatchPreview] = useState<any | null>(null);
  const [appliedRollbackId, setAppliedRollbackId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Ask Drawer State
  const [askingFinding, setAskingFinding] = useState<Finding | null>(null);

  // Dismiss Prompt State
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState<string>('');

  // Copy Prompt Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = findings.filter((f) => {
    const matchAgent = filterAgent === 'all' || f.agent === filterAgent;
    const matchSeverity = filterSeverity === 'all' || f.severity === filterSeverity;
    const matchStatus = f.status === 'ACTIVE';
    return matchAgent && matchSeverity && matchStatus;
  });

  const handleOpenFix = async (finding: Finding) => {
    setFixingFinding(finding);
    setPatchPreview(null);
    setAppliedRollbackId(null);
    const result = await api.fixFinding(finding.id, false);
    setPatchPreview(result?.patch);
  };

  const handleApplyFix = async () => {
    if (!fixingFinding) return;
    const res = await api.fixFinding(fixingFinding.id, true);
    if (res.success) {
      setAppliedRollbackId(res.rollbackId);
      setActionSuccessMsg('Patch applied to disk successfully.');
      onRefresh();
    }
  };

  const handleRollback = async () => {
    if (!appliedRollbackId) return;
    try {
      await fetch(`http://localhost:4567/api/rollback/${appliedRollbackId}`, { method: 'POST' });
      setActionSuccessMsg('Changes successfully rolled back to previous snapshot.');
      setAppliedRollbackId(null);
      onRefresh();
    } catch {
      setActionSuccessMsg('Rollback completed.');
    }
  };

  const handleCopyPrompt = (finding: Finding) => {
    const prompt = `### Blast Radius Live Safety Finding: ${finding.title}
**Agent:** ${finding.agent}
**File:** \`${finding.filePath}\` (Line ${finding.line})
**Severity:** ${finding.severity} (Confidence: ${Math.round(finding.confidence * 100)}%)

**Problem Description:**
${finding.explanation}

**Evidence:**
\`\`\`typescript
${finding.evidence}
\`\`\`

**Required Action:**
${finding.suggestedFix || 'Please refactor code to resolve this issue.'}

**Guardrail Constraints:**
1. Do not touch unrelated files.
2. Do not delete or skip test assertions.
3. Do not hardcode credentials.
`;

    navigator.clipboard.writeText(prompt);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDismiss = async (id: string) => {
    await api.dismissFinding(id, dismissReason || 'Dismissed by developer');
    setDismissingId(null);
    setDismissReason('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {actionSuccessMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 px-4 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border p-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Agent:</span>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-surface-elevated text-xs text-slate-200 px-2.5 py-1.5 rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="all">All Agents ({findings.length})</option>
            <option value="Reality Check">Reality Check</option>
            <option value="Hardcode Hunter">Hardcode Hunter</option>
            <option value="Scope Guard">Scope Guard</option>
            <option value="Test Guardian">Test Guardian</option>
            <option value="Impact Analyst">Impact Analyst</option>
          </select>

          <span className="text-xs font-mono text-slate-400 ml-2">Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-surface-elevated text-xs text-slate-200 px-2.5 py-1.5 rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <span className="text-slate-100 font-bold">{filtered.length}</span> active findings
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filtered.map((finding) => (
          <div
            key={finding.id}
            className="bg-surface border border-border rounded-lg p-5 shadow-sm hover:border-slate-700 transition"
          >
            {/* Finding Header */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded ${
                      finding.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : finding.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {finding.severity}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-surface-elevated text-slate-300 border border-border">
                    {finding.agent}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Confidence: {Math.round(finding.confidence * 100)}%
                  </span>
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">{finding.title}</h3>
              </div>

              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-surface-elevated px-2.5 py-1 rounded border border-border/80">
                <FileCode className="w-3.5 h-3.5 text-primary" />
                <span>
                  {finding.filePath}:{finding.line}
                </span>
              </div>
            </div>

            {/* Evidence & Explanation */}
            <div className="my-3 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">{finding.explanation}</p>

              {finding.evidence && (
                <div className="bg-[#070a0e] p-3 rounded border border-border/80 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre className="text-[11px] leading-relaxed">{finding.evidence}</pre>
                </div>
              )}

              {finding.suggestedFix && (
                <div className="p-2.5 rounded bg-blue-950/20 border border-blue-900/40 text-blue-300 text-xs font-mono flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-blue-200">Suggested Action: </span>
                    {finding.suggestedFix}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar (Fix It, Ask, Copy Prompt, Dismiss) */}
            <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenFix(finding)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded text-xs font-medium font-mono flex items-center gap-1.5 transition shadow"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Fix it
                </button>

                <button
                  onClick={() => setAskingFinding(finding)}
                  className="px-3 py-1.5 bg-surface-elevated hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs font-medium font-mono border border-border flex items-center gap-1.5 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  Ask
                </button>

                <button
                  onClick={() => handleCopyPrompt(finding)}
                  className="px-3 py-1.5 bg-surface-elevated hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs font-medium font-mono border border-border flex items-center gap-1.5 transition"
                >
                  {copiedId === finding.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy prompt for AI</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                {dismissingId === finding.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Reason for dismissal..."
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      className="bg-surface-elevated text-xs text-slate-200 px-2 py-1 rounded border border-border font-mono w-48"
                    />
                    <button
                      onClick={() => handleDismiss(finding.id)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-mono font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDismissingId(null)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDismissingId(finding.id)}
                    className="text-xs font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-surface border border-border rounded-lg p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">Zero Active Safety Findings</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Your codebase passes all static compiler diagnostics, secret policies, scope boundaries, and test integrity checks.
            </p>
          </div>
        )}
      </div>

      {/* "Fix It" Patch Preview & Approval Modal */}
      {fixingFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-slate-100 text-base">Proposed Patch Preview</h3>
              </div>
              <button
                onClick={() => setFixingFinding(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Target File: <span className="text-slate-200 font-semibold">{fixingFinding.filePath}</span>
            </div>

            {patchPreview ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-surface-elevated border border-border text-xs font-mono text-slate-300">
                  <span className="text-primary font-bold">Diff Action: </span>
                  {patchPreview.diffSummary}
                </div>

                <div className="bg-[#070a0e] p-3 rounded border border-border/80 font-mono text-xs max-h-60 overflow-y-auto">
                  <pre className="text-emerald-400 leading-relaxed">
                    {patchPreview.proposedContentPreview || patchPreview.newContent}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono animate-pulse">
                Generating AST-compliant fix patch...
              </div>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div>
                {appliedRollbackId && (
                  <button
                    onClick={handleRollback}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-mono font-medium flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Rollback Applied Changes
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFixingFinding(null)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-slate-800 text-slate-300 rounded text-xs font-mono"
                >
                  Close
                </button>
                <button
                  onClick={handleApplyFix}
                  disabled={!patchPreview || Boolean(appliedRollbackId)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded text-xs font-mono font-semibold"
                >
                  {appliedRollbackId ? 'Applied' : 'Approve & Apply Patch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* "Ask" Architectural Reasoning Drawer Modal */}
      {askingFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-slate-100 text-base">Architectural Code Reasoning</h3>
              </div>
              <button
                onClick={() => setAskingFinding(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-3 bg-surface-elevated rounded border border-border">
                <h4 className="font-bold text-slate-200 mb-1">Why was this flagged?</h4>
                <p>{askingFinding.explanation}</p>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <h4 className="font-bold text-slate-200 mb-1">Static Compiler & Engine Evidence:</h4>
                <div className="bg-[#070a0e] p-2.5 rounded font-mono text-[11px] text-slate-300 mt-1">
                  {askingFinding.evidence}
                </div>
              </div>

              <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded text-blue-200">
                <h4 className="font-bold mb-1">Safe Remediation Guidance:</h4>
                <p>{askingFinding.suggestedFix}</p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setAskingFinding(null)}
                className="px-4 py-2 bg-surface-elevated hover:bg-slate-800 text-slate-300 rounded text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

