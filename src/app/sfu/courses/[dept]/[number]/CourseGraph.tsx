"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import sfuCoursesData from '../../sfu-verified-courses.json';

// SFU Course data types
type SFUCourse = {
  id: number;
  dept: string;
  number: string;
  title: string;
  description: string;
  prerequisites: string;
  corequisites: string;
  notes: string;
  parse_status: string;
  parsed_prerequisites: SFUPrereqNode | null;
  parsed_credit_conflicts: Record<string, unknown> | null;
  verified_at: string;
};

type SFUPrereqNode = {
  type: string;
  logic?: string; // Allow any string from JSON
  children?: SFUPrereqNode[];
  // Course-specific fields
  department?: string;
  number?: string;
  minGrade?: string;
  course?: string; // For HSCourse
  orEquivalent?: string;
  // Count-specific fields
  count?: number;
  level?: string;
  credits?: number;
  // Text fields
  note?: string;
};

type SimNode = {
  id: string; // course id like "CMPT 225"
  title: string;
  subtitle?: string;
  persisted: boolean;
  pinned?: boolean;
  hoverPinned?: boolean;
  primaryParentId?: string;
  width: number;
  height: number;
  highlight?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type SimLink = {
  source: SimNode | string;
  target: SimNode | string;
  ephemeral?: boolean;
};

type CourseReq = {
  id: string;
  minGrade?: string;
  canBeTakenConcurrently?: string;
  orEquivalent?: boolean;
};

// Create course lookup map
const courseMap = new Map<string, SFUCourse>();
sfuCoursesData.courses.forEach(course => {
  const key = `${course.dept} ${course.number}`;
  courseMap.set(key, course);
});

// Extract prerequisite courses from SFU data structure
function extractPrereqCourseGroups(courseId: string): CourseReq[][] {
  const course = courseMap.get(courseId);
  if (!course || !course.parsed_prerequisites) return [];

  const walk = (n: SFUPrereqNode): CourseReq[][] => {
    if (!n) return [];
    
    switch (n.type) {
      case 'course':
        if (n.department && n.number) {
          const id = `${n.department} ${n.number}`;
          return [[{ id, minGrade: n.minGrade, orEquivalent: false }]];
        }
        return [];
      
      case 'HSCourse':
        if (n.course) {
          return [[{ id: n.course, orEquivalent: n.orEquivalent === "true" }]];
        }
        return [];
      
      case 'group': {
        if (!n.children) return [];
        const childResults: CourseReq[][][] = n.children
          .map(walk)
          .filter((r: CourseReq[][]) => r.length > 0);
        
        if (childResults.length === 0) return [];

        if (n.logic === 'ONE_OF') {
          // Merge all alternatives into a single line (union)
          const map = new Map<string, CourseReq>();
          for (const res of childResults) {
            for (const line of res) {
              for (const item of line) {
                const prior = map.get(item.id);
                if (!prior) {
                  map.set(item.id, { ...item });
                } else {
                  if (!prior.minGrade && item.minGrade) prior.minGrade = item.minGrade;
                  if (!prior.orEquivalent && item.orEquivalent) prior.orEquivalent = item.orEquivalent;
                }
              }
            }
          }
          return [[...map.values()].sort((a, b) => a.id.localeCompare(b.id))];
        } else {
          // ALL_OF: keep each child's lines separate
          return childResults.flat();
        }
      }
      
      case 'courseCount':
      case 'creditCount':
      case 'permission':
      case 'other':
      default:
        return [];
    }
  };

  const result = walk(course.parsed_prerequisites).map((line) => {
    // De-duplicate within a line by id
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

// Flatten groups to a unique list of all direct prerequisite course IDs
function listDirectPrereqCourses(id: string): string[] {
  const groups = extractPrereqCourseGroups(id);
  const s = new Set<string>();
  for (const g of groups) for (const item of g) s.add(item.id);
  return Array.from(s);
}

function NodeCard({
  n,
  presentSet,
  onButtonClick,
  onButtonHoverIn,
  onButtonHoverOut,
  showMinGrade,
}: {
  n: SimNode;
  presentSet: Set<string>;
  onButtonClick: (parentId: string, courseId: string) => void;
  onButtonHoverIn: (parentId: string, courseId: string) => void;
  onButtonHoverOut: (parentId: string, courseId: string) => void;
  showMinGrade: boolean;
}) {
  const course = courseMap.get(n.id);
  const missingData = !course;
  const noPrereqs = !missingData && course?.parsed_prerequisites == null;

  const renderTranscript = (id: string, minGrade?: string) => (
    <button
      data-pan-block
      className={
        "px-2 py-1 rounded border text-xs " +
        (presentSet.has(id)
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : "border-gray-300 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900 dark:active:bg-blue-800")
      }
      onClick={(e) => {
        e.stopPropagation();
        onButtonClick(n.id, id);
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onButtonHoverIn(n.id, id);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        onButtonHoverOut(n.id, id);
      }}
    >
      {showMinGrade && minGrade ? `${id} (${minGrade})` : id}
    </button>
  );

  const renderNode = (node: SFUPrereqNode): React.ReactNode => {
    if (!node) return null;
    
    if (node.type === 'course' && node.department && node.number) {
      const courseId = `${node.department} ${node.number}`;
      return renderTranscript(courseId, node.minGrade);
    }
    
    if (node.type === 'HSCourse' && node.course) {
      return renderTranscript(node.course);
    }
    
    if (node.type === 'group' && node.children) {
      const children = node.children.filter(Boolean);
      if (children.length === 0) return null;
      
      const joinWord = node.logic === 'ONE_OF' ? 'or' : 'and';
      const allCourses = children.every((c) => 
        (c.type === 'course' && c.department && c.number) || 
        (c.type === 'HSCourse' && c.course)
      );
      
      if (allCourses) {
        return (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {children.map((c, i) => (
              <React.Fragment key={i}>
                {renderNode(c)}
                {i < children.length - 1 ? <span className="text-gray-500 dark:text-gray-400">{joinWord}</span> : null}
              </React.Fragment>
            ))}
          </div>
        );
      }
      
      return (
        <div className="flex flex-col gap-1 text-xs">
          {children.map((c, idx) => (
            <React.Fragment key={idx}>
              <div className="pl-2 border-l border-dashed border-gray-300 dark:border-gray-600">{renderNode(c)}</div>
              {idx < children.length - 1 ? <div className="text-gray-500 dark:text-gray-400 pl-2">{joinWord}</div> : null}
            </React.Fragment>
          ))}
        </div>
      );
    }
    
    if (node.type === 'courseCount') {
      return <div className="text-gray-600 dark:text-gray-400">{node.count} course(s) from {node.department} {node.level}</div>;
    }
    
    if (node.type === 'creditCount') {
      return <div className="text-gray-600 dark:text-gray-400">{node.credits} credits from {node.department}</div>;
    }
    
    if (node.type === 'permission' || node.type === 'other') {
      return <div className="text-gray-800 dark:text-gray-200 text-xs">{node.note}</div>;
    }
    
    return null;
  };

  return (
    <div
      className={`shadow-lg rounded-lg border ${
        n.highlight ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800" : "border-gray-300 dark:border-gray-600"
      } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 select-none`}
      style={{
        width: n.width,
        minHeight: n.height,
        pointerEvents: "auto",
      }}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-300">
          {n.title}
        </div>
        {n.subtitle ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">{n.subtitle}</div>
        ) : null}
      </div>
      <div className="p-3">
        {course && course.parsed_prerequisites ? (
          <>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prerequisites:
            </div>
            <div className="flex flex-col gap-1 text-xs">{renderNode(course.parsed_prerequisites)}</div>
          </>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {missingData ? "No prerequisite data found." : noPrereqs ? "No prerequisites." : "No prerequisites."}
          </div>
        )}
      </div>
    </div>
  );
}

interface CourseGraphProps {
  courseId: string;
}

export default function CourseGraph({ courseId }: CourseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const depthRef = useRef<Map<string, number>>(new Map());

  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const nodesRef = useRef<SimNode[]>(nodes);
  const linksRef = useRef<SimLink[]>(links);
  const [, forceRender] = useState({});

  const [reopenMemory, setReopenMemory] = useState<Map<string, Set<string>>>(new Map());
  const reopenMemoryRef = useRef(reopenMemory);
  useEffect(() => void (reopenMemoryRef.current = reopenMemory), [reopenMemory]);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => void (viewRef.current = view), [view]);

  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOrigRef = useRef({ x: 0, y: 0 });

  const [settings] = useState({
    ringBase: 50,
    ringStep: 350,
    iterations: 32,
    sepPadding: 16,
    ringSpring: 0.15,
    pullAlpha: 0.40,
    clampPad: 24,
    pinClicked: false,
    animate: true,
    showRings: false,
    ringCount: 4,
    useParentAnchors: true,
    ringSpacingPad: 16,
    showMinGrade: false,
  });

  useEffect(() => void (nodesRef.current = nodes), [nodes]);
  useEffect(() => void (linksRef.current = links), [links]);

  // Pan handlers (drag background with left mouse)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => {
      // Allow pan on left(0) clicks only, unless on a pan-blocking element
      const target = e.target as HTMLElement | null;
      const isBlocked = !!target?.closest('[data-pan-block]');
      if (isBlocked) return;
      const allowedButton = e.button === 0;
      if (!allowedButton) return;
      try { el.setPointerCapture(e.pointerId); } catch {}
      draggingRef.current = true;
      movedRef.current = false;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOrigRef.current = { x: viewRef.current.x, y: viewRef.current.y };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;
      setView(v => ({ ...v, x: panOrigRef.current.x + dx, y: panOrigRef.current.y + dy }));
    };
    const endPan = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsPanning(false);
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    const onClickCapture = (e: MouseEvent) => {
      if (movedRef.current) {
        e.stopPropagation();
        e.preventDefault();
        movedRef.current = false;
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      if (draggingRef.current) e.preventDefault();
    };
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPan);
    el.addEventListener('pointercancel', endPan);
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPan);
      el.removeEventListener('pointercancel', endPan);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  // Wheel zoom (zoom around mouse position)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x, y, k } = viewRef.current;
      const delta = -e.deltaY; // wheel up => zoom in
      const zoom = Math.exp(delta * 0.0015);
      const newK = Math.max(0.3, Math.min(3.0, k * zoom));
      const worldX = (mx - x) / k;
      const worldY = (my - y) / k;
      const newX = mx - worldX * newK;
      const newY = my - worldY * newK;
      setView({ x: newX, y: newY, k: newK });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Initialize root node when courseId changes
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rootData = courseMap.get(courseId);
    
    const root: SimNode = {
      id: courseId,
      title: courseId,
      subtitle: rootData?.title,
      persisted: true,
      pinned: true,
      width: 320,
      height: 140,
      fx: cx,
      fy: cy,
      x: cx,
      y: cy,
    };
    setNodes([root]);
    setLinks([]);
    setReopenMemory(new Map());
  }, [courseId]);

  // Precompute depths from root
  useEffect(() => {
    const buildAdj = (): Map<string, string[]> => {
      const m = new Map<string, string[]>();
      courseMap.forEach((course, id) => {
        m.set(id, listDirectPrereqCourses(id));
      });
      return m;
    };
    
    const bfs = (start: string, adj: Map<string, string[]>) => {
      const depth = new Map<string, number>();
      depth.set(start, 0);
      const q: string[] = [start];
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
      return depth;
    };
    
    const adj = buildAdj();
    depthRef.current = bfs(courseId, adj);
  }, [courseId]);

  // Layout logic (simplified version of the original)
  useEffect(() => {
    if (!containerRef.current || !nodesRef.current.length) return;

    const rect = containerRef.current.getBoundingClientRect();
    const root = nodesRef.current.find((n) => n.id === courseId);
    const cx = root?.fx ?? rect.width / 2;
    const cy = root?.fy ?? rect.height / 2;

    // Simple circular layout by depth
    const targets = new Map<string, { x: number; y: number }>();
    nodesRef.current.forEach((n) => {
      const d = depthRef.current.get(n.id) ?? 0;
      if (d === 0) {
        targets.set(n.id, { x: cx, y: cy });
        return;
      }
      const r = settings.ringBase + d * settings.ringStep;
      const angle = Math.random() * 2 * Math.PI; // Simple random placement for now
      const tx = cx + r * Math.cos(angle);
      const ty = cy + r * Math.sin(angle);
      targets.set(n.id, { x: tx, y: ty });
      if (n.x == null || n.y == null) { 
        n.x = tx; 
        n.y = ty; 
      }
    });

    const stepOnce = () => {
      // Pull towards target
      nodesRef.current.forEach((n) => {
        if ((n.pinned || n.hoverPinned) && n.fx != null && n.fy != null) {
          n.x = n.fx;
          n.y = n.fy;
          return;
        }
        const t = targets.get(n.id);
        if (t) {
          const alpha = settings.pullAlpha;
          n.x = (n.x ?? t.x) + (t.x - (n.x ?? t.x)) * alpha;
          n.y = (n.y ?? t.y) + (t.y - (n.y ?? t.y)) * alpha;
        }
      });
    };

    if (!settings.animate) {
      for (let i = 0; i < settings.iterations; i++) stepOnce();
      forceRender({});
      return;
    }

    let rafId = 0;
    let step = 0;
    const itersPerFrame = 2;
    const frame = () => {
      for (let i = 0; i < itersPerFrame && step < settings.iterations; i++, step++) {
        stepOnce();
      }
      forceRender({});
      if (step < settings.iterations) {
        rafId = requestAnimationFrame(frame);
      }
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [nodes.length, settings, courseId]);

  // Event handlers (simplified)
  const upsertNode = useCallback((id: string, opts: Partial<SimNode> & { persisted?: boolean }) => {
    setNodes((prev) => {
      const exists = prev.find((n) => n.id === id);
      if (exists) {
        return prev.map((n) => n.id === id ? { ...n, ...opts } : n);
      }
      
      const course = courseMap.get(id);
      const newNode: SimNode = {
        id,
        title: id,
        subtitle: course?.title,
        persisted: !!opts.persisted,
        width: 300,
        height: 120,
        x: 0,
        y: 0,
        ...opts,
      };
      return [...prev, newNode];
    });
  }, []);

  const ensureLink = useCallback((src: string, tgt: string, ephemeral?: boolean) => {
    setLinks((prev) => {
      const exists = prev.find((l) => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        return s === src && t === tgt;
      });
      if (exists) return prev;
      return [...prev, { source: src, target: tgt, ephemeral }];
    });
  }, []);

  const handleButtonClick = useCallback((parentId: string, courseId: string) => {
    const existing = nodesRef.current.find((n) => n.id === courseId);
    if (existing?.persisted) {
      // Remove node
      setNodes((prev) => prev.filter((n) => n.id !== courseId));
      setLinks((prev) => prev.filter((l) => {
        const s = typeof l.source === "string" ? l.source : l.source.id;
        const t = typeof l.target === "string" ? l.target : l.target.id;
        return s !== courseId && t !== courseId;
      }));
    } else {
      // Add node
      upsertNode(courseId, { persisted: true, highlight: true });
      ensureLink(parentId, courseId, false);
      setTimeout(() => {
        setNodes((prev) => prev.map((n) => n.id === courseId ? { ...n, highlight: false } : n));
      }, 600);
    }
  }, [upsertNode, ensureLink]);

  const handleButtonHoverIn = useCallback((parentId: string, courseId: string) => {
    upsertNode(courseId, { persisted: false, highlight: true });
    ensureLink(parentId, courseId, true);
  }, [upsertNode, ensureLink]);

  const handleButtonHoverOut = useCallback((parentId: string, courseId: string) => {
    setNodes((prev) => prev.filter((n) => !(n.id === courseId && !n.persisted)));
    setLinks((prev) => prev.filter((l) => !l.ephemeral || 
      (typeof l.source === "string" ? l.source : l.source.id) !== parentId ||
      (typeof l.target === "string" ? l.target : l.target.id) !== courseId
    ));
  }, []);

  const getNodePos = (id: string) => {
    const n = nodesRef.current.find((x) => x.id === id);
    return n ? { x: n.x ?? 0, y: n.y ?? 0 } : { x: 0, y: 0 };
  };

  const presentSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  // Fullscreen handlers
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn('Fullscreen not supported or failed:', error);
    }
  }, []);

  // Listen for fullscreen changes (e.g., ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="w-full h-screen">
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Fullscreen button */}
        <div data-pan-block className="absolute top-3 right-3 z-20">
          <button
            onClick={toggleFullscreen}
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow w-10 h-10 hover:bg-gray-50 dark:hover:bg-gray-700 select-none text-gray-900 dark:text-gray-100 flex items-center justify-center"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V5H5V8H3V3H8ZM3 16V21H8V19H5V16H3ZM21 8V3H16V5H19V8H21ZM16 21V19H19V16H21V21H16Z" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3H8V5H5V8H3V3ZM16 3H21V8H19V5H16V3ZM8 21H3V16H5V19H8V21ZM21 16V21H16V19H19V16H21Z" fill="currentColor"/>
              </svg>
            )}
          </button>
        </div>

        {/* Zoom controls */}
        <div data-pan-block className="absolute bottom-3 right-3 z-20 flex flex-col items-stretch gap-2">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow overflow-hidden">
            <button
              className="block w-10 h-10 leading-10 text-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 select-none text-gray-900 dark:text-gray-100"
              onClick={() => {
                const el = containerRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const mx = rect.width / 2; 
                const my = rect.height / 2;
                const { x, y, k } = viewRef.current;
                const zoom = 1.25;
                const newK = Math.min(3.0, k * zoom);
                const worldX = (mx - x) / k; 
                const worldY = (my - y) / k;
                const newX = mx - worldX * newK; 
                const newY = my - worldY * newK;
                setView({ x: newX, y: newY, k: newK });
              }}
            >
              +
            </button>
            <button
              className="block w-10 h-10 leading-10 text-center hover:bg-gray-50 dark:hover:bg-gray-700 select-none text-gray-900 dark:text-gray-100"
              onClick={() => {
                const el = containerRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const mx = rect.width / 2; 
                const my = rect.height / 2;
                const { x, y, k } = viewRef.current;
                const zoom = 1/1.25;
                const newK = Math.max(0.3, k * zoom);
                const worldX = (mx - x) / k; 
                const worldY = (my - y) / k;
                const newX = mx - worldX * newK; 
                const newY = my - worldY * newK;
                setView({ x: newX, y: newY, k: newK });
              }}
            >
              −
            </button>
          </div>
          <button
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-full border border-gray-200 dark:border-gray-700 shadow w-10 h-10 hover:bg-gray-50 dark:hover:bg-gray-700 select-none text-gray-900 dark:text-gray-100"
            onClick={() => setView({ x: 0, y: 0, k: 1 })}
            title="Reset view"
          >
            🏠
          </button>
        </div>

        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            overflow: 'visible'
          }}
        >
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 -5 10 10"
                refX="6"
                refY="0"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,-5L10,0L0,5" fill="context-stroke" />
              </marker>
            </defs>
            <g>
              {linksRef.current.map((l, i) => {
                const sid = typeof l.source === "string" ? l.source : l.source.id;
                const tid = typeof l.target === "string" ? l.target : l.target.id;
                const s = getNodePos(sid);
                const t = getNodePos(tid);
                const strokeColor = l.ephemeral ? "#BFDBFE" : "#9CA3AF";
                const strokeW = l.ephemeral ? 1.5 : 2;
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2;
                
                return (
                  <g key={i}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={mx}
                      y2={my}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={t.x}
                      y1={t.y}
                      x2={mx}
                      y2={my}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      vectorEffect="non-scaling-stroke"
                      markerEnd="url(#arrow)"
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {nodesRef.current.map((n) => (
            <div
              key={n.id}
              className="absolute"
              style={{
                left: (n.x ?? 0) - n.width / 2,
                top: (n.y ?? 0) - Math.max(n.height, 100) / 2,
                transform: 'translate(0, 0)',
                zIndex: n.highlight ? 900 : n.pinned ? 500 : 1,
              }}
            >
              <NodeCard
                n={n}
                presentSet={presentSet}
                onButtonClick={handleButtonClick}
                onButtonHoverIn={handleButtonHoverIn}
                onButtonHoverOut={handleButtonHoverOut}
                showMinGrade={settings.showMinGrade}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}