import React, { useMemo } from 'react';
import { Flame, Folder, AlertTriangle, Layers } from 'lucide-react';
import type { ProjectGraphData, GraphNode } from '@blast-radius/core';

interface HeatmapProps {
  graphData: ProjectGraphData | null;
  onSelectNode: (nodeId: string) => void;
}

export const HeatmapView: React.FC<HeatmapProps> = ({ graphData, onSelectNode }) => {
  // Group nodes by directory
  const directoryGroups = useMemo(() => {
    if (!graphData) return [];

    const map = new Map<string, GraphNode[]>();
    graphData.nodes.forEach((node) => {
      const parts = node.filePath.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';

      if (!map.has(dir)) {
        map.set(dir, []);
      }
      map.get(dir)!.push(node);
    });

    return Array.from(map.entries()).map(([dir, nodes]) => {
      const avgScore = Math.round(
        nodes.reduce((acc, n) => acc + n.metrics.blastRadiusScore, 0) / nodes.length
      );
      const maxScore = Math.max(...nodes.map((n) => n.metrics.blastRadiusScore));
      return { dir, nodes, avgScore, maxScore };
    }).sort((a, b) => b.maxScore - a.maxScore);
  }, [graphData]);

  const getColorClass = (score: number) => {
    if (score >= 80) return 'bg-rose-600/80 hover:bg-rose-500 border-rose-500 text-rose-100';
    if (score >= 60) return 'bg-amber-600/80 hover:bg-amber-500 border-amber-500 text-amber-100';
    if (score >= 35) return 'bg-blue-600/70 hover:bg-blue-500 border-blue-500 text-blue-100';
    return 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-surface border border-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            Change-Impact & Risk Concentration Heatmap
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Color density maps Blast Radius score and caller coupling per directory and symbol.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></span>
            <span className="text-slate-400">Low (0-34)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-600"></span>
            <span className="text-slate-400">Moderate (35-59)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-600"></span>
            <span className="text-slate-400">High (60-79)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-600"></span>
            <span className="text-slate-400">Critical (80-100)</span>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {directoryGroups.map(({ dir, nodes, avgScore, maxScore }) => (
          <div key={dir} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-semibold text-slate-200">{dir}</span>
                <span className="text-[11px] text-slate-500 font-mono">({nodes.length} symbols)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Peak Risk:</span>
                <span className={`font-bold ${maxScore >= 80 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {maxScore} pts
                </span>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`p-2.5 rounded border cursor-pointer transition flex flex-col justify-between shadow-sm ${getColorClass(
                    node.metrics.blastRadiusScore
                  )}`}
                >
                  <div className="truncate">
                    <span className="text-xs font-mono font-bold truncate block">{node.label}</span>
                    <span className="text-[10px] opacity-75 font-mono capitalize">{node.kind}</span>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-black/20 flex items-center justify-between text-[10px] font-mono">
                    <span>Callers: {node.metrics.incomingCallsCount}</span>
                    <span className="font-bold">{node.metrics.blastRadiusScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

