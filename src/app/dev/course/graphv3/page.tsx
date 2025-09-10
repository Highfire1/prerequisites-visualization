"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
	prerequisiteData,
	type PrereqNode,
	type CourseData,
} from "./prerequisiteData";

type SimNode = {
	id: string; // course id like ECON 201
	title: string; // display title (course code)
	subtitle?: string; // course full title
	persisted: boolean; // created by click (true)
	width: number;
	height: number;
	// d3-force mutated fields
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
};

type SimLink = {
	source: string | SimNode;
	target: string | SimNode;
};

// Parse prerequisiteData into groups of alternatives (each group is a row; within a row, items are alternatives joined by "or")
function extractPrereqCourseGroups(id: string): string[][] {
	const node = prerequisiteData[id];
	if (!node) return [];

	const walk = (n: PrereqNode): string[][] => {
		if (n == null) return [];
		switch (n.type) {
			case "transcript":
				return [[n.course]];
			case "creditCount":
			case "note":
			case "other":
				return [];
			case "group": {
				const childResults: string[][][] = n.children
					.map(walk)
					.filter((r: string[][]) => r.length > 0);
				if (childResults.length === 0) return [];
				if (n.logic === "ONE_OF") {
					// Merge all alternatives into a single row (union)
					const set = new Set<string>();
					for (const res of childResults) {
						for (const line of res) for (const course of line) set.add(course);
					}
					return [Array.from(set)];
				} else {
					// ALL_OF: keep each child's rows separate and concatenate
					return childResults.flat();
				}
			}
		}
	};

		const result = node.prerequisites
			? walk(node.prerequisites).map((line) => Array.from(new Set(line)))
			: [];
		return result;
}

// Flatten groups to a unique list of all direct prerequisite course IDs
function listDirectPrereqCourses(id: string): string[] {
	const groups = extractPrereqCourseGroups(id);
	const s = new Set<string>();
	for (const g of groups) for (const cid of g) s.add(cid);
	return Array.from(s);
}

function NodeCard({
	n,
	presentSet,
	onToggle,
}: {
	n: SimNode;
	presentSet: Set<string>;
	onToggle: (parentId: string, courseId: string) => void;
}) {
	const groups = useMemo(() => extractPrereqCourseGroups(n.id), [n.id]);
	const hasPrereqs = groups.length > 0;
	return (
		<div
			className="shadow-lg rounded-lg border bg-white text-gray-900 select-none border-gray-300"
			style={{
				width: n.width,
				minHeight: n.height,
				pointerEvents: "auto",
			}}
		>
			<div className="p-3 border-b border-gray-200">
				<div className="text-sm font-semibold tracking-wide text-gray-700">
					{n.title}
				</div>
				{n.subtitle ? (
					<div className="text-xs text-gray-500">{n.subtitle}</div>
				) : null}
			</div>
			<div className="p-3">
				{hasPrereqs ? (
					<>
						<div className="text-xs font-medium text-gray-700 mb-1">Prerequisites:</div>
						<div className="flex flex-col gap-1">
							{groups.map((alts, i) => (
								<div key={i} className="flex flex-wrap items-center gap-1 text-xs">
									{alts.map((cid, j) => (
										<React.Fragment key={cid}>
											<button
												className={
													"px-2 py-1 rounded border " +
													(presentSet.has(cid)
														? "border-blue-500 bg-blue-50 text-blue-700"
														: "border-gray-300 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100")
												}
												onClick={(e) => {
													e.stopPropagation();
													onToggle(n.id, cid);
												}}
											>
												{cid}
											</button>
											{j < alts.length - 1 ? (
												<span className="text-gray-500">or</span>
											) : null}
										</React.Fragment>
									))}
								</div>
							))}
						</div>
					</>
				) : (
					<div className="text-xs text-gray-500">No prerequisites.</div>
				)}
			</div>
		</div>
	);
}

export default function GraphV3Page() {
	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const innerRef = useRef<HTMLDivElement>(null); // transformed wrapper for HTML nodes

	const [nodes, setNodes] = useState<SimNode[]>([]);
	const [links, setLinks] = useState<SimLink[]>([]);
	const nodesRef = useRef<SimNode[]>(nodes);
	const linksRef = useRef<SimLink[]>(links);
	const simRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);

	const [transform, setTransform] = useState<d3.ZoomTransform>(() => d3.zoomIdentity);

	useEffect(() => void (nodesRef.current = nodes), [nodes]);
	useEffect(() => void (linksRef.current = links), [links]);

	// Initialize with ECON 201 as root
	useEffect(() => {
		const rootId = "ECON 201";
		const data: CourseData | undefined = prerequisiteData[rootId];
		const root: SimNode = {
			id: rootId,
			title: rootId,
			subtitle: data?.title ?? undefined,
			persisted: true,
			width: 320,
			height: 140,
			fx: 0,
			fy: 0,
		};
		setNodes([root]);
	}, []);

	// d3 zoom/pan on container; transform both SVG and HTML layer
	useEffect(() => {
		const el = containerRef.current;
		const svg = svgRef.current;
		const inner = innerRef.current;
		if (!el || !svg || !inner) return;

		const zoomed = (ev: d3.D3ZoomEvent<Element, unknown>) => {
			const t = ev.transform;
			setTransform(t);
		};

			const zoom = d3
				.zoom<Element, unknown>()
				.scaleExtent([0.3, 3])
				.on("zoom", zoomed)
				.filter((ev: unknown) => {
					// Prevent zoom when interacting with buttons/controls
					const e = ev as Event;
					const tgt = (e?.target as HTMLElement | null) ?? null;
					if (tgt && (tgt.closest("button") || tgt.closest("[data-pan-block]"))) return false;
					// Allow wheel and primary-button drags; allow touch by default
					if (e instanceof WheelEvent) return true;
					if (e instanceof MouseEvent) return e.button === 0; // left only
					return true; // touch and others
				});

			d3.select<Element, unknown>(el).call(zoom);
		return () => {
			d3.select(el).on("zoom", null);
		};
	}, []);

	// Create/Update the force simulation when nodes/links change
	useEffect(() => {
		if (!nodesRef.current.length) return;

		const sim = simRef.current ?? d3.forceSimulation<SimNode>(nodesRef.current);
		simRef.current = sim;

		sim.nodes(nodesRef.current as SimNode[]);

		// Link force
			const linkForce = d3
				.forceLink<SimNode, SimLink>(linksRef.current)
			.id((d: SimNode) => d.id)
			.distance(160)
			.strength(0.4);

		// Many-body repulsion and collision (approximate rects by radius)
		const collideRadius = (n: SimNode) => Math.max(n.width, n.height) * 0.6 + 12;

		sim
			.force("link", linkForce)
			.force("charge", d3.forceManyBody<SimNode>().strength(-200))
			.force("collide", d3.forceCollide<SimNode>().radius(collideRadius).iterations(2))
			.force("x", d3.forceX<SimNode>(0).strength(0.05))
			.force("y", d3.forceY<SimNode>(0).strength(0.05))
			.alpha(0.8)
			.alphaTarget(0)
			.restart();

		const ticked = () => {
			// Trigger React update without recreating arrays
			setNodes((prev) => [...prev]);
		};
		sim.on("tick", ticked);
		return () => {
			sim.on("tick", null);
		};
	}, [nodes.length, links.length]);

	// Toggle node open/close and links
	const toggleCourse = (parentId: string, courseId: string) => {
		const existing = nodesRef.current.find((n) => n.id === courseId && n.persisted);
		if (existing) {
			// Remove this node and cascade-remove its descendants that aren't needed by others
			const presentPersisted = new Set(
				nodesRef.current.filter((n) => n.persisted).map((n) => n.id)
			);

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
			const queue: string[] = [courseId];
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
					}
				}
			}

			setNodes((prev) => prev.filter((n) => !removeSet.has(n.id)));
			setLinks((prev) =>
				prev.filter((l) => {
					const s = typeof l.source === "string" ? l.source : l.source.id;
					const t = typeof l.target === "string" ? l.target : l.target.id;
					return !removeSet.has(s) && !removeSet.has(t);
				})
			);
			// Nudge sim
			simRef.current?.alpha(0.6).restart();
			return;
		}

		// Open: create node and link to parent
		const course = prerequisiteData[courseId];
		const parent = nodesRef.current.find((n) => n.id === parentId);
		const startX = (parent?.x ?? 0) + (Math.random() - 0.5) * 40;
		const startY = (parent?.y ?? 0) + (Math.random() - 0.5) * 40;
		const newNode: SimNode = {
			id: courseId,
			title: courseId,
			subtitle: course?.title ?? undefined,
			persisted: true,
			width: 300,
			height: 120,
			x: startX,
			y: startY,
		};
		setNodes((prev) => [...prev, newNode]);
		setLinks((prev) => [...prev, { source: parentId, target: courseId }]);
		simRef.current?.alpha(0.8).restart();
	};

	// Convenience helpers
	const presentSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
	const getNodePos = (id: string) => {
		const n = nodesRef.current.find((x) => x.id === id);
		return n ? { x: n.x ?? 0, y: n.y ?? 0 } : { x: 0, y: 0 };
	};

	// Keep root near center initially
	useEffect(() => {
		if (!nodesRef.current.length) return;
		const root = nodesRef.current.find((n) => n.id === "ECON 201");
		if (root && (root.fx == null || root.fy == null)) {
			root.fx = 0; root.fy = 0;
			simRef.current?.alpha(0.7).restart();
		}
	}, [nodes.length]);

	return (
		<div className="w-full h-[calc(100vh-2rem)] p-4">
			<div
				ref={containerRef}
				className="relative w-full h-full bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
				style={{ cursor: "grab" }}
			>
				{/* Zoom controls */}
				<div data-pan-block className="absolute top-2 right-2 z-20 w-72 bg-white/90 backdrop-blur rounded-lg border border-gray-200 shadow p-3 text-xs text-gray-800">
					<div className="font-medium text-gray-700 mb-2">View</div>
					<div className="flex items-center justify-end gap-2">
						<button
							className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
							onClick={() => setTransform(d3.zoomIdentity)}
						>
							Reset
						</button>
					</div>
				</div>

				{/* Pan/Zoom transformed wrapper */}
				<div
					className="absolute inset-0"
					style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: "0 0" }}
				>
					{/* SVG underlay for links */}
					<svg
						ref={svgRef}
						className="absolute inset-0 w-full h-full pointer-events-none"
						style={{ overflow: "visible" }}
					>
						<defs>
							<marker id="arrow-gray" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
								<path d="M0,-5L10,0L0,5" fill="#9CA3AF" />
							</marker>
						</defs>
						<g>
							{linksRef.current.map((l, i) => {
								const sid = typeof l.source === "string" ? l.source : l.source.id;
								const tid = typeof l.target === "string" ? l.target : l.target.id;
								const s = getNodePos(sid);
								const t = getNodePos(tid);
								return (
									<line
										key={i}
										x1={s.x}
										y1={s.y}
										x2={t.x}
										y2={t.y}
										stroke="#9CA3AF"
										strokeWidth={2}
										markerEnd="url(#arrow-gray)"
									/>
								);
							})}
						</g>
					</svg>

					{/* HTML nodes layer */}
					<div ref={innerRef} className="absolute inset-0" style={{ overflow: "visible" }}>
						{nodesRef.current.map((n) => (
							<div
								key={n.id}
								className="absolute"
								style={{
									left: (n.x ?? 0) - n.width / 2,
									top: (n.y ?? 0) - Math.max(100, n.height) / 2,
								}}
							>
								<NodeCard n={n} presentSet={presentSet} onToggle={toggleCourse} />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

