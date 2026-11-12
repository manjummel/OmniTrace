import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Compass, Flame, Layers, Eye } from 'lucide-react';
import type { ProjectGraphData, GraphNode } from '@blast-radius/core';

interface Graph3DProps {
  graphData: ProjectGraphData | null;
  onSelectNode: (nodeId: string) => void;
}

interface Node3DProps {
  node: GraphNode;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const NodeSphere: React.FC<Node3DProps> = ({ node, position, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const isHighRisk = node.metrics.blastRadiusScore >= 80;
  const isMediumRisk = node.metrics.blastRadiusScore >= 50 && node.metrics.blastRadiusScore < 80;

  const color = isHighRisk
    ? '#ef4444'
    : isMediumRisk
    ? '#f59e0b'
    : node.kind === 'file'
    ? '#3b82f6'
    : '#8b5cf6';

  useFrame((state) => {
    if (meshRef.current) {
      if (hovered || isSelected) {
        meshRef.current.scale.setScalar(1.4 + Math.sin(state.clock.getElapsedTime() * 4) * 0.1);
      } else {
        meshRef.current.scale.setScalar(1.0);
      }
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.2}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Floating 3D Label */}
      <Text
        position={[0, 0.9, 0]}
        fontSize={0.3}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>

      {/* Hover Card */}
      {hovered && (
        <Html position={[0, 1.4, 0]} center>
          <div className="bg-surface/95 backdrop-blur border border-border px-3 py-2 rounded shadow-2xl text-xs font-mono pointer-events-none min-w-[160px] text-left">
            <div className="font-bold text-slate-100 flex items-center justify-between">
              <span>{node.label}</span>
              <span className="text-primary font-mono">{node.metrics.blastRadiusScore} pts</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">{node.filePath}</div>
            <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
              <span>Callers: {node.metrics.incomingCallsCount}</span>
              <span className="uppercase">{node.metrics.riskTier}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export const Graph3DView: React.FC<Graph3DProps> = ({ graphData, onSelectNode }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Layout nodes in a 3D spherical / orbital layout
  const { nodePositions, edgesWithCoords } = useMemo(() => {
    if (!graphData) return { nodePositions: new Map(), edgesWithCoords: [] };

    const positions = new Map<string, [number, number, number]>();
    const nodes = graphData.nodes;
    const count = nodes.length;
    const radius = Math.max(8, count * 1.2);

    nodes.forEach((node, idx) => {
      // Golden spiral distribution on sphere
      const phi = Math.acos(-1 + (2 * idx) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      positions.set(node.id, [x, y, z]);
    });

    // Edges with exact 3D start and end coordinates
    const edgeCoords: Array<{ id: string; start: [number, number, number]; end: [number, number, number] }> = [];
    graphData.edges.forEach((edge) => {
      const start = positions.get(edge.source);
      const end = positions.get(edge.target);
      if (start && end) {
        edgeCoords.push({ id: edge.id, start, end });
      }
    });

    return { nodePositions: positions, edgesWithCoords: edgeCoords };
  }, [graphData]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectNode(id);
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] bg-[#07090e] rounded-lg border border-border overflow-hidden">
      {/* 3D View HUD */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-surface/85 backdrop-blur border border-border px-3 py-2 rounded-lg text-xs font-mono">
        <Compass className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '12s' }} />
        <span className="text-slate-200">Interactive 3D Dependency Matrix</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">OrbitControls: Drag to rotate · Scroll to zoom</span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-surface/85 backdrop-blur border border-border px-3 py-2 rounded-lg text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-slate-300">WebXR Ready (Meta Quest / Vision)</span>
      </div>

      <Canvas camera={{ position: [0, 0, 24], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[20, 20, 20]} intensity={1.2} />
        <pointLight position={[-20, -20, -20]} color="#3b82f6" intensity={0.6} />

        {/* Render 3D Edges as Lines */}
        {edgesWithCoords.map((edge) => {
          const points = [new THREE.Vector3(...edge.start), new THREE.Vector3(...edge.end)];
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

          return (
            <primitive
              key={edge.id}
              object={new THREE.Line(
                lineGeometry,
                new THREE.LineBasicMaterial({ color: '#1e293b', transparent: true, opacity: 0.6 })
              )}
            />
          );
        })}

        {/* Render 3D Nodes */}
        {graphData?.nodes.map((node) => {
          const pos = nodePositions.get(node.id) || [0, 0, 0];
          return (
            <NodeSphere
              key={node.id}
              node={node}
              position={pos}
              isSelected={node.id === selectedId}
              onSelect={handleSelect}
            />
          );
        })}

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
};

