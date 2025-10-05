"use client";

// Pill-as-handle prerequisite graph: each prerequisite pill is a Handle (req-<courseId>)
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Edge, Node, NodeProps, NodeTypes, Connection, OnConnect, OnConnectStart, OnConnectEnd } from '@xyflow/react';
import { Background, Controls, MarkerType, Panel, ReactFlow, ReactFlowProvider, useReactFlow, Handle, Position } from '@xyflow/react';
import { prerequisiteData, type PrereqNode, type TranscriptNode } from './prerequisiteData';

// ---------------- Utilities: prerequisite traversal ----------------
type CourseReq = { id: string; minGrade?: string; canBeTakenConcurrently?: string; orEquivalent?: boolean };

function extractPrereqCourseGroups(id: string): CourseReq[][] {
  const course = prerequisiteData[id];
  if (!course || !course.prerequisites) return [];

  const walk = (n: PrereqNode): CourseReq[][] => {
    if (n == null) return [];
    switch (n.type) {
      case 'transcript':
        return [[{ id: n.course, minGrade: n.minGrade, canBeTakenConcurrently: n.canBeTakenConcurrently, orEquivalent: n.orEquivalent }]];
      case 'creditCount':
      case 'note':
      case 'other':
        return [];
      case 'group': {
        const childResults: CourseReq[][][] = (n.children || [])
          .map(walk)
          .filter((r) => r.length > 0);
        if (childResults.length === 0) return [];
        if (n.logic === 'ONE_OF') {
          const map = new Map<string, CourseReq>();
          for (const res of childResults) {
            for (const line of res) {
              for (const item of line) {
                const prior = map.get(item.id);
                if (!prior) map.set(item.id, { ...item });
                else {
                  if (!prior.minGrade && item.minGrade) prior.minGrade = item.minGrade;
                  if (!prior.canBeTakenConcurrently && item.canBeTakenConcurrently) prior.canBeTakenConcurrently = item.canBeTakenConcurrently;
                  if (!prior.orEquivalent && item.orEquivalent) prior.orEquivalent = item.orEquivalent;
                }
              }
            }
          }
          return [[...map.values()].sort((a, b) => a.id.localeCompare(b.id))];
        }
        // ALL_OF
        return childResults.flat();
      }
      default:
        return [];
    }
  };

  const result = walk(course.prerequisites).map((line) => {
    const map = new Map<string, CourseReq>();
    for (const item of line) {
      const prior = map.get(item.id);
      if (!prior) map.set(item.id, item);
      else if (!prior.minGrade && item.minGrade) map.set(item.id, item);
    }
    return [...map.values()];
  });
  return result;
}

// (Removed previous listDirectPrereqCourses – direct traversal utilities now handled inline where required.)

// ---------------- Custom Node: Course card ----------------
type CourseNodeData = { id: string; title?: string };

type CourseRFNode = Node<CourseNodeData, 'course'>;

// Contexts for shared state
const PresentSetContext = React.createContext<Set<string>>(new Set());

