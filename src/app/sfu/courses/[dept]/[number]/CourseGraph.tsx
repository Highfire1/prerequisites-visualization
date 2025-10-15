"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Course } from '../../../../../utils/courseApi';
import Link from "next/link";

type SFUPrereqNode = {
  type: string;
  logic?: string;
  children?: SFUPrereqNode[];
  // course fields
  department?: string;
  number?: string;
  minGrade?: string;
  canBeTakenConcurrently?: string;
  orEquivalent?: string;
  // HSCourse fields
  course?: string;
  // creditCount/courseCount fields
  count?: number;
  level?: string;
  credits?: number;
  // permission/other fields
  note?: string;
  // program fields
  program?: string;
  // CGPA/UDGPA fields
  minCGPA?: number;
  minUDGPA?: number;
};

type PrereqNode = SFUPrereqNode;

type SimNode = {
	id: string; // course id like ECON 201
	title: string;
	subtitle?: string;
	persisted: boolean; // created by click (true) vs preview/hover (false)
	pinned?: boolean; // ECON 201 should be pinned
	hoverPinned?: boolean; // temporarily pinned while hovering UI inside this node
	primaryParentId?: string; // prefer anchoring near this parent when laying out
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
	ephemeral?: boolean; // link created by hover
};

// Course requirement item extracted from prerequisite tree
type CourseReq = {
	id: string;
	minGrade?: string;
	canBeTakenConcurrently?: string;
	orEquivalent?: boolean;
};

