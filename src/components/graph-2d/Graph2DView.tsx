import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  Flame,
  FileCode,
  Box,
  Layers,
  FileCheck,
  X,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import type { ProjectGraphData, BlastRadiusReport } from '@blast-radius/core';
import { api } from '../../services/api';

interface Graph2DProps {
  graphData: ProjectGraphData | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

// Custom Node Component
const CustomNode = ({ data, selected }: any) => {
  const { label, kind, metrics, filePath } = data;
  const isHighRisk = metrics?.blastRadiusScore >= 80;
  const isMediumRisk = metrics?.blastRadiusScore >= 50 && metrics?.blastRadiusScore < 80;

  const getIcon = () => {
    switch (kind) {
      case 'file': return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
      case 'class': return <Box className="w-3.5 h-3.5 text-purple-400" />;
      case 'test': return <FileCheck className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Layers className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div
      className={`px-3 py-2 rounded-lg border text-left min-w-[160px] max-w-[240px] shadow-lg transition-all ${
        selected
          ? 'ring-2 ring-primary border-primary bg-surface-elevated'
          : isHighRisk
          ? 'border-red-600/70 bg-red-950/30'
          : isMediumRisk
          ? 'border-amber-600/70 bg-amber-950/20'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 truncate">
          {getIcon()}
          <span className="text-xs font-mono font-semibold text-slate-200 truncate">
            {label}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono px-1 rounded ${
            isHighRisk
              ? 'bg-red-500/20 text-red-400'
              : isMediumRisk
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {metrics?.blastRadiusScore ?? 0}
        </span>
      </div>

      <div className="text-[10px] text-slate-400 truncate font-mono">
        {filePath}
      </div>

      <div className="mt-1.5 flex justify-between items-center text-[9px] text-slate-500 border-t border-border/40 pt-1">
        <span>Callers: {metrics?.incomingCallsCount ?? 0}</span>
        <span className="capitalize">{kind}</span>
      </div>
    </div>
  );
};

const nodeTypes = {
  customNode: CustomNode
};

export const Graph2DView: React.FC<Graph2DProps> = ({
  graphData,
  selectedNodeId,
  onSelectNode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKind, setFilterKind] = useState<string>('all');
  const [report, setReport] = useState<BlastRadiusReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Transform core graph to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    if (!graphData) return [];

    const nodes = graphData.nodes.filter((n) => {
      const matchSearch =
        n.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.filePath.toLowerCase().includes(searchTerm.toLowerCase());
      const matchKind = filterKind === 'all' || n.kind === filterKind;
      return matchSearch && matchKind;
    });

    // Simple grid / force placement algorithm
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacingX = 260;
    const spacingY = 140;

    return nodes.map((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      return {
        id: n.id,
        type: 'customNode',
        position: { x: col * spacingX + 50, y: row * spacingY + 50 },
        data: n as unknown as Record<string, unknown>,
        selected: n.id === selectedNodeId
      };
    });
  }, [graphData, searchTerm, filterKind, selectedNodeId]);

  // Transform edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!graphData) return [];

    return graphData.edges.map((e) => {
      const isConnected = selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: isConnected || e.confidence === 'uncertain',
        style: {
          stroke: isConnected
            ? '#3b82f6'
            : e.confidence === 'uncertain'
            ? '#f59e0b'
            : '#2d3b55',
          strokeWidth: isConnected ? 2.5 : 1.5,
          strokeDasharray: e.confidence === 'uncertain' ? '4 4' : undefined
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isConnected ? '#3b82f6' : '#2d3b55',
          width: 14,
          height: 14
        }
      };
    });
  }, [graphData, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update on selection
  const handleNodeClick = useCallback(
    async (_: any, node: Node) => {
      onSelectNode(node.id);
      setLoadingReport(true);
      const rep = await api.getImpactReport(node.id);
      setReport(rep);
      setLoadingReport(false);
    },
    [onSelectNode]
  );

  return (
    <div className="relative w-full h-[calc(100vh-140px)] bg-background rounded-lg border border-border overflow-hidden flex">
      {/* Graph Area */}
      <div className="flex-1 h-full relative">
        {/* Search & Filter Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-surface/90 backdrop-blur border border-border rounded-lg p-2 shadow-lg">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search symbols or files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-elevated text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded border border-border focus:outline-none focus:border-primary font-mono w-48"
            />
          </div>

          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="bg-surface-elevated text-xs text-slate-300 px-2 py-1.5 rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="all">All Kinds</option>
            <option value="file">Files</option>
            <option value="function">Functions</option>
            <option value="class">Classes</option>
            <option value="test">Tests</option>
          </select>

          <span className="text-[11px] text-slate-500 font-mono px-2">
            {nodes.length} nodes
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#192333" gap={20} size={1} />
          <Controls className="bg-surface border-border text-slate-300 fill-slate-300" />
          <MiniMap
            className="bg-surface border border-border rounded"
            nodeColor={(n: any) =>
              n.data?.metrics?.blastRadiusScore >= 80 ? '#ef4444' : '#3b82f6'
            }
          />
        </ReactFlow>
      </div>

      {/* Side Drawer: Blast Radius Impact Report */}
      {selectedNodeId && (
        <div className="w-96 bg-surface border-l border-border h-full overflow-y-auto p-4 z-20 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Blast Radius Analysis</h3>
              </div>
              <button
                onClick={() => {
                  onSelectNode(null);
                  setReport(null);
                }}
                className="p-1 hover:bg-surface-elevated rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingReport ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono animate-pulse">
                Computing AST dependency fan-out...
              </div>
            ) : report ? (
              <div className="mt-4 space-y-4">
                {/* Score Banner */}
                <div
                  className={`p-3 rounded-lg border ${
                    report.riskTier === 'CRITICAL'
                      ? 'bg-rose-950/30 border-rose-800 text-rose-200'
                      : report.riskTier === 'HIGH'
                      ? 'bg-amber-950/30 border-amber-800 text-amber-200'
                      : 'bg-blue-950/30 border-blue-800 text-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs uppercase font-mono tracking-wider font-semibold">
                        Impact Score
                      </span>
                      <h4 className="text-2xl font-bold font-mono">
                        {report.score}/100
                      </h4>
                    </div>
                    <span className="px-2 py-1 text-xs font-bold font-mono rounded bg-black/40 border border-white/10">
                      {report.riskTier} RISK
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-80">
                    Modifying '{report.targetLabel}' impacts {report.affectedFiles.length} file(s) across {report.breakdown.maxDependencyDepth} dependency levels.
                  </p>
                </div>

                {/* Score Breakdown Formula */}
                <div className="bg-surface-elevated p-3 rounded border border-border/80">
                  <h5 className="text-xs font-semibold text-slate-300 mb-2 font-mono uppercase">
                    Mathematical Score Breakdown
                  </h5>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Direct Callers ({report.breakdown.directCallersCount} × 8 pts)</span>
                      <span className="text-slate-200">+{report.breakdown.directCallersPoints}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Transitive Consumers ({report.breakdown.transitiveCallersCount} × 3 pts)</span>
                      <span className="text-slate-200">+{report.breakdown.transitiveCallersPoints}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Call Depth ({report.breakdown.maxDependencyDepth} × 5 pts)</span>
                      <span className="text-slate-200">+{report.breakdown.depthPoints}</span>
                    </div>
                    {report.breakdown.isPublicExport && (
                      <div className="flex justify-between text-slate-400">
                        <span>Public API Export</span>
                        <span className="text-slate-200">+{report.breakdown.publicExportPoints}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300 font-bold border-t border-border pt-1">
                      <span>Final Blast Radius Score</span>
                      <span className="text-primary">{report.score} pts</span>
                    </div>
                  </div>
                </div>

                {/* Direct Callers */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Direct Callers ({report.directCallers.length})
                  </h5>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {report.directCallers.map((c) => (
                      <div
                        key={c.id}
                        className="text-xs font-mono p-1.5 rounded bg-surface-elevated/50 border border-border/40 flex items-center justify-between"
                      >
                        <span className="text-slate-200 truncate">{c.label}</span>
                        <span className="text-[10px] text-slate-500">{c.kind}</span>
                      </div>
                    ))}
                    {report.directCallers.length === 0 && (
                      <p className="text-xs text-slate-500 italic">No direct callers found in static call graph.</p>
                    )}
                  </div>
                </div>

                {/* Affected Test Suites */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Affected Automated Tests ({report.affectedTests.length})
                  </h5>
                  <div className="space-y-1">
                    {report.affectedTests.map((t, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono p-1.5 rounded bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 truncate"
                      >
                        {t}
                      </div>
                    ))}
                    {report.affectedTests.length === 0 && (
                      <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Zero automated tests cover this dependency path!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Execution Path Preview */}
                {report.executionPath.length > 1 && (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                      Sample Call Chain Path
                    </h5>
                    <div className="space-y-1 text-xs font-mono text-slate-300 bg-surface-elevated p-2 rounded border border-border">
                      {report.executionPath.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1 truncate">
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-primary shrink-0" />}
                          <span className="truncate">{step.split(':').slice(-1)[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Click a node in the graph to inspect its blast radius.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
