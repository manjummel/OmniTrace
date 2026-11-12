import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  GitGraph,
  Compass,
  Flame,
  AlertTriangle,
  FolderTree,
  Activity,
  Settings,
  RefreshCw,
  LayoutDashboard,
  ShieldCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import type { ProjectGraphData, Finding, Hotspot } from '@blast-radius/core';
import { api } from './services/api';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { Graph2DView } from './components/graph-2d/Graph2DView';
import { Graph3DView } from './components/graph-3d/Graph3DView';
import { HeatmapView } from './components/heatmap/HeatmapView';
import { FindingsPanel } from './components/findings/FindingsPanel';
import { RepoExplorer } from './components/explorer/RepoExplorer';
import { AgentActivityView } from './components/agents/AgentActivityView';
import { SettingsModal } from './components/settings/SettingsModal';

type ActiveTab =
  | 'overview'
  | 'graph-2d'
  | 'graph-3d'
  | 'heatmap'
  | 'findings'
  | 'explorer'
  | 'activity'
  | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [graphData, setGraphData] = useState<ProjectGraphData | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(api.getIsDemoMode());
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const status = await api.checkServerStatus();
    setServerOnline(status.online);

    const [g, f, h] = await Promise.all([
      api.getGraph(),
      api.getFindings(),
      api.getHotspots()
    ]);

    setGraphData(g);
    setFindings(f.findings);
    setHotspots(h);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, isDemoMode]);

  const toggleDemoMode = () => {
    const next = !isDemoMode;
    setIsDemoMode(next);
    api.setIsDemoMode(next);
  };

  const activeFindingsCount = findings.filter((f) => f.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col h-screen bg-background text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center space-x-6">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="p-1.5 bg-blue-600/20 border border-blue-500/40 rounded-lg text-primary">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-100 flex items-center gap-1.5">
                Blast Radius <span className="text-primary text-[10px] font-mono px-1 py-0.2 bg-primary/20 rounded">LIVE</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">Code Intelligence & Guardrails</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'overview'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('graph-2d')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'graph-2d'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitGraph className="w-3.5 h-3.5" />
              Live 2D Graph
            </button>

            <button
              onClick={() => setActiveTab('graph-3d')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'graph-3d'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              3D Spatial Graph
            </button>

            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'heatmap'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Heatmap
            </button>

            <button
              onClick={() => setActiveTab('findings')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition relative ${
                activeTab === 'findings'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Findings
              {activeFindingsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {activeFindingsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'explorer'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              Explorer
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'activity'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Hook Log
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition ${
                activeTab === 'settings'
                  ? 'bg-surface-elevated text-primary border border-border'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Policies
            </button>
          </nav>
        </div>

        {/* Right Action Utilities */}
        <div className="flex items-center space-x-3">
          {/* Demo Mode Toggle */}
          <div
            onClick={toggleDemoMode}
            className="flex items-center gap-2 cursor-pointer bg-surface-elevated px-2.5 py-1 rounded border border-border text-xs font-mono text-slate-300 hover:text-white transition"
            title="Toggle between Live Local Workspace and Sample Payment Service Demo"
          >
            <span>{isDemoMode ? 'Sample Demo Mode' : 'Live Workspace'}</span>
            {isDemoMode ? (
              <ToggleRight className="w-4 h-4 text-primary" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-500" />
            )}
          </div>

          {/* Engine Status Pill */}
          <div className="flex items-center gap-1.5 text-xs font-mono bg-surface-elevated px-2.5 py-1 rounded border border-border">
            <span
              className={`w-2 h-2 rounded-full ${
                serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">
              {serverOnline ? 'Engine Online' : isDemoMode ? 'Demo Sandbox' : 'Engine Offline'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 bg-surface-elevated hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-border transition"
            title="Refresh repository AST and findings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <OverviewDashboard
              graphData={graphData}
              findings={findings}
              hotspots={hotspots}
              onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          )}

          {activeTab === 'graph-2d' && (
            <Graph2DView
              graphData={graphData}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          )}

          {activeTab === 'graph-3d' && (
            <Graph3DView
              graphData={graphData}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setActiveTab('graph-2d');
              }}
            />
          )}

          {activeTab === 'heatmap' && (
            <HeatmapView
              graphData={graphData}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setActiveTab('graph-2d');
              }}
            />
          )}

          {activeTab === 'findings' && (
            <FindingsPanel findings={findings} onRefresh={loadData} />
          )}

          {activeTab === 'explorer' && (
            <RepoExplorer
              graphData={graphData}
              onSelectNode={(id) => setSelectedNodeId(id)}
              onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
            />
          )}

          {activeTab === 'activity' && <AgentActivityView />}

          {activeTab === 'settings' && <SettingsModal />}
        </div>
      </main>
    </div>
  );
}

