import React, { useState } from 'react';
import { FileCode, Search, Flame, ExternalLink, Box, Layers, FileCheck } from 'lucide-react';
import type { ProjectGraphData } from '@blast-radius/core';

interface RepoExplorerProps {
  graphData: ProjectGraphData | null;
  onSelectNode: (nodeId: string) => void;
  onNavigate: (tab: string) => void;
}

export const RepoExplorer: React.FC<RepoExplorerProps> = ({
  graphData,
  onSelectNode,
  onNavigate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState('all');

  const filteredNodes = (graphData?.nodes || []).filter((n) => {
    const matchSearch =
      n.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.filePath.toLowerCase().includes(searchTerm.toLowerCase());
    const matchKind = kindFilter === 'all' || n.kind === kindFilter;
    return matchSearch && matchKind;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="bg-surface border border-border p-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            Repository Symbol & File Explorer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Indexed AST declarations, public interfaces, and caller counts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search symbols or files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-elevated text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded border border-border focus:outline-none focus:border-primary font-mono w-56"
            />
          </div>

          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="bg-surface-elevated text-xs text-slate-300 px-2.5 py-1.5 rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="all">All Declarations</option>
            <option value="file">Files Only</option>
            <option value="function">Functions Only</option>
            <option value="class">Classes Only</option>
            <option value="test">Test Suites</option>
          </select>
        </div>
      </div>

      {/* Symbols Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-surface-elevated/80 border-b border-border text-slate-400">
              <th className="py-3 px-4">Symbol / Declaration</th>
              <th className="py-3 px-4">Kind</th>
              <th className="py-3 px-4">File Location</th>
              <th className="py-3 px-4 text-center">Exported</th>
              <th className="py-3 px-4 text-center">Callers</th>
              <th className="py-3 px-4 text-right">Blast Radius</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredNodes.map((node) => (
              <tr
                key={node.id}
                className="hover:bg-surface-elevated/40 transition cursor-pointer"
                onClick={() => {
                  onSelectNode(node.id);
                  onNavigate('graph-2d');
                }}
              >
                <td className="py-2.5 px-4 font-bold text-slate-200 flex items-center gap-2">
                  {node.kind === 'file' ? (
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  ) : node.kind === 'class' ? (
                    <Box className="w-3.5 h-3.5 text-purple-400" />
                  ) : node.kind === 'test' ? (
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{node.label}</span>
                </td>
                <td className="py-2.5 px-4 text-slate-400 capitalize">{node.kind}</td>
                <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">{node.filePath}:{node.line}</td>
                <td className="py-2.5 px-4 text-center">
                  {node.isExported ? (
                    <span className="text-emerald-400 font-bold">YES</span>
                  ) : (
                    <span className="text-slate-500">NO</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-center font-bold text-slate-200">
                  {node.metrics.incomingCallsCount}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      node.metrics.blastRadiusScore >= 80
                        ? 'bg-rose-500/20 text-rose-300'
                        : node.metrics.blastRadiusScore >= 50
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {node.metrics.blastRadiusScore} pts
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className="text-primary hover:underline flex items-center justify-center gap-1">
                    Trace <ExternalLink className="w-3 h-3" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