function CourseNode({ data }: NodeProps<CourseRFNode>) {
  const course = prerequisiteData[data.id];
  const presentSet = useContext(PresentSetContext);
  const subtitle = course?.title;

  const renderPrereqPillHandle = (cid: string) => (
    <div key={cid} className="relative inline-flex items-center">
      <Handle
        id={`req-${cid}`}
        type="source"
        position={Position.Right}
        className="!static !translate-x-0 !translate-y-0 !w-0 !h-0 !p-0"
        style={{ border: 'none', background: 'transparent' }}
      />
      <div
        className={
          'px-2 py-1 rounded border text-xs select-none cursor-crosshair ' +
          (presentSet.has(cid)
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50')
        }
        title={`Drag from here to spawn/link ${cid}`}
      >
        {cid}
      </div>
    </div>
  );

  // Render prerequisite tree with pills as handles
  const renderNode = (node: PrereqNode): React.ReactNode => {
    if (!node) return null;
    if (node.type === 'transcript') return renderPrereqPillHandle(node.course);
    if (node.type === 'group') {
      const children = (node.children || []).filter(Boolean) as PrereqNode[];
      if (children.length === 0) return null;
      const joinWord = node.logic === 'ONE_OF' ? 'or' : 'and';
      const allTranscript = children.every((c) => c && c.type === 'transcript');
      if (allTranscript) {
        return (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {children.map((c, i) => (
              <React.Fragment key={(c as TranscriptNode).course}>
                {renderPrereqPillHandle((c as TranscriptNode).course)}
                {i < children.length - 1 ? <span className="text-gray-500">{joinWord}</span> : null}
              </React.Fragment>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-1 text-xs">
          {children.map((c, idx) => (
            <React.Fragment key={idx}>
              <div className="pl-2 border-l border-dashed border-gray-300">{renderNode(c)}</div>
              {idx < children.length - 1 ? <div className="text-gray-500 pl-2">{joinWord}</div> : null}
            </React.Fragment>
          ))}
        </div>
      );
    }
    if (node.type === 'creditCount') return <div className="text-gray-600">{node.creditCount} credits</div>;
    if (node.type === 'note' || node.type === 'other') return <div className="text-gray-800">{node.text}</div>;
    return null;
  };

  return (
    <div data-course-card className="shadow-lg rounded-lg border border-gray-300 bg-white text-gray-900 select-none relative" style={{ width: 320 }}>
      <Handle type="target" position={Position.Left} id="in" className="!w-2 !h-2 !bg-slate-500" isConnectableStart={false} />
      <div className="p-3 border-b border-gray-200">
        <div className="text-sm font-semibold tracking-wide text-gray-700">{data.id}</div>
        {subtitle ? <div className="text-xs text-gray-500">{subtitle}</div> : null}
      </div>
      <div className="p-3">
        {course && course.prerequisites ? (
          <>
            <div className="text-xs font-medium text-gray-700 mb-1">Prerequisites:</div>
            <div className="flex flex-col gap-1 text-xs">{renderNode(course.prerequisites)}</div>
          </>
        ) : (
          <div className="text-xs text-gray-500">{!course ? 'No prerequisite data found.' : 'No prerequisites.'}</div>
        )}
      </div>
    </div>
  );
}

// ---------------- Drag-to-spawn Graph Canvas ----------------
type RFNode = CourseRFNode;

function getCourseReq(parentId: string, childId: string): CourseReq | undefined {
  const groups = extractPrereqCourseGroups(parentId); // flattened groups already unify OR logic
  for (const line of groups) {
    for (const req of line) {
      if (req.id === childId) return req;
    }
  }
  return undefined;
}

function buildEdgeLabel(parent: string, child: string): string | undefined {
  const req = getCourseReq(parent, child);
  if (!req) return undefined;
  const bits: string[] = [];
  if (req.minGrade) bits.push(req.minGrade);
  if (req.canBeTakenConcurrently) bits.push('concurrent');
  if (req.orEquivalent) bits.push('or equiv');
  return bits.length ? bits.join(' · ') : undefined;
}

function GraphCanvas() {
  const [rootId, setRootId] = useState<string>('ECON 201');
  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // init root on change
  useEffect(() => {
    setNodes([
      {
        id: rootId,
        position: { x: 0, y: 0 },
        draggable: true,
        type: 'course',
        data: { id: rootId, title: prerequisiteData[rootId]?.title },
      },
    ]);
    setEdges([]);
    // slight delay then fit
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [rootId, fitView]);

  const presentIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const presentSet = useMemo(() => new Set(presentIds), [presentIds]);

  const addCourseNode = useCallback(
    (courseId: string, position: { x: number; y: number }, parentId?: string) => {
      setNodes((prev) => {
        if (prev.some((n) => n.id === courseId)) return prev; // don't duplicate node
        return [
          ...prev,
          {
            id: courseId,
            position,
            draggable: true,
            type: 'course',
            data: { id: courseId, title: prerequisiteData[courseId]?.title },
          },
        ];
      });
      if (parentId) {
        setEdges((prev) => {
          const id = `${parentId}→${courseId}`;
          if (prev.some((e) => e.id === id)) return prev;
          const color = '#64748b';
          const label = buildEdgeLabel(parentId, courseId);
          return [
            ...prev,
            {
              id,
              source: parentId,
              sourceHandle: 'out',
              target: courseId,
              targetHandle: 'in',
              style: { stroke: color, strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color },
              label,
              labelStyle: { fontSize: 10, fill: '#334155' },
              labelBgStyle: { fill: 'rgba(255,255,255,0.9)' },
              labelBgPadding: [2, 2],
              labelBgBorderRadius: 2,
            },
          ];
        });
      }
    },
    [],
  );

  // Removed click fallback & HTML5 drag logic – only edge-drop spawn remains.

  // Track connection start metadata so we know which prerequisite handle initiated it
  const connectMeta = React.useRef<{ source?: string; sourceHandle?: string | null } | null>(null);

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectMeta.current = { source: params.nodeId ?? undefined, sourceHandle: params.handleId ?? undefined };
  }, []);

  const onConnect: OnConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    setEdges((prev) => {
      const id = `${params.source}→${params.target}`;
      if (prev.some((e) => e.id === id)) return prev;
      const color = '#475569';
      const label = buildEdgeLabel(params.source, params.target) || undefined;
      return [
        ...prev,
        {
          id,
          source: params.source,
          target: params.target,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          label,
          labelStyle: label ? { fontSize: 10, fill: '#334155' } : undefined,
          labelBgStyle: label ? { fill: 'rgba(255,255,255,0.9)' } : undefined,
          labelBgPadding: label ? [2, 2] : undefined,
          labelBgBorderRadius: label ? 2 : undefined,
        },
      ];
    });
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    if (state && !state.isValid && connectMeta.current?.source && connectMeta.current.sourceHandle?.startsWith('req-')) {
      const courseId = connectMeta.current.sourceHandle.replace(/^req-/, '');
      const parentId = connectMeta.current.source;
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      addCourseNode(courseId, position, parentId);
    }
    connectMeta.current = null;
  }, [addCourseNode, screenToFlowPosition]);

  // Removed HTML5 drag/drop support.

  const nodeTypes: NodeTypes = useMemo(() => ({ course: CourseNode as unknown as React.FC<NodeProps> }), []);

  return (
    <PresentSetContext.Provider value={presentSet}>
      <div className="w-full h-[100vh]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#f5f5f5" gap={16} />
          <Controls showInteractive={false} position="bottom-right" />
          <Panel position="top-left" className="bg-white/90 backdrop-blur rounded-lg border border-gray-200 shadow p-2 text-xs text-gray-800 space-y-2">
            <label className="flex items-center gap-2">
              <span className="text-gray-700">Root</span>
              <select
                className="border border-gray-300 rounded px-1 py-0.5 bg-white"
                value={rootId}
                onChange={(e) => setRootId(e.target.value)}
              >
                <option value="ECON 201">ECON 201</option>
                <option value="ECON 305">ECON 305</option>
                <option value="CMPT 225">CMPT 225</option>
              </select>
            </label>
            <div className="text-[10px] text-gray-500 leading-snug max-w-[220px]">
              Drag from a prerequisite pill (its right edge) and release on empty space to spawn the course, or onto an existing node to link.
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </PresentSetContext.Provider>
  );
}

export default function Page() { return (<ReactFlowProvider><GraphCanvas /></ReactFlowProvider>); }