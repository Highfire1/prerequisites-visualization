"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import { Background, Controls, MarkerType, Panel, ReactFlow } from '@xyflow/react';
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

function listDirectPrereqCourses(id: string): string[] {
  const groups = extractPrereqCourseGroups(id);
  const s = new Set<string>();
  for (const g of groups) for (const item of g) s.add(item.id);
  return Array.from(s);
}

// ---------------- Custom Node: Course card ----------------
type CourseNodeData = {
  id: string;
  title?: string;
  highlight?: boolean;
  primaryParentId?: string;
  persisted?: boolean;
  onButtonClick: (parentId: string, courseId: string) => void;
  onButtonHoverIn: (parentId: string, courseId: string) => void;
  onButtonHoverOut: (parentId: string, courseId: string) => void;
};

type CourseRFNode = Node<CourseNodeData, 'course'>;

// Contexts for shared state
const PresentSetContext = React.createContext<Set<string>>(new Set());
const GraphSettingsContext = React.createContext<{ showMinGrade: boolean }>({ showMinGrade: false });

function CourseNode({ data }: NodeProps<CourseRFNode>) {
  const course = prerequisiteData[data.id];
  const presentSet = useContext(PresentSetContext);
  const { showMinGrade } = useContext(GraphSettingsContext);
  const subtitle = course?.title;

  const renderTranscript = (cid: string, minGrade?: string) => (
    <button
      data-pan-block
      className={
        'px-2 py-1 rounded border ' +
        (presentSet.has(cid)
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100')
      }
      onClick={(e) => {
        e.stopPropagation();
        data.onButtonClick(data.id, cid);
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        data.onButtonHoverIn(data.id, cid);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        data.onButtonHoverOut(data.id, cid);
      }}
    >
  {showMinGrade && minGrade ? `${cid} (${minGrade})` : cid}
    </button>
  );

  const renderNode = (node: PrereqNode): React.ReactNode => {
    if (!node) return null;
    if (node.type === 'transcript') return renderTranscript(node.course, node.minGrade);
    if (node.type === 'group') {
      type Child = Exclude<PrereqNode, null>;
      const isTranscriptNode = (n: PrereqNode): n is TranscriptNode => !!n && n.type === 'transcript';
      const children = (node.children || []).filter(Boolean) as Child[];
      if (children.length === 0) return null;
      if (node.logic === 'ONE_OF') {
        const allTranscript = children.every((c) => isTranscriptNode(c));
        if (allTranscript) {
          return (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {(children as TranscriptNode[]).map((c, j) => (
                <React.Fragment key={c.course}>
                  {renderTranscript(c.course, c.minGrade)}
                  {j < children.length - 1 ? <span className="text-gray-500">or</span> : null}
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
                {idx < children.length - 1 ? <div className="text-gray-500 pl-2">or</div> : null}
              </React.Fragment>
            ))}
          </div>
        );
      }
      const allTranscriptAll = children.every((c) => isTranscriptNode(c));
      if (allTranscriptAll) {
        return (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {(children as TranscriptNode[]).map((c, idx) => (
              <React.Fragment key={c.course}>
                {renderTranscript(c.course, c.minGrade)}
                {idx < children.length - 1 ? <span className="text-gray-500">and</span> : null}
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
              {idx < children.length - 1 ? <div className="text-gray-500 pl-2">and</div> : null}
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
    <div
      className={`shadow-lg rounded-lg border ${data.highlight ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} bg-white text-gray-900 select-none`}
      style={{ width: 320 }}
    >
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

// ---------------- Page: graph with React Flow ----------------
type RFNode = CourseRFNode;

export default function Page() {
  // Root course selector
  const [rootId, setRootId] = useState<string>('ECON 201');

  // Settings (subset of v2)
  const [settings, setSettings] = useState({
    ringBase: 50,
    ringStep: 350,
    useParentAnchors: true,
    showMinGrade: false,
    showRings: false,
  });

  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Reopen memory: parent -> set of children that were closed due only to that parent
  const [reopenMemory, setReopenMemory] = useState<Map<string, Set<string>>>(new Map());
  const reopenMemoryRef = useRef(reopenMemory);
  useEffect(() => void (reopenMemoryRef.current = reopenMemory), [reopenMemory]);

  const presentIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const presentSet = useMemo(() => new Set(presentIds), [presentIds]);

  // Initialize root node on mount or when rootId changes
  useEffect(() => {
    const rootNode: RFNode = {
      id: rootId,
      position: { x: 0, y: 0 },
      draggable: false,
      data: {
        id: rootId,
        title: prerequisiteData[rootId]?.title,
        persisted: true,
        onButtonClick: handleButtonClick,
        onButtonHoverIn: handleButtonHoverIn,
        onButtonHoverOut: handleButtonHoverOut,
      },
      type: 'course',
    };
    setNodes([rootNode]);
    setEdges([]);
    setReopenMemory(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId]);

  // Upsert node (persisted or ephemeral)
  const upsertNode = useCallback(
    (id: string, opts: { persisted?: boolean; highlight?: boolean; anchorParentId?: string; ephemeral?: boolean }) => {
      setNodes((prev) => {
        const exists = prev.find((n) => n.id === id);
        const primaryParentId = opts.anchorParentId;
        if (exists) {
          return prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  draggable: false,
                  data: {
                    ...n.data,
                    highlight: opts.highlight ?? n.data.highlight,
                    primaryParentId: n.data.primaryParentId ?? primaryParentId,
                    persisted: opts.persisted ? true : n.data.persisted,
                  },
                }
              : n
          );
        }
        const newNode: RFNode = {
          id,
          position: { x: 0, y: 0 },
          draggable: false,
          type: 'course',
          data: {
            id,
            title: prerequisiteData[id]?.title,
            highlight: opts.highlight,
            primaryParentId,
            persisted: !!opts.persisted,
            onButtonClick: handleButtonClick,
            onButtonHoverIn: handleButtonHoverIn,
            onButtonHoverOut: handleButtonHoverOut,
          },
        };
        return [...prev, newNode];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  

  // Edge helpers
  const edgeId = (s: string, t: string) => `${s}→${t}`;
  const ensureEdge = useCallback((src: string, tgt: string, opts?: { ephemeral?: boolean; primary?: boolean }) => {
    setEdges((prev) => {
      const id = edgeId(src, tgt);
      if (prev.some((e) => e.id === id)) return prev;
      const isEphemeral = !!opts?.ephemeral;
      const isPrimary = !!opts?.primary;
      const color = isEphemeral ? '#BFDBFE' : isPrimary ? '#9CA3AF' : '#D1D5DB';
      const width = isEphemeral ? 1.5 : isPrimary ? 2.5 : 2;
      const e: Edge = {
        id,
        source: src,
        target: tgt,
        animated: false,
        style: { stroke: color, strokeWidth: width },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        // store flags in data if needed later
        data: { ephemeral: isEphemeral, primary: isPrimary },
      };
      return [...prev, e];
    });
  }, []);

  const removeEphemeralEdge = useCallback((src: string, tgt: string) => {
    const id = edgeId(src, tgt);
    setEdges((prev) => prev.filter((e) => !(e.id === id && e.data?.ephemeral)));
  }, []);

  // Click: toggle child course under parent
  const handleButtonClick = useCallback(
    (parentId: string, courseId: string) => {
      const childPresent = presentSet.has(courseId);
      if (childPresent) {
        // Cascade-close removal: remove this course and its children that no longer have other parents among present nodes
        const presentPersisted = new Set(presentIds);
        const parentCount = (child: string, remove: Set<string>) => {
          let cnt = 0;
          for (const p of presentPersisted) {
            if (remove.has(p)) continue;
            const prereqs = listDirectPrereqCourses(p);
            if (prereqs.includes(child)) cnt++;
          }
          return cnt;
        };
        const removeSet = new Set<string>([courseId]);
        const queue = [courseId];
        const directClosed = new Set<string>();
        while (queue.length) {
          const u = queue.shift()!;
          const children = listDirectPrereqCourses(u);
          for (const c of children) {
            if (!presentPersisted.has(c)) continue;
            if (parentCount(c, removeSet) === 0) {
              if (!removeSet.has(c)) {
                removeSet.add(c);
                queue.push(c);
              }
              if (u === courseId) directClosed.add(c);
            }
          }
        }
        // Apply removals
        setNodes((prev) => prev.filter((n) => !removeSet.has(n.id)));
        setEdges((prev) => prev.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)));
        if (directClosed.size) {
          setReopenMemory((prev) => {
            const m = new Map(prev);
            const prior = m.get(courseId) ?? new Set<string>();
            for (const c of directClosed) prior.add(c);
            m.set(courseId, prior);
            return m;
          });
        }
        return;
      }

      // Persist child and link
  upsertNode(courseId, { highlight: true, anchorParentId: parentId, persisted: true });
      // Primary link if this parent is listed as primaryParentId of child node data
      const primary = true;
      ensureEdge(parentId, courseId, { primary });
      removeEphemeralEdge(parentId, courseId);

      // Reopen remembered subtree recursively
      const reopenSubtree = (root: string) => {
        const visited = new Set<string>();
        const q: string[] = [root];
        while (q.length) {
          const p = q.shift()!;
          const mem = reopenMemoryRef.current.get(p);
          if (!mem) continue;
          for (const c of mem) {
            if (visited.has(c)) continue;
            visited.add(c);
            upsertNode(c, { anchorParentId: p, persisted: true });
            ensureEdge(p, c, { primary: true });
            q.push(c);
          }
        }
      };
      reopenSubtree(courseId);
      setReopenMemory((prev) => {
        if (!prev.has(courseId)) return prev;
        const m = new Map(prev);
        m.delete(courseId);
        return m;
      });

      // remove highlight after a short delay
      setTimeout(() => {
        setNodes((prev) => prev.map((n) => (n.id === courseId ? { ...n, data: { ...n.data, highlight: false } } : n)));
      }, 600);
    },
    [presentIds, presentSet, ensureEdge, removeEphemeralEdge, upsertNode]
  );

  // Hover in: create ephemeral highlighted node and edge
  const handleButtonHoverIn = useCallback(
    (parentId: string, courseId: string) => {
      setNodes((prev) => prev.map((n) => (n.id === courseId ? { ...n, data: { ...n.data, highlight: true } } : n)));
      if (!presentSet.has(courseId)) {
        upsertNode(courseId, { highlight: true, anchorParentId: parentId });
        ensureEdge(parentId, courseId, { ephemeral: true });
      } else {
        // ensure edge style visible even if already present
        ensureEdge(parentId, courseId, { primary: true });
      }
    },
    [presentSet, ensureEdge, upsertNode]
  );

  // Hover out: remove ephemeral node and edge, clear highlight
  const handleButtonHoverOut = useCallback(
    (parentId: string, courseId: string) => {
      setNodes((prev) => {
        const node = prev.find((n) => n.id === courseId);
        if (!node) return prev;
        // Always clear highlight
        const cleared = prev.map((n) => (n.id === courseId ? { ...n, data: { ...n.data, highlight: false } } : n));
        // If not persisted, remove it (ephemeral hover preview)
        if (!node.data?.persisted) {
          return cleared.filter((n) => n.id !== courseId);
        }
        return cleared;
      });
      removeEphemeralEdge(parentId, courseId);
    },
    [removeEphemeralEdge]
  );

  // Auto-ensure persistent edges between present related courses
  useEffect(() => {
    if (!nodes.length) return;
    const present = new Set(nodes.map((n) => n.id));
    nodes.forEach((parent) => {
      const prereqs = listDirectPrereqCourses(parent.id);
      prereqs.forEach((cid) => {
        if (present.has(cid)) {
          // remove ephemeral then ensure persistent
          setEdges((prev) => {
            const id = edgeId(parent.id, cid);
            let changed = false;
            const filtered = prev.filter((e) => {
              if (e.id !== id) return true;
              if (e.data?.ephemeral) {
                changed = true;
                return false;
              }
              return true;
            });
            const exists = filtered.some((e) => e.id === id);
            if (!exists) {
              changed = true;
              const color = '#9CA3AF';
              filtered.push({
                id,
                source: parent.id,
                target: cid,
                style: { stroke: color, strokeWidth: 2.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
                data: { primary: true },
              });
            }
            return changed ? filtered : prev;
          });
        }
      });
    });
  }, [nodes, settings]);

  // ---------------- Layout: concentric rings by depth ----------------
  const depthRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Build adjacency map from data
    const adj = new Map<string, string[]>();
    Object.keys(prerequisiteData).forEach((id) => {
      adj.set(id, listDirectPrereqCourses(id));
    });
    // BFS from current root
    const depth = new Map<string, number>();
    depth.set(rootId, 0);
    const q: string[] = [rootId];
    while (q.length) {
      const u = q.shift()!;
      const du = depth.get(u)!;
      const nbrs = adj.get(u) ?? [];
      for (const v of nbrs) {
        if (!depth.has(v)) {
          depth.set(v, du + 1);
          q.push(v);
        }
      }
    }
    depthRef.current = depth;
  }, [rootId]);

  // Assign positions when nodes/settings change
  useEffect(() => {
    if (!nodes.length) return;
    const depth = depthRef.current;
    // Group by depth among present nodes
    const groups = new Map<number, string[]>();
    nodes.forEach((n) => {
      const d = depth.get(n.id) ?? 0;
      const arr = groups.get(d) ?? [];
      arr.push(n.id);
      groups.set(d, arr);
    });
    groups.forEach((arr, d) => d > 0 && arr.sort());

    // angle map
    const angle = new Map<string, number>();
    angle.set(rootId, 0);
    const depths = Array.from(groups.keys()).sort((a, b) => a - b);
    for (const d of depths) {
      const ids = groups.get(d)!;
      if (d === 0) continue;
      if (d === 1) {
        const k = Math.max(1, ids.length);
        ids.forEach((id, idx) => angle.set(id, -Math.PI + (2 * Math.PI * idx) / k));
        continue;
      }
      if (settings.useParentAnchors) {
        // simple parent-anchored spacing: for each child, use parent angle if available, otherwise even
        const k = Math.max(1, ids.length);
        ids.forEach((id, idx) => {
          // find any present parent at d-1
          const parents = nodes
            .filter((p) => (depth.get(p.id) ?? 0) === d - 1 && listDirectPrereqCourses(p.id).includes(id))
            .map((p) => p.id);
          const parentAngle = parents.length ? angle.get(parents.sort()[0]) : undefined;
          angle.set(id, parentAngle ?? -Math.PI + (2 * Math.PI * idx) / k);
        });
      } else {
        const k = Math.max(1, ids.length);
        ids.forEach((id, idx) => angle.set(id, -Math.PI + (2 * Math.PI * idx) / k));
      }
    }

    // put nodes on rings
    const ringPos = new Map<string, { x: number; y: number }>();
    const cx = 0; // RF coordinates; we'll rely on fitView to frame content
    const cy = 0;
    nodes.forEach((n) => {
      const d = depth.get(n.id) ?? 0;
      if (d === 0) {
        ringPos.set(n.id, { x: cx, y: cy });
      } else {
        const r = settings.ringBase + d * settings.ringStep;
        const a = angle.get(n.id) ?? 0;
        ringPos.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    });

    setNodes((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        const pos = ringPos.get(n.id);
        if (!pos) return n;
        const same = n.position?.x === pos.x && n.position?.y === pos.y;
        if (!same) {
          changed = true;
          return { ...n, position: pos };
        }
        return n;
      });
      return changed ? next : prev;
    });
  }, [nodes, settings.ringBase, settings.ringStep, settings.useParentAnchors, rootId]);

  // Node types
  const nodeTypes: NodeTypes = useMemo(() => ({ course: CourseNode as unknown as React.FC<NodeProps> }), []);

  return (
    <PresentSetContext.Provider value={presentSet}>
      <GraphSettingsContext.Provider value={{ showMinGrade: settings.showMinGrade }}>
        <div className="w-full h-[100vh]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#f5f5f5" gap={16} />
            <Controls showInteractive={false} position="bottom-right" />
            <Panel position="top-left" className="bg-white/90 backdrop-blur rounded-lg border border-gray-200 shadow p-2 text-xs text-gray-800">
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
            </Panel>
            <Panel position="top-right" className="bg-white/90 backdrop-blur rounded-lg border border-gray-200 shadow p-3 text-xs text-gray-800 w-72 hidden md:block">
              <div className="font-medium text-gray-700 mb-2">Layout controls</div>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2">
                  <span>Ring base</span>
                  <input type="range" min={0} max={300} step={10} value={settings.ringBase} onChange={(e) => setSettings((s) => ({ ...s, ringBase: Number(e.target.value) }))} />
                  <span className="w-10 text-right">{settings.ringBase}</span>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Ring step</span>
                  <input type="range" min={60} max={600} step={10} value={settings.ringStep} onChange={(e) => setSettings((s) => ({ ...s, ringStep: Number(e.target.value) }))} />
                  <span className="w-10 text-right">{settings.ringStep}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.useParentAnchors} onChange={(e) => setSettings((s) => ({ ...s, useParentAnchors: e.target.checked }))} />
                  <span>Anchor deeper rings to parents</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.showMinGrade} onChange={(e) => setSettings((s) => ({ ...s, showMinGrade: e.target.checked }))} />
                  <span>Show minimum grade</span>
                </label>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </GraphSettingsContext.Provider>
    </PresentSetContext.Provider>
  );
}