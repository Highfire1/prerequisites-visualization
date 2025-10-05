"use client";

import React, { useCallback, useRef, useMemo } from 'react';
import type {
  Connection,
  Edge,
  OnConnect,
  OnConnectEnd,
  XYPosition,
  Node,
} from '@xyflow/react';
import {
  Background,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
// Global React Flow styles are imported once in `src/app/layout.tsx`.
 
// Custom node component rendering ECON 201 and a placeholder button for MATH 150
type EconNodeData = { code: string };

const Econ201Node: React.FC<{ data: EconNodeData }> = ({ data }) => {
  return (
    <div className="rounded-md border border-gray-300 bg-white shadow-sm px-4 py-3 flex flex-col gap-2 text-sm min-w-[180px]">
      <div className="font-semibold text-gray-800">{data.code}</div>
      <button
        type="button"
        className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
        // onClick handler intentionally omitted per requirements
      >
        MATH 150
      </button>
    </div>
  );
};

const initialNodes: Node[] = [
  {
    id: 'econ-201',
    type: 'econCourse',
    data: { code: 'ECON 201' },
    position: { x: 0, y: 50 },
  },
];
 
let id = 1;
const getId = () => `${id++}`;
const nodeOrigin = [0.5, 0];
 
const AddNodeOnEdgeDrop: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const { screenToFlowPosition } = useReactFlow();

  // Register custom node types
  const nodeTypes = useMemo(
    () => ({
      econCourse: Econ201Node,
    }),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        const id = getId();
        const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
        const position: XYPosition = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
        const newNode: Node = {
          id,
            position,
            data: { label: `Node ${id}` },
            origin: [0.5, 0.0],
            type: 'default'
        };
        setNodes((nds) => nds.concat(newNode));
        if (connectionState.fromNode?.id) {
          setEdges((eds) => eds.concat({ id: `${connectionState.fromNode!.id}-${id}`, source: connectionState.fromNode!.id, target: id } as Edge));
        }
      }
    },
    [screenToFlowPosition, setNodes, setEdges]
  );

  return (
    <div className="w-full h-[80vh]" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        fitView
        fitViewOptions={{ padding: 2 }}
        nodeOrigin={nodeOrigin as [number, number]}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
};

export default function Page() {
  return (
    <ReactFlowProvider>
      <AddNodeOnEdgeDrop />
    </ReactFlowProvider>
  );
}