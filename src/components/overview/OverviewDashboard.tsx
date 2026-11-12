import React from 'react';
import {
  ShieldAlert,
  Flame,
  GitBranch,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Key,
  Shield,
  FileCheck,
  Eye,
  Activity
} from 'lucide-react';
import type { ProjectGraphData, Finding, Hotspot } from '@blast-radius/core';

interface OverviewProps {
  graphData: ProjectGraphData | null;
  findings: Finding[];
  hotspots: Hotspot[];
  onNavigate: (tab: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewProps> = ({
  graphData,
  findings,
  hotspots,
  onNavigate,
  onSelectNode
}) => {
  const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;

  const agentStats = [
    {
      name: 'Reality Check',
      icon: Eye,
      description: 'Detects hallucinated imports and broken signatures',
      count: findings.filter((f) => f.agent === 'Reality Check').length,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      name: 'Hardcode Hunter',
      icon: Key,
      description: 'Finds embedded credentials, API keys & paths',
      count: findings.filter((f) => f.agent === 'Hardcode Hunter').length,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10'
    },
    {
      name: 'Scope Guard',
      icon: Shield,
      description: 'Prevents rogue edits to lockfiles & workflows',
      count: findings.filter((f) => f.agent === 'Scope Guard').length,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      name: 'Test Guardian',
      icon: FileCheck,
      description: 'Catches deleted tests, .only, & tautological assertions',
      count: findings.filter((f) => f.agent === 'Test Guardian').length,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    {
      name: 'Impact Analyst',
      icon: Flame,
      description: 'Quantifies downstream blast radius & caller breaks',
      count: findings.filter((f) => f.agent === 'Impact Analyst').length,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if Critical Findings Exist */}
      {criticalCount > 0 && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-900/60 rounded-md text-red-300">
              <ShieldAlert className="w-6 h-6 animate-pulse text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-200">
                {criticalCount} Critical Safety {criticalCount === 1 ? 'Finding' : 'Findings'} Requiring Attention
              </h3>
              <p className="text-sm text-red-300/80">
                Pre-edit guardrails have flagged high-risk issues (missing exports, deleted tests, or exposed credentials).
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('findings')}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-sm font-medium transition shadow"
          >
            Review Findings
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Total Graph Nodes</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {graphData?.nodes.length || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {graphData?.summary.totalFiles || 0} files · {graphData?.summary.totalFunctions || 0} functions
            </p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg text-primary">
            <FileCode2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Active Call Edges</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {graphData?.edges.length || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Static caller & import dependencies</p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg text-emerald-400">
            <GitBranch className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Max Blast Radius</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              {graphData?.summary.highestImpactScore || 0}/100
            </p>
            <p className="text-xs text-slate-500 mt-1">Highest calculated single-node risk</p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg text-rose-400">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Active Findings</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {findings.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {criticalCount} critical · {highCount} high priority
            </p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Five Specialized Analysis Agents Status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Five Specialized Analysis Agents
          </h2>
          <span className="text-xs text-slate-500 font-mono">Real-Time Deterministic AST Monitoring</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {agentStats.map((agent) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.name}
                onClick={() => onNavigate('findings')}
                className="bg-surface hover:bg-surface-elevated border border-border hover:border-slate-700 rounded-lg p-4 cursor-pointer transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-md ${agent.bgColor} ${agent.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {agent.count > 0 ? (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        {agent.count}
                      </span>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <h4 className="font-medium text-slate-200 text-sm">{agent.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">{agent.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-mono font-medium">Online</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hotspots & Quick Visualizer Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hotspots List */}
        <div className="md:col-span-2 bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                Architectural Dependency Hotspots
              </h3>
              <p className="text-xs text-slate-400">Modules with highest downstream caller concentrations</p>
            </div>
            <button
              onClick={() => onNavigate('graph-2d')}
              className="text-xs text-primary hover:underline font-mono"
            >
              Open 2D Graph →
            </button>
          </div>

          <div className="divide-y divide-border/60">
            {hotspots.slice(0, 5).map((hotspot) => (
              <div
                key={hotspot.nodeId}
                onClick={() => {
                  onSelectNode(hotspot.nodeId);
                  onNavigate('graph-2d');
                }}
                className="py-3 flex items-center justify-between hover:bg-surface-elevated/40 px-2 rounded cursor-pointer transition"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      hotspot.riskTier === 'CRITICAL'
                        ? 'bg-rose-500 animate-pulse'
                        : hotspot.riskTier === 'HIGH'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  <div>
                    <span className="text-sm font-mono text-slate-200 font-medium">
                      {hotspot.label}
                    </span>
                    <span className="text-xs text-slate-500 block font-mono">
                      {hotspot.filePath}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Callers: </span>
                    <span className="text-xs font-mono font-semibold text-slate-200">
                      {hotspot.fanIn}
                    </span>
                  </div>

                  <div className="w-24 bg-surface-elevated rounded-full h-2 overflow-hidden border border-border/80">
                    <div
                      className={`h-full rounded-full ${
                        hotspot.blastRadiusScore >= 80
                          ? 'bg-rose-500'
                          : hotspot.blastRadiusScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${hotspot.blastRadiusScore}%` }}
                    />
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      hotspot.blastRadiusScore >= 80
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : hotspot.blastRadiusScore >= 50
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {hotspot.blastRadiusScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guardrail Controls Summary */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Active Safety Policies
            </h3>
            <p className="text-xs text-slate-400 mb-4">Interception policies enforced for Claude Code & MCP</p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-surface-elevated/50 border border-border/60">
                <span className="text-slate-300">Block on Hardcoded Secrets</span>
                <span className="text-emerald-400 font-mono font-semibold">ENFORCED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-elevated/50 border border-border/60">
                <span className="text-slate-300">Block on Deleted Tests</span>
                <span className="text-emerald-400 font-mono font-semibold">ENFORCED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-elevated/50 border border-border/60">
                <span className="text-slate-300">Block on Critical AST Errors</span>
                <span className="text-emerald-400 font-mono font-semibold">ENFORCED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-elevated/50 border border-border/60">
                <span className="text-slate-300">Quarantine Out-of-Scope Files</span>
                <span className="text-amber-400 font-mono font-semibold">WARN</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border">
            <button
              onClick={() => onNavigate('settings')}
              className="w-full py-2 bg-surface-elevated hover:bg-slate-800 border border-border text-slate-300 hover:text-white rounded text-xs font-medium transition"
            >
              Configure Guardrail Policies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