// Parse course data into groups of alternatives
function extractPrereqCourseGroups(courseId: string, courseMap: Map<string, Course>): CourseReq[][] {
	const course = courseMap.get(courseId);
	if (!course || !course.parsed_prerequisites) return [];

	const walk = (n: PrereqNode): CourseReq[][] => {
		if (n == null) return [];
		switch (n.type) {
			case "course":
				if (n.department && n.number) {
					const id = `${n.department} ${n.number}`;
					return [[{ id, minGrade: n.minGrade, orEquivalent: false }]];
				}
				return [];
			case "HSCourse":
				if (n.course) {
					return [[{ id: n.course, orEquivalent: n.orEquivalent === "true" }]];
				}
				return [];
			case "creditCount":
			case "courseCount":
			case "permission":
			case "other":
				return [];
			case "group": {
				if (!n.children) return [];
				const childResults: CourseReq[][][] = n.children
					.map(walk)
					.filter((r: CourseReq[][]) => r.length > 0);
				if (childResults.length === 0) return [];

				if (n.logic === "ONE_OF") {
					// Merge all alternatives into a single line (union)
					const map = new Map<string, CourseReq>();
					for (const res of childResults) {
						for (const line of res) {
							for (const item of line) {
								const prior = map.get(item.id);
								if (!prior) {
									map.set(item.id, { ...item });
								} else {
									// Prefer keeping an existing minGrade; if prior has none, take the new one
									if (!prior.minGrade && item.minGrade) prior.minGrade = item.minGrade;
									if (!prior.canBeTakenConcurrently && item.canBeTakenConcurrently) prior.canBeTakenConcurrently = item.canBeTakenConcurrently;
									if (!prior.orEquivalent && item.orEquivalent) prior.orEquivalent = item.orEquivalent;
								}
							}
						}
					}
					return [[...map.values()].sort((a, b) => a.id.localeCompare(b.id))];
				} else {
					// ALL_OF: keep each child's lines separate and concatenate
					return childResults.flat();
				}
			}
			default:
				return [];
		}
	};

	const result = walk(course.parsed_prerequisites as SFUPrereqNode).map((line) => {
		// De-duplicate within a line by id while favoring entries that include a minGrade
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
function listDirectPrereqCourses(id: string, courseMap: Map<string, Course>): string[] {
	const groups = extractPrereqCourseGroups(id, courseMap);
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
	courseMap,
}: {
	n: SimNode;
	presentSet: Set<string>;
	onButtonClick: (parentId: string, courseId: string) => void;
	onButtonHoverIn: (parentId: string, courseId: string) => void;
	onButtonHoverOut: (parentId: string, courseId: string) => void;
	showMinGrade: boolean;
	courseMap: Map<string, Course>;
}) {
	const course = courseMap.get(n.id);
	const missingData = !course;
	const noPrereqs = !missingData && course?.prerequisites == null;
	const subtitle = n.subtitle ?? course?.title;

	const renderTranscript = (id: string, minGrade?: string) => (
		<button
			data-pan-block
			className={
				"px-2 py-1 rounded border " +
					(presentSet.has(id)
						? "border-gray-900 dark:border-gray-100 bg-neutral-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
						: "border-gray-300 dark:border-gray-600 hover:border-gray-600 dark:hover:border-gray-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:bg-neutral-100 dark:active:bg-neutral-700")
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

	const renderNode = (node: PrereqNode): React.ReactNode => {
		if (!node) return null;
		
		// course: department, number, minGrade? (optional), canBeTakenConcurrently? (optional), orEquivalent? (optional)
		if (node.type === "course" && node.department && node.number) {
			const courseId = `${node.department} ${node.number}`;
			const extras: string[] = [];
			if (node.minGrade) extras.push(`min: ${node.minGrade}`);
			if (node.canBeTakenConcurrently === "true") extras.push("concurrent");
			if (node.orEquivalent === "true") extras.push("or equiv");
			
			return (
				<div className="inline-flex items-center gap-1">
					{renderTranscript(courseId, undefined)}
					{extras.length > 0 && (
						<span className="text-gray-500 dark:text-gray-400 text-[10px]">
							({extras.join(", ")})
						</span>
					)}
				</div>
			);
		}
		
		// HSCourse: course, minGrade? (optional), orEquivalent? (optional)
		if (node.type === "HSCourse" && node.course) {
			const extras: string[] = [];
			if (node.minGrade) extras.push(`min: ${node.minGrade}`);
			if (node.orEquivalent === "true") extras.push("or equiv");
			
			return (
				<div className="inline-flex items-center gap-1">
					{renderTranscript(node.course, undefined)}
					{extras.length > 0 && (
						<span className="text-gray-500 dark:text-gray-400 text-[10px]">
							({extras.join(", ")})
						</span>
					)}
				</div>
			);
		}
		
		// program: program (required)
		if (node.type === "program" && node.program) {
			return (
				<div className="text-gray-700 dark:text-gray-300 text-xs">
					Must be in <span className="font-medium">{node.program}</span> program
				</div>
			);
		}
		
		// CGPA: minCGPA (required)
		if (node.type === "CGPA" && node.minCGPA != null) {
			return (
				<div className="text-gray-700 dark:text-gray-300 text-xs">
					Min CGPA: <span className="font-medium">{node.minCGPA}</span>
				</div>
			);
		}
		
		// UDGPA: minUDGPA (required)
		if (node.type === "UDGPA" && node.minUDGPA != null) {
			return (
				<div className="text-gray-700 dark:text-gray-300 text-xs">
					Min Upper Division GPA: <span className="font-medium">{node.minUDGPA}</span>
				</div>
			);
		}
		
		// group: logic (ALL_OF, ONE_OF, TWO_OF), children
		if (node.type === "group") {
			type Child = Exclude<PrereqNode, null>;
			const children = (node.children ?? []).filter(Boolean) as Child[];
			if (children.length === 0) return null;
			
			const isCourseNode = (n: PrereqNode): boolean => 
				!!n && ((n.type === "course" && !!n.department && !!n.number) || (n.type === "HSCourse" && !!n.course));
			
			// Handle TWO_OF logic
			if (node.logic === "TWO_OF") {
				return (
					<div className="flex flex-col gap-1 text-xs">
						<div className="text-gray-600 dark:text-gray-400 text-[10px] font-medium mb-0.5">
							(Choose 2 of the following)
						</div>
						{children.map((c, idx) => (
							<React.Fragment key={idx}>
								<div className="pl-2 border-l border-dashed border-gray-300 dark:border-gray-600">
									{renderNode(c)}
								</div>
								{idx < children.length - 1 ? (
									<div className="text-gray-500 dark:text-gray-400 pl-2">or</div>
								) : null}
							</React.Fragment>
						))}
					</div>
				);
			}
			
			if (node.logic === "ONE_OF") {
				const allCourses = children.every((c) => isCourseNode(c));
				if (allCourses) {
					return (
						<div className="flex flex-wrap items-center gap-1 text-xs">
							{children.map((c, j) => (
								<React.Fragment key={j}>
									{renderNode(c)}
									{j < children.length - 1 ? (
										<span className="text-gray-500 dark:text-gray-400">or</span>
									) : null}
								</React.Fragment>
							))}
						</div>
					);
				}
				return (
					<div className="flex flex-col gap-1 text-xs">
						{children.map((c, idx) => (
							<React.Fragment key={idx}>
								<div className="pl-2 border-l border-dashed border-gray-300 dark:border-gray-600">
									{renderNode(c)}
								</div>
								{idx < children.length - 1 ? (
									<div className="text-gray-500 dark:text-gray-400 pl-2">or</div>
								) : null}
							</React.Fragment>
						))}
					</div>
				);
			}
			// ALL_OF
			const allCourses = children.every((c) => isCourseNode(c));
			if (allCourses) {
				return (
					<div className="flex flex-wrap items-center gap-1 text-xs">
						{children.map((c, idx) => (
							<React.Fragment key={idx}>
								{renderNode(c)}
								{idx < children.length - 1 ? (
									<span className="text-gray-500 dark:text-gray-400">and</span>
								) : null}
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
							{idx < children.length - 1 ? (
								<div className="text-gray-500 dark:text-gray-400 pl-2">and</div>
							) : null}
						</React.Fragment>
					))}
				</div>
			);
		}
		
		// creditCount: credits (required), department? (optional), level? (optional), minGrade? (optional), canBeTakenConcurrently? (optional)
		if (node.type === "creditCount" && node.credits != null) {
			const parts: string[] = [`${node.credits} credits`];
			if (node.department) {
				const deptStr = Array.isArray(node.department) ? node.department.join("/") : node.department;
				parts.push(`in ${deptStr}`);
			}
			if (node.level) parts.push(`(${node.level})`);
			if (node.minGrade) parts.push(`min: ${node.minGrade}`);
			if (node.canBeTakenConcurrently === "true") parts.push("(concurrent)");
			return <div className="text-gray-600 dark:text-gray-400 text-xs">{parts.join(" ")}</div>;
		}
		
		// courseCount: count (required), department? (optional), level? (optional), minGrade? (optional), canBeTakenConcurrently? (optional)
		if (node.type === "courseCount" && node.count != null) {
			const parts: string[] = [`${node.count} ${node.count === 1 ? "course" : "courses"}`];
			if (node.department) {
				const deptStr = Array.isArray(node.department) ? node.department.join("/") : node.department;
				parts.push(`from ${deptStr}`);
			}
			if (node.level) parts.push(`(${node.level})`);
			if (node.minGrade) parts.push(`min: ${node.minGrade}`);
			if (node.canBeTakenConcurrently === "true") parts.push("(concurrent)");
			return <div className="text-gray-600 dark:text-gray-400 text-xs">{parts.join(" ")}</div>;
		}
		
		// permission: note (required)
		if (node.type === "permission" && node.note) {
			return (
				<div className="text-gray-700 dark:text-gray-300 text-xs">
					<span className="font-medium">Permission required:</span> {node.note}
				</div>
			);
		}
		
		// other: note (required)
		if (node.type === "other" && node.note) {
			return <div className="text-gray-700 dark:text-gray-300 text-xs">{node.note}</div>;
		}
		
		return null;
	};

	return (
		<div
			className={`shadow-lg rounded-lg border ${
				n.highlight ? "border-gray-900 dark:border-gray-100 ring-2 ring-gray-300 dark:ring-gray-600" : "border-gray-300 dark:border-gray-600"
			} bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 select-none`}
			style={{
				width: n.width,
				// height auto based on content; keep a minHeight for stability
				minHeight: n.height,
				pointerEvents: "auto",
			}}
		>
			<div className="p-3 border-b border-gray-200 dark:border-gray-700">
				<div className="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-300">
					{n.title}
				</div>
				{subtitle ? (
					<div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
				) : null}
			</div>
			<div className="p-3">
		{course && course.parsed_prerequisites ? (
					<>
						<div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
							Prerequisites:
						</div>
						<div className="flex flex-col gap-1 text-xs">{renderNode(course.parsed_prerequisites as SFUPrereqNode)}</div>
					</>
					) : (
						<div className="text-xs text-gray-500 dark:text-gray-400">
							{missingData ? (
								<>
									This course hasn&apos;t been parsed yet. Contribute today at{" "}
									<a
										data-pan-block
										href="https://crowdsource.sfucourses.com"
										className="underline hover:opacity-80"
										target="_blank"
										rel="noopener noreferrer"
									>
										crowdsource.sfucourses.com
									</a>
								</>
							) : noPrereqs ? (
								"No prerequisites."
							) : (
								"No prerequisites."
							)}
						</div>
				)}
			</div>
		</div>
	);
}

interface CourseGraphProps {
  courseId: string;
  courses: Course[];
}

export default function CourseGraph({ courseId: initialCourseId, courses }: CourseGraphProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const depthRef = useRef<Map<string, number>>(new Map());

  // Create course map from the provided courses
  const courseMap = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((course) => {
      const key = `${course.dept} ${course.number}`;
      map.set(key, course);
    });
    return map;
  }, [courses]);

	// Dynamic root id (use the provided courseId)
	const rootId = initialCourseId;

	const [nodes, setNodes] = useState<SimNode[]>([]);
	const [links, setLinks] = useState<SimLink[]>([]);
	const nodesRef = useRef<SimNode[]>(nodes);
	const linksRef = useRef<SimLink[]>(links);
		const [, forceRender] = useState({});

	// Remember which children were open when a coursecard was closed,
	// so we can reopen them if that course is reopened later
	const [reopenMemory, setReopenMemory] = useState<Map<string, Set<string>>>(new Map());
	const reopenMemoryRef = useRef(reopenMemory);
	useEffect(() => void (reopenMemoryRef.current = reopenMemory), [reopenMemory]);

	// View transform (pan/zoom)
	const [view, setView] = useState({ x: 0, y: 0, k: 1 });
	const viewRef = useRef(view);
	useEffect(() => void (viewRef.current = view), [view]);
	// Touch: single-finger pan, two-finger pinch zoom
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		let panActive = false;
		let pinchActive = false;
		let lastX = 0, lastY = 0;
		let lastDist = 0;

		const getTouchMid = (t1: Touch, t2: Touch) => {
			const rect = container.getBoundingClientRect();
			return {
				x: (t1.clientX + t2.clientX) / 2 - rect.left,
				y: (t1.clientY + t2.clientY) / 2 - rect.top,
			};
		};
		const getTouchDist = (t1: Touch, t2: Touch) => {
			const dx = t1.clientX - t2.clientX;
			const dy = t1.clientY - t2.clientY;
			return Math.sqrt(dx * dx + dy * dy);
		};

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 1) {
				lastX = e.touches[0].clientX;
				lastY = e.touches[0].clientY;
				panActive = true;
			} else if (e.touches.length === 2) {
				pinchActive = true;
				panActive = false;
				lastDist = getTouchDist(e.touches[0], e.touches[1]);
			}
		};
		const onTouchMove = (e: TouchEvent) => {
			if (pinchActive && e.touches.length === 2) {
				e.preventDefault();
				const dist = getTouchDist(e.touches[0], e.touches[1]);
				if (lastDist === 0) {
					lastDist = dist;
					return;
				}
				const mid = getTouchMid(e.touches[0], e.touches[1]); // container-relative
				const { x, y, k } = viewRef.current;
				const scaleDelta = dist / lastDist;
				const unclampedK = k * scaleDelta;
				const newK = Math.max(0.3, Math.min(3.0, unclampedK));
				// Keep the world point under the current midpoint stationary while scaling
				const worldX = (mid.x - x) / k;
				const worldY = (mid.y - y) / k;
				const newX = mid.x - worldX * newK;
				const newY = mid.y - worldY * newK;
				setView({ x: newX, y: newY, k: newK });
				lastDist = dist;
			} else if (panActive && e.touches.length === 1) {
				const dx = e.touches[0].clientX - lastX;
				const dy = e.touches[0].clientY - lastY;
				if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
					e.preventDefault();
				}
			}
		};
		const onTouchEnd = (e: TouchEvent) => {
			if (e.touches.length === 0) {
				panActive = false;
				pinchActive = false;
			} else if (e.touches.length === 1) {
				pinchActive = false;
				panActive = true;
				lastX = e.touches[0].clientX;
				lastY = e.touches[0].clientY;
			}
		};
		container.addEventListener("touchstart", onTouchStart, { passive: false });
		container.addEventListener("touchmove", onTouchMove, { passive: false });
		container.addEventListener("touchend", onTouchEnd);
		return () => {
			container.removeEventListener("touchstart", onTouchStart);
			container.removeEventListener("touchmove", onTouchMove);
			container.removeEventListener("touchend", onTouchEnd);
		};
	}, []);
	const [isPanning, setIsPanning] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	// Stable drag state (avoid effect rebinds mid-drag)
	const draggingRef = useRef(false);
	const movedRef = useRef(false);
	const panStartRef = useRef({ x: 0, y: 0 });
	const panOrigRef = useRef({ x: 0, y: 0 });

	// Layout settings (tweak live via control panel)
	const [settings, setSettings] = useState({
		ringBase: 50,      // radius for depth 1 ring offset from center
		ringStep: 350,      // radius increment per additional depth
		iterations: 32,     // relax iterations per layout
		sepPadding: 16,     // extra spacing added to collision boxes
		ringSpring: 0.15,   // strength towards ring radius
		pullAlpha: 0.40,    // strength towards target coordinates
		clampPad: 24,       // viewport clamp padding
		pinClicked: false,  // pin nodes when clicked (persisted)
		animate: true,      // animate layout steps
		showRings: false,   // debug: render ring guides
		ringCount: 4,       // number of guide rings to draw
		useParentAnchors: true, // place deeper rings near parents' angles
		ringSpacingPad: 16, // extra spacing for same-ring angular separation
	showMinGrade: false, // render min grade on transcript items
	});

	// Keep refs in sync
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
			// Allow ctrl+wheel native zoom? Always prevent default to avoid page scroll
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

	// Initialize/reset root node when rootId changes (layout effect to avoid first-paint jump)
	useLayoutEffect(() => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const cx = rect.width / 2;
		const cy = rect.height / 2;
		const rootData = courseMap.get(rootId);    
		const root: SimNode = {
			id: rootId,
			title: rootId,
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
	}, [rootId, courseMap]);

		// Precompute depths from root using courseMap
		useEffect(() => {
			const buildAdj = (): Map<string, string[]> => {
				const m = new Map<string, string[]>();
				Array.from(courseMap.keys()).forEach((id) => {
					m.set(id, listDirectPrereqCourses(id, courseMap));
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
			depthRef.current = bfs(rootId, adj);
		}, [rootId, courseMap]);

	// Custom deterministic layout: concentric rings by depth + pairwise separation (bounce)
	useEffect(() => {
		if (!containerRef.current) return;
		if (!nodesRef.current.length) return;

		const rect = containerRef.current.getBoundingClientRect();
		const root = nodesRef.current.find((n) => n.id === rootId);
		const cx = root?.fx ?? rect.width / 2;
		const cy = root?.fy ?? rect.height / 2;

		// Build depth groups for present nodes
		const depthGroups = new Map<number, string[]>();
		nodesRef.current.forEach((n) => {
			const d = depthRef.current.get(n.id) ?? 0;
			const arr = depthGroups.get(d) ?? [];
			arr.push(n.id);
			depthGroups.set(d, arr);
		});
		// Sort each group deterministically
		depthGroups.forEach((arr, d) => {
			if (d === 0) return;
			arr.sort();
		});

		// Angle assignment per ring:
		// - depth 1: deterministic, even spacing
		// - depth >= 2: parent-centered clusters; siblings pack tightly around the parent's angle.
		const angleMap = new Map<string, number>();
		angleMap.set(rootId, 0);
		// (circular helpers no longer needed; using segment-based packing)
		// sort depths ascending for sequential dependency (need d-1 angles first)
		const presentDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
		for (const d of presentDepths) {
			if (d === 0) continue;
			const arr = depthGroups.get(d)!; // sorted earlier
			const k = Math.max(1, arr.length);
			// helper even angle
			const evenAngle = (idx: number) => -Math.PI + (2 * Math.PI * idx) / k;
			if (d === 1) {
				arr.forEach((id, idx) => angleMap.set(id, evenAngle(idx)));
				continue;
			}
			// d >= 2: cluster children around parent angles for closeness
			if (settings.useParentAnchors) {
				const r = settings.ringBase + d * settings.ringStep;
				const basePad = settings.ringSpacingPad / Math.max(1, r);
				// Gather parents on d-1 with known angles
				const parentsOnPrev = nodesRef.current
					.filter((p) => (depthRef.current.get(p.id) ?? 0) === d - 1)
					.map((p) => ({ id: p.id, angle: angleMap.get(p.id) }))
					.filter((p): p is { id: string; angle: number } => typeof p.angle === 'number');
				const parentAngleMap = new Map(parentsOnPrev.map((p) => [p.id, p.angle] as const));

				// Decide a primary parent for each child
				type ChildInfo = { id: string; width: number; primaryParent?: string };
				const childInfos: ChildInfo[] = arr.map((id) => {
					const node = nodesRef.current.find((n) => n.id === id);
					const width = node?.width ?? 300;
					// candidates are present parents at d-1
					const candidates = nodesRef.current
						.filter((p) => (depthRef.current.get(p.id) ?? 0) === d - 1 && listDirectPrereqCourses(p.id, courseMap).includes(id))
						.map((p) => p.id)
						.filter((pid) => parentAngleMap.has(pid));
					let primary: string | undefined = node?.primaryParentId && candidates.includes(node.primaryParentId) ? node.primaryParentId : undefined;
					if (!primary && candidates.length) {
						// pick the first deterministically
						primary = candidates.sort()[0];
					}
					return { id, width, primaryParent: primary };
				});

				// Build clusters (parent -> children)
				const clusters: Array<{
					parentId: string;
					center: number;
					children: Array<{ id: string; width: number; angle?: number }>;
				}> = [];
				const clusterMap = new Map<string, number>();
				for (const c of childInfos) {
					if (c.primaryParent) {
						const idx = clusterMap.get(c.primaryParent);
						if (idx == null) {
							clusters.push({ parentId: c.primaryParent, center: parentAngleMap.get(c.primaryParent)!, children: [{ id: c.id, width: c.width }] });
							clusterMap.set(c.primaryParent, clusters.length - 1);
						} else {
							clusters[idx].children.push({ id: c.id, width: c.width });
						}
					}
				}
				// Unclustered nodes -> treat as their own tiny clusters using even spacing
				const clusteredIds = new Set<string>(clusters.flatMap((cl) => cl.children.map((ch) => ch.id)));
				const unclustered: Array<{ parentId: string; center: number; children: Array<{ id: string; width: number; angle?: number }> }> = [];
				arr.forEach((id, idx) => {
					if (!clusteredIds.has(id)) {
						const node = nodesRef.current.find((n) => n.id === id);
						unclustered.push({ parentId: `__free_${id}`, center: evenAngle(idx), children: [{ id, width: node?.width ?? 300 }] });
					}
				});
				let segments = clusters.concat(unclustered).map((cl) => ({ ...cl, children: cl.children.sort((a, b) => a.id.localeCompare(b.id)) }));

				// Initial per-cluster placement: pack children within a span around the center
				for (const seg of segments) {
					const widths = seg.children.map((c) => c.width / Math.max(1, r));
					const innerPads = Math.max(0, seg.children.length - 1) * basePad;
					const span = widths.reduce((a, b) => a + b, 0) + innerPads;
					let cursor = seg.center - span / 2;
					for (let i = 0; i < seg.children.length; i++) {
						const w = widths[i];
						cursor += w / 2;
						seg.children[i].angle = cursor;
						cursor += w / 2;
						if (i < seg.children.length - 1) cursor += basePad;
					}
				}

				// Resolve overlaps between segments along the circle (unwrap, push forward, wrap back)
				const twoPi = Math.PI * 2;
				segments = segments.sort((a, b) => a.center - b.center);
				if (segments.length > 0) {
					// unwrap angles to be monotonically increasing
					let lastEnd = segments[0].children[segments[0].children.length - 1].angle!;
					for (let i = 1; i < segments.length; i++) {
						const seg = segments[i];
						// shift this seg forward until its first child is after lastEnd + basePad
						let first = seg.children[0].angle!;
						while (first <= lastEnd + basePad) {
							for (const ch of seg.children) ch.angle = (ch.angle ?? 0) + twoPi;
							first = seg.children[0].angle!;
						}
						// ensure spacing from lastEnd
						const shift = (lastEnd + basePad) - seg.children[0].angle!;
						if (shift > 0) {
							for (const ch of seg.children) ch.angle = (ch.angle ?? 0) + shift;
						}
						lastEnd = seg.children[seg.children.length - 1].angle!;
					}
					// wrap back to [-π, π]
					for (const seg of segments) {
						for (const ch of seg.children) {
							const a = ch.angle ?? 0;
							// normalize
							let x = a;
							while (x <= -Math.PI) x += twoPi;
							while (x > Math.PI) x -= twoPi;
							ch.angle = x;
						}
					}
				}

				// Commit child angles
				for (const seg of segments) {
					for (const ch of seg.children) {
						angleMap.set(ch.id, ch.angle ?? 0);
					}
				}

				continue; // move to next depth
			}

			// Fallback when not using parent anchors: even spacing
			arr.forEach((id, idx) => angleMap.set(id, evenAngle(idx)));
		}

		// Target positions on rings by depth
		const targets = new Map<string, { x: number; y: number; r: number }>();
		nodesRef.current.forEach((n) => {
			const d = depthRef.current.get(n.id) ?? 0;
			if (d === 0) {
				targets.set(n.id, { x: cx, y: cy, r: 0 });
				return;
			}
			const r = settings.ringBase + d * settings.ringStep;
			const ang = angleMap.get(n.id) ?? 0;
			const tx = cx + r * Math.cos(ang);
			const ty = cy + r * Math.sin(ang);
			targets.set(n.id, { x: tx, y: ty, r });
			if (n.x == null || n.y == null) { n.x = tx; n.y = ty; }
		});


		// Iterative relax: pull to target + pairwise separation + ring correction
		const iterations = Math.max(1, Math.min(200, Math.floor(settings.iterations)));
		const pad = settings.clampPad;
		// World-space bounds (so nodes can exist outside the viewport and be panned into view)
		let maxDepthAll = 0;
		depthRef.current.forEach((d) => { if (d > maxDepthAll) maxDepthAll = d; });
		const rMax = settings.ringBase + maxDepthAll * settings.ringStep;
		const worldPad = Math.max(800, settings.ringStep * 2);
		const minX = cx - rMax - worldPad;
		const maxX = cx + rMax + worldPad;
		const minY = cy - rMax - worldPad;
		const maxY = cy + rMax + worldPad;

		// Ensure a valid target exists for any node (handles nodes added mid-frame)
		type Target = { x: number; y: number; r: number };
		const ensureTargetForNode = (n: SimNode): Target => {
			const d = depthRef.current.get(n.id) ?? 0;
			if (d === 0) return { x: cx, y: cy, r: 0 };
			const r = settings.ringBase + d * settings.ringStep;
			const ang = angleMap.get(n.id) ?? Math.atan2((n.y ?? cy) - cy, (n.x ?? cx) - cx);
			return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), r };
		};

		const stepOnce = () => {
			// Pull towards target
			nodesRef.current.forEach((n) => {
				if ((n.pinned || n.hoverPinned) && n.fx != null && n.fy != null) {
					n.x = n.fx;
					n.y = n.fy;
					return;
				}
				const t = targets.get(n.id) ?? ensureTargetForNode(n);
				const alpha = settings.pullAlpha;
				n.x = (n.x ?? t.x) + (t.x - (n.x ?? t.x)) * alpha;
				n.y = (n.y ?? t.y) + (t.y - (n.y ?? t.y)) * alpha;
			});

			// Pairwise separation (AABB overlap resolution)
			const arr = nodesRef.current;
			for (let i = 0; i < arr.length; i++) {
				for (let j = i + 1; j < arr.length; j++) {
					const a = arr[i];
					const b = arr[j];
					const ax = a.x ?? 0, ay = a.y ?? 0, bx = b.x ?? 0, by = b.y ?? 0;
					const halfW = a.width / 2 + b.width / 2 + settings.sepPadding;
					const halfH = Math.max(a.height, 100) / 2 + Math.max(b.height, 100) / 2 + settings.sepPadding;
					const dx = bx - ax;
					const dy = by - ay;
					const overlapX = halfW - Math.abs(dx);
					const overlapY = halfH - Math.abs(dy);
					if (overlapX > 0 && overlapY > 0) {
						let mx = 0, my = 0;
						if (overlapX > overlapY) {
							my = (dy === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dy)) * overlapY;
						} else {
							mx = (dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx)) * overlapX;
						}
						const aPinned = a.pinned || a.hoverPinned || a.id === rootId;
						const bPinned = b.pinned || b.hoverPinned || b.id === rootId;
						if (aPinned && bPinned) continue;
						if (aPinned) {
							b.x = (b.x ?? bx) + mx * 0.9;
							b.y = (b.y ?? by) + my * 0.9;
						} else if (bPinned) {
							a.x = (a.x ?? ax) - mx * 0.9;
							a.y = (a.y ?? ay) - my * 0.9;
						} else {
							a.x = (a.x ?? ax) - mx * 0.5;
							a.y = (a.y ?? ay) - my * 0.5;
							b.x = (b.x ?? bx) + mx * 0.5;
							b.y = (b.y ?? by) + my * 0.5;
						}
					}
				}
			}

			// Ring correction towards desired radius from center
			nodesRef.current.forEach((n) => {
				if (n.pinned || n.hoverPinned || n.id === rootId) return;
				const t = targets.get(n.id) ?? ensureTargetForNode(n);
				const dx = (n.x ?? t.x) - cx;
				const dy = (n.y ?? t.y) - cy;
				const r = Math.hypot(dx, dy) || 1;
				const desired = t.r;
				const kk = ((desired - r) / r) * settings.ringSpring;
				n.x = (n.x ?? t.x) + dx * kk;
				n.y = (n.y ?? t.y) + dy * kk;
			});

			// Clamp to large world bounds (not viewport) so deeper rings can sit offscreen
			nodesRef.current.forEach((n) => {
				if (n.x != null && n.y != null) {
					n.x = Math.max(minX + pad, Math.min(maxX - pad, n.x));
					n.y = Math.max(minY + pad, Math.min(maxY - pad, n.y));
				}
			});
		};

		if (!settings.animate) {
			for (let step = 0; step < iterations; step++) stepOnce();
			forceRender({});
			return;
		}

		let rafId = 0;
		let step = 0;
		const itersPerFrame = 2;
		const frame = () => {
			for (let i = 0; i < itersPerFrame && step < iterations; i++, step++) {
				stepOnce();
			}
			forceRender({});
			if (step < iterations) {
				rafId = requestAnimationFrame(frame);
			}
		};
		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
	}, [
		nodes.length,
		links.length,
		settings.ringBase,
		settings.ringStep,
		settings.iterations,
		settings.sepPadding,
		settings.ringSpring,
		settings.pullAlpha,
		settings.clampPad,
		settings.ringSpacingPad,
		settings.useParentAnchors,
		settings.animate,
		rootId,
		courseMap,
	]);

	// Helpers to mutate graph
	const upsertNode = useCallback(
		(
			id: string,
			opts: Partial<SimNode> & { persisted?: boolean; anchorParentId?: string }
		) => {
			// If a parent is provided, proactively set the child's depth so layout
			// doesn't treat it as depth 0 for the first frame. However, do NOT override
			// depth for already-persisted nodes (hover shouldn't change persisted nodes).
			if (opts.anchorParentId) {
				const existing = nodesRef.current.find((n) => n.id === id);
				const shouldSetDepth = !existing || !existing.persisted;
				if (shouldSetDepth) {
					const pd = depthRef.current.get(opts.anchorParentId) ?? 0;
					const nd = Math.max(1, pd + 1);
					depthRef.current.set(id, nd);
				}
			}
			setNodes((prev) => {
				const exists = prev.find((n) => n.id === id);
				if (exists) {
					// Update flags
					const updated = prev.map((n) => {
						if (n.id !== id) return n;
						const wasPersisted = !!n.persisted;
						const nowPersisted = opts.persisted ? true : n.persisted;
						// Only allow changing primaryParentId if the node is not yet persisted
						// (i.e., during hover/creation) or when promoting from ephemeral to persisted.
						let nextPrimary = n.primaryParentId;
						if (opts.anchorParentId) {
							if (!wasPersisted) {
								nextPrimary = opts.anchorParentId;
							}
						}
						return {
							...n,
							persisted: nowPersisted,
							highlight: opts.highlight ?? n.highlight,
							primaryParentId: nextPrimary,
						};
					});
					return updated;
				}
				const rect = containerRef.current?.getBoundingClientRect();
				const width = rect?.width ?? 800;
				const height = rect?.height ?? 600;
				const root = prev.find((n) => n.id === "ECON 201");
				const cx = root?.fx ?? width / 2;
				const cy = root?.fy ?? height / 2;
					// Determine deterministic target angle and radius based on depth ring
					let d = Math.max(1, depthRef.current.get(id) ?? 1);
					const rForDepth = (depth: number) => settings.ringBase + depth * settings.ringStep;
					let tx = cx, ty = cy;
					let seeded = false;
					// If a parent anchor is provided and we're placing on depth >= 2, seed near the parent's radial angle
					if (opts.anchorParentId) {
						const parentDepth = depthRef.current.get(opts.anchorParentId) ?? undefined;
						if (parentDepth != null) d = Math.max(d, parentDepth + 1);
						if (d >= 2) {
							const parent = prev.find((n) => n.id === opts.anchorParentId);
							if (parent) {
								const px = parent.fx ?? parent.x ?? cx;
								const py = parent.fy ?? parent.y ?? cy;
								const angP = Math.atan2(py - cy, px - cx);
								const rTarget = rForDepth(d);
								tx = cx + rTarget * Math.cos(angP);
								ty = cy + rTarget * Math.sin(angP);
								seeded = true;
							}
						}
					}
					// Fallback: distribute evenly among nodes on the same depth ring (good for depth 1 or when no parent info)
					if (!seeded) {
						const sameDepthIds = prev
							.filter((n) => (depthRef.current.get(n.id) ?? 0) === d)
							.map((n) => n.id)
							.sort();
						if (!sameDepthIds.includes(id)) sameDepthIds.push(id);
						sameDepthIds.sort();
						const idx = Math.max(0, sameDepthIds.indexOf(id));
						const k = Math.max(1, sameDepthIds.length);
						const ang = -Math.PI + (2 * Math.PI * idx) / k;
						const rTarget = rForDepth(d);
						tx = cx + rTarget * Math.cos(ang);
						ty = cy + rTarget * Math.sin(ang);
					}
				// Seed close to target to avoid snapping when promoted from hover to click
				const jitter = 8;
				const x = tx + (Math.random() - 0.5) * jitter;
				const y = ty + (Math.random() - 0.5) * jitter;
				const newNode: SimNode = {
					id,
					title: id,
					subtitle: courseMap.get(id)?.title,
					persisted: !!opts.persisted,
					primaryParentId: opts.anchorParentId,
					width: 300,
					height: 120,
					x,
					y,
					vx: 0,
					vy: 0,
					highlight: opts.highlight,
				};
				return [...prev, newNode];
			});
		},
		[settings.ringBase, settings.ringStep, courseMap]
	);

	const removeNodeIfEphemeral = useCallback((id: string) => {
		setNodes((prev) => {
			const n = prev.find((p) => p.id === id);
			if (!n) return prev;
			if (n.persisted) return prev;
			// Remove node and any links attached to it
			setLinks((linksPrev) =>
				linksPrev.filter(
					(l) => (typeof l.source === "string" ? l.source : l.source.id) !== id &&
									(typeof l.target === "string" ? l.target : l.target.id) !== id
				)
			);
			return prev.filter((p) => p.id !== id);
		});
	}, []);

	const ensureLink = useCallback((src: string, tgt: string, ephemeral?: boolean) => {
		setLinks((prev) => {
			const idx = prev.findIndex((l) => {
				const s = typeof l.source === "string" ? l.source : l.source.id;
				const t = typeof l.target === "string" ? l.target : l.target.id;
				return s === src && t === tgt;
			});
			if (idx >= 0) {
				// Upgrade ephemeral link to persistent when requested
				if (prev[idx].ephemeral && !ephemeral) {
					const copy = [...prev];
					copy[idx] = { ...copy[idx], ephemeral: undefined };
					return copy;
				}
				return prev;
			}
			return [...prev, { source: src, target: tgt, ephemeral }];
		});
	}, []);

	const removeEphemeralLink = useCallback((src: string, tgt: string) => {
		setLinks((prev) => prev.filter((l) => {
			const s = typeof l.source === "string" ? l.source : l.source.id;
			const t = typeof l.target === "string" ? l.target : l.target.id;
			return !(l.ephemeral && s === src && t === tgt);
		}));
	}, []);

	// UI event handlers
	const handleButtonClick = useCallback(
		(parentId: string, courseId: string) => {
					const existing = nodesRef.current.find((n) => n.id === courseId);
					if (existing?.persisted) {
						// Cascade-close: remove this course and any of its children that have no other parents
						const presentPersisted = new Set(
							nodesRef.current.filter((n) => n.persisted).map((n) => n.id)
						);
						// Helper: count parents of a child among present persisted nodes excluding those in remove set
						const parentCount = (child: string, remove: Set<string>) => {
							let cnt = 0;
							for (const p of presentPersisted) {
								if (remove.has(p)) continue;
								const prereqs = listDirectPrereqCourses(p, courseMap);
								if (prereqs.includes(child)) cnt++;
							}
							return cnt;
						};
						const removeSet = new Set<string>([courseId]);
						const queue: string[] = [courseId];
						const directClosed = new Set<string>();
						while (queue.length) {
							const u = queue.shift()!;
							const children = listDirectPrereqCourses(u, courseMap);
							for (const c of children) {
								// Only consider removing if child is currently present and persisted
								if (!presentPersisted.has(c)) continue;
								if (parentCount(c, removeSet) === 0) {
									if (!removeSet.has(c)) {
										removeSet.add(c);
										queue.push(c);
									}
									// Track only immediate children of the root courseId
									if (u === courseId) directClosed.add(c);
								}
							}
						}

						// Apply removals
						setNodes((prev) => prev.filter((n) => !removeSet.has(n.id)));
						setLinks((linksPrev) =>
							linksPrev.filter((l) => {
								const s = typeof l.source === "string" ? l.source : l.source.id;
								const t = typeof l.target === "string" ? l.target : l.target.id;
								return !removeSet.has(s) && !removeSet.has(t);
							})
						);

						// Remember direct children that were closed due to only this parent
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

					// Otherwise create/persist it and link from parent
					upsertNode(courseId, { persisted: true, highlight: true, anchorParentId: parentId });
					ensureLink(parentId, courseId, false);
					removeEphemeralLink(parentId, courseId);

					// Reopen previously remembered subtree under this course (recursive)
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
								upsertNode(c, { persisted: true, anchorParentId: p });
								ensureLink(p, c, false);
								q.push(c);
							}
						}
					};
					reopenSubtree(courseId);
					// Clear memory for this courseId now that we've reopened its children
					setReopenMemory((prev) => {
						if (!prev.has(courseId)) return prev;
						const m = new Map(prev);
						m.delete(courseId);
						return m;
					});
					if (settings.pinClicked) {
						setNodes((prev) =>
							prev.map((n) =>
								n.id === courseId ? { ...n, pinned: true, fx: n.x, fy: n.y } : n
							)
						);
					}
					setTimeout(() => {
						setNodes((prev) =>
							prev.map((n) => (n.id === courseId ? { ...n, highlight: false } : n))
						);
					}, 600);
		},
			[ensureLink, removeEphemeralLink, upsertNode, settings.pinClicked, courseMap]
	);

	const handleButtonHoverIn = useCallback(
		(parentId: string, courseId: string) => {
				// temporarily pin the parent to prevent it moving under the cursor
			setNodes((prev) => {
				const updatedNodes = prev.map((n) =>
					n.id === parentId
						? {
								...n,
								hoverPinned: true,
								fx: n.x,
								fy: n.y,
							}
						: n
				);
				// Always highlight the target course on hover; if it exists, just set highlight; else create ephemeral highlighted
				const exists = updatedNodes.find((p) => p.id === courseId);
				if (exists) {
					// sync ref immediately so render that depends on nodesRef shows the highlight
					const refNode = nodesRef.current.find((p) => p.id === courseId);
					if (refNode) refNode.highlight = true;
					return updatedNodes.map((p) => (p.id === courseId ? { ...p, highlight: true } : p));
				}
				upsertNode(courseId, { persisted: false, highlight: true, anchorParentId: parentId });
				ensureLink(parentId, courseId, true);
				return updatedNodes;
			});
		},
		[ensureLink, upsertNode]
	);

	const handleButtonHoverOut = useCallback(
		(parentId: string, courseId: string) => {
			// remove highlight
			setNodes((prev) => {
				const updatedNodes = prev.map((n) => (n.id === courseId ? { ...n, highlight: false } : n));
				// sync ref immediately
				const refNode = nodesRef.current.find((p) => p.id === courseId);
				if (refNode) refNode.highlight = false;
				// unpin the parent if it was only hover-pinned (keep static pin for root)
				return updatedNodes.map((n) => {
					if (n.id !== parentId) return n;
					const keepStatic = !!n.pinned;
					return {
						...n,
						hoverPinned: false,
						fx: keepStatic ? n.fx : undefined,
						fy: keepStatic ? n.fy : undefined,
					} as SimNode;
				});
			});
			removeEphemeralLink(parentId, courseId);
			removeNodeIfEphemeral(courseId);
		},
		[removeEphemeralLink, removeNodeIfEphemeral]
	);

		// Automatically keep persistent links between any two existing related courses
		useEffect(() => {
			if (!nodesRef.current.length) return;
			const present = new Set(nodesRef.current.map((n) => n.id));
			// For every present parent, if a present prerequisite exists, ensure persistent link
			nodesRef.current.forEach((parent) => {
				const prereqs = listDirectPrereqCourses(parent.id, courseMap);
				prereqs.forEach((cid) => {
					if (present.has(cid)) {
						// remove ephemeral link if exists, then ensure persistent
						setLinks((prev) => {
							const sId = parent.id;
							const tId = cid;
							let changed = false;
							const filtered = prev.filter((l) => {
								const s = typeof l.source === "string" ? l.source : l.source.id;
								const t = typeof l.target === "string" ? l.target : l.target.id;
								if (s === sId && t === tId && l.ephemeral) {
									changed = true;
									return false;
								}
								return true;
							});
							const exists = filtered.some((l) => {
								const s = typeof l.source === "string" ? l.source : l.source.id;
								const t = typeof l.target === "string" ? l.target : l.target.id;
								return s === sId && t === tId;
							});
							if (!exists) {
								changed = true;
								filtered.push({ source: sId, target: tId });
							}
							return changed ? filtered : prev;
						});
					}
				});
			});
		}, [nodes.length, links.length, settings, courseMap]);

	// Render links in SVG and nodes as absolutely-positioned DIVs
		// (size calc not currently needed; SVG and container are full-size)

	// Convenience helper
	const getNodePos = (id: string) => {
		const n = nodesRef.current.find((x) => x.id === id);
		return n ? { x: n.x ?? 0, y: n.y ?? 0 } : { x: 0, y: 0 };
	};

	const presentSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

	return (
		<div className="w-full h-[100vh]">
			<div
				ref={containerRef}
				className={`relative w-full h-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
			>
				{/* Home button - top left */}
				<div data-pan-block className="absolute top-2 left-2 z-20">
					<Link
						href="/sfu/courses"
						className="inline-flex items-center gap-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200"
						title="Home"
					>
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
							<path d="M3 10.5L12 3l9 7.5" />
							<path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
						</svg>
						<span className="hidden sm:inline">Home</span>
					</Link>
				</div>
					{/* Fullscreen button - top right */}
					<div data-pan-block className="absolute top-2 right-2 z-20">
						<button
							className="inline-flex items-center gap-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200"
							onClick={() => {
								if (!document.fullscreenElement) {
									containerRef.current?.requestFullscreen();
								} else {
									document.exitFullscreen();
								}
							}}
							title="Toggle fullscreen"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
								<path d="M4 8V4h4M4 4l6 6" />
								<path d="M20 8V4h-4m4 0l-6 6" />
								<path d="M4 16v4h4m-4 0l6-6" />
								<path d="M20 16v4h-4m4 0l-6-6" />
							</svg>
							<span className="hidden sm:inline">Fullscreen</span>
						</button>
					</div>

					{/* Settings panel - bottom left with toggle */}
					<div data-pan-block className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2">
						{showSettings && (
							<div className="w-72 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow p-3 text-xs text-gray-800 dark:text-gray-200">
								<div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Layout controls</div>
						<div className="space-y-2">
							<label className="flex items-center justify-between gap-2">
								<span>Ring base</span>
								<input type="range" min={0} max={300} step={10} value={settings.ringBase}
									onChange={(e) => setSettings(s => ({ ...s, ringBase: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.ringBase}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Ring step</span>
								<input type="range" min={60} max={600} step={10} value={settings.ringStep}
									onChange={(e) => setSettings(s => ({ ...s, ringStep: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.ringStep}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Iterations</span>
								<input type="range" min={1} max={200} step={1} value={settings.iterations}
									onChange={(e) => setSettings(s => ({ ...s, iterations: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.iterations}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Collision pad</span>
								<input type="range" min={0} max={48} step={1} value={settings.sepPadding}
									onChange={(e) => setSettings(s => ({ ...s, sepPadding: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.sepPadding}</span>
							</label>
							{/* <label className="flex items-center justify-between gap-2">
								<span>Ring spring</span>
								<input type="range" min={0} max={0.6} step={0.01} value={settings.ringSpring}
									onChange={(e) => setSettings(s => ({ ...s, ringSpring: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.ringSpring.toFixed(2)}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Pull alpha</span>
								<input type="range" min={0} max={1} step={0.01} value={settings.pullAlpha}
									onChange={(e) => setSettings(s => ({ ...s, pullAlpha: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.pullAlpha.toFixed(2)}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Clamp pad</span>
								<input type="range" min={0} max={100} step={1} value={settings.clampPad}
									onChange={(e) => setSettings(s => ({ ...s, clampPad: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.clampPad}</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Ring spacing pad</span>
								<input type="range" min={0} max={64} step={1} value={settings.ringSpacingPad}
									onChange={(e) => setSettings(s => ({ ...s, ringSpacingPad: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.ringSpacingPad}</span>
							</label>
							<label className="flex items-center gap-2">
								<input type="checkbox" checked={settings.pinClicked}
									onChange={(e) => setSettings(s => ({ ...s, pinClicked: e.target.checked }))} />
								<span>Pin nodes on click</span>
							</label> */}
							<label className="flex items-center gap-2">
								<input type="checkbox" checked={settings.animate}
									onChange={(e) => setSettings(s => ({ ...s, animate: e.target.checked }))} />
								<span>Animate layout</span>
							</label>
							<label className="flex items-center gap-2">
								<input type="checkbox" checked={settings.useParentAnchors}
									onChange={(e) => setSettings(s => ({ ...s, useParentAnchors: e.target.checked }))} />
								<span>Anchor deeper rings to parents</span>
							</label>
							<label className="flex items-center gap-2">
								<input type="checkbox" checked={settings.showMinGrade}
									onChange={(e) => setSettings(s => ({ ...s, showMinGrade: e.target.checked }))} />
								<span>Show minimum grade</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={settings.showRings}
									onChange={(e) => setSettings((s) => ({ ...s, showRings: e.target.checked }))}
								/>
								<span>Show rings</span>
							</label>
							<label className="flex items-center justify-between gap-2">
								<span>Rings drawn</span>
								<input type="range" min={1} max={10} step={1} value={settings.ringCount}
									onChange={(e) => setSettings(s => ({ ...s, ringCount: Number(e.target.value) }))} />
								<span className="w-10 text-right">{settings.ringCount}</span>
							</label>
							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-neutral-50 dark:hover:bg-neutral-700"
									onClick={() => setView({ x: 0, y: 0, k: 1 })}
								>
									Reset view
								</button>
							</div>
						</div>
						</div>
						)}
						<button
							className="inline-flex items-center gap-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow px-3 py-2 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200"
							onClick={() => setShowSettings(!showSettings)}
							title="Toggle settings"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
								<path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
								<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004 15a1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 004 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 008 4a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09A1.65 1.65 0 0015 4c.48 0 .93-.17 1.28-.46l.06-.06a2 2 0 012.83 2.83l-.06.06c-.29.35-.46.8-.46 1.28 0 .6.23 1.13.6 1.51.38.38.6.91.6 1.51s-.22 1.13-.6 1.51c-.37.38-.6.91-.6 1.51z" />
							</svg>
							<span className="hidden sm:inline">{showSettings ? 'Hide' : 'Show'} Settings</span>
						</button>
					</div>

					{/* Bottom-right map controls */}
					<div data-pan-block className="absolute bottom-3 right-3 z-20 flex flex-col items-stretch gap-2">
						<div className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow overflow-hidden">
							<button
								className="block w-10 h-10 leading-10 text-center border-b border-gray-200 dark:border-gray-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 select-none"
								onClick={() => {
									const el = containerRef.current;
									if (!el) return;
									const rect = el.getBoundingClientRect();
									const mx = rect.width / 2; const my = rect.height / 2;
									const { x, y, k } = viewRef.current;
									const zoom = 1.25;
									const newK = Math.min(3.0, k * zoom);
									const worldX = (mx - x) / k; const worldY = (my - y) / k;
									const newX = mx - worldX * newK; const newY = my - worldY * newK;
									setView({ x: newX, y: newY, k: newK });
								}}
							>
								+
							</button>
							<button
								className="block w-10 h-10 leading-10 text-center hover:bg-neutral-50 dark:hover:bg-neutral-700 select-none"
								onClick={() => {
									const el = containerRef.current;
									if (!el) return;
									const rect = el.getBoundingClientRect();
									const mx = rect.width / 2; const my = rect.height / 2;
									const { x, y, k } = viewRef.current;
									const zoom = 1/1.25;
									const newK = Math.max(0.3, k * zoom);
									const worldX = (mx - x) / k; const worldY = (my - y) / k;
									const newX = mx - worldX * newK; const newY = my - worldY * newK;
									setView({ x: newX, y: newY, k: newK });
								}}
							>
								−
							</button>
						</div>
						<button
							className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur rounded-full border border-gray-200 dark:border-gray-700 shadow w-10 h-10 hover:bg-neutral-50 dark:hover:bg-neutral-700 select-none"
							onClick={() => setView({ x: 0, y: 0, k: 1 })}
							title="Reset view"
						>
							🏠
						</button>
					</div>
				{/* Transform wrapper for pan/zoom */}
				<div
					className="absolute inset-0"
					style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', overflow: 'visible' }}
				>
					{/* SVG for ring guides and links under nodes */}
					<svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
						<defs>
							<marker id="arrow" viewBox="0 -5 10 10" refX="6" refY="0" markerWidth="6" markerHeight="6" orient="auto">
								<path d="M0,-5L10,0L0,5" fill="context-stroke" />
							</marker>
						</defs>
						{settings.showRings ? (
							<g>
								{(() => {
									const root = nodesRef.current.find((n) => n.id === rootId);
									// If root isn't available yet, don't render rings to avoid initial flicker/jump
									if (!root) return null;
									const cx = (root.fx ?? root.x ?? 0);
									const cy = (root.fy ?? root.y ?? 0);
									// Use configurable ring count
									const ringCount = settings.ringCount;
									const rings: React.ReactNode[] = [];
									for (let d = 1; d <= ringCount; d++) {
										const r = settings.ringBase + d * settings.ringStep;
										rings.push(
											<circle
												key={d}
												cx={cx}
												cy={cy}
												r={r}
												fill="none"
												stroke="#4B5563"
												strokeDasharray="8 6"
												strokeWidth={2}
												vectorEffect="non-scaling-stroke"
											/>
										);
									}
									return rings;
								})()}
							</g>
						) : null}
						<g>
							{linksRef.current.map((l, i) => {
								const sid = typeof l.source === "string" ? l.source : l.source.id;
								const tid = typeof l.target === "string" ? l.target : l.target.id;
								const s = getNodePos(sid);
								const t = getNodePos(tid);
								// Make non-primary links lighter gray: if child has a primaryParentId and this link's source
								// isn't that parent, render a lighter stroke color for the link.
								const childNode = nodesRef.current.find((x) => x.id === tid);
								const isPrimary = childNode?.primaryParentId === sid;
								const strokeColor = l.ephemeral
									? "#9CA3AF" // ephemeral hover link (gray-400)
									: isPrimary
									? "#6B7280" // primary link (gray-500)
									: "#D1D5DB"; // non-primary link (lighter gray-300)
								// Split into two segments and place arrow at the midpoint so it's not hidden under the node DIVs
								const mx = (s.x + t.x) / 2;
								const my = (s.y + t.y) / 2;
								const strokeW = l.ephemeral ? 1.5 : isPrimary ? 2.5 : 2;
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

					{/* HTML nodes */}
					{nodesRef.current.map((n) => (
						<div
							key={n.id}
							className="absolute"
							style={{
								left: (n.x ?? 0) - n.width / 2,
								top: (n.y ?? 0) - Math.max(n.height, 100) / 2,
								transform: 'translate(0, 0)',
								zIndex: n.hoverPinned ? 1000 : n.highlight ? 900 : n.pinned ? 500 : 1,
							}}
						>
							<NodeCard
								n={n}
								presentSet={presentSet}
								onButtonClick={handleButtonClick}
								onButtonHoverIn={handleButtonHoverIn}
								onButtonHoverOut={handleButtonHoverOut}
								showMinGrade={settings.showMinGrade}
								courseMap={courseMap}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

