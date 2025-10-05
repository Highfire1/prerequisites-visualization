"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
	Background,
	ReactFlow,
	ReactFlowProvider,
	addEdge,
	useEdgesState,
	useNodesState,
	useReactFlow,
	type Edge,
	type Node,
		type Connection,
		type ColorMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { useTheme } from 'next-themes';

import { prerequisiteData, type PrereqNode, type TranscriptNode } from './prerequisiteData';

type ElkDirection = 'DOWN' | 'RIGHT';

const elk = new ELK();
const elkOptions = {
	'elk.algorithm': 'layered',
	'elk.layered.spacing.nodeNodeBetweenLayers': '80',
	'elk.spacing.nodeNode': '60',
};

function makeNode(id: string, label: string, extra?: Partial<Node>): Node {
	return {
		id,
		data: { label },
		position: { x: 0, y: 0 },
		...extra,
	} as Node;
}

type BuildResult = { nodes: Node[]; edges: Edge[] };

function buildGraphForCourses(courseCodes: string[]): BuildResult {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

		// De-duplicate non-structural nodes (courses, credit notes) across the graph
	const idByKey = new Map<string, string>();
	const ensureNode = (key: string, nodeFactory: () => Node): string => {
		const existing = idByKey.get(key);
		if (existing) return existing;
		const node = nodeFactory();
		nodes.push(node);
		idByKey.set(key, node.id);
		return node.id;
	};

		const addEdgeUnique = (source: string, target: string, label?: string) => {
			const id = `e:${source}->${target}`;
			const existing = edges.find((e) => e.id === id);
			if (!existing) {
				edges.push({ id, source, target, type: 'smoothstep', label });
			} else if (label) {
				// merge labels if different
				const curr = typeof existing.label === 'string' ? existing.label : '';
				if (!curr) existing.label = label;
				else if (!curr.includes(label)) existing.label = `${curr} | ${label}`;
			}
		};

	const visitedCourseExpansion = new Set<string>();

		const edgeLabelFromTranscript = (t: TranscriptNode) => {
			const parts: string[] = [];
			if (t.minGrade) parts.push(`min ${t.minGrade}`);
			if (t.canBeTakenConcurrently) parts.push('concurrent OK');
			if (t.orEquivalent) parts.push('or equiv');
			return parts.join(' · ');
		};

		const addPrereq = (node: PrereqNode, parentId: string, path: string) => {
		if (!node) {
			// Represent missing prerequisites only at the top-level
			if (path === 'root') {
				const noneId = ensureNode('note:none', () => makeNode('note:none', 'No prerequisites'));
					addEdgeUnique(noneId, parentId);
			}
			return;
		}

		if (node.type === 'group') {
				// Skip creating a visual group node; directly connect children to the parent
				node.children.forEach((child: PrereqNode, idx: number) => addPrereq(child, parentId, `${path}.${idx}`));
			return;
		}

		if (node.type === 'transcript') {
				const key = `course:${node.course}`;
				const title = prerequisiteData[node.course]?.title;
				const tid = ensureNode(key, () => makeNode(key, `${node.course}${title ? ` — ${title}` : ''}`));
				const label = edgeLabelFromTranscript(node);
				addEdgeUnique(tid, parentId, label);

			// Expand this course's own prerequisites if we have data and avoid infinite loops
			const info = prerequisiteData[node.course];
			if (info?.prerequisites && !visitedCourseExpansion.has(node.course)) {
				visitedCourseExpansion.add(node.course);
					addPrereq(info.prerequisites, tid, `${path}.course(${node.course})`);
			}
			return;
		}

		if (node.type === 'creditCount') {
			const key = `credit:${node.creditCount}`;
			const cid = ensureNode(key, () => makeNode(key, `${node.creditCount}+ credits`));
				addEdgeUnique(cid, parentId);
			return;
		}

		if (node.type === 'note') {
			const key = `note:${node.text}`;
			const nid = ensureNode(key, () => makeNode(key, `Note: ${node.text}`));
				addEdgeUnique(nid, parentId);
			return;
		}

		if (node.type === 'other') {
			const key = `other:${node.text}`;
			const oid = ensureNode(key, () => makeNode(key, node.text));
				addEdgeUnique(oid, parentId);
			return;
		}
	};


	// Build for each requested course
	for (const courseCode of courseCodes) {
		const courseInfo = prerequisiteData[courseCode];
		const rootId = ensureNode(
			`course:${courseCode}`,
			() =>
				makeNode(
					`course:${courseCode}`,
					`${courseCode}${courseInfo?.title ? ` — ${courseInfo.title}` : ''}`,
					{ type: 'output' },
				),
		);
		addPrereq(courseInfo?.prerequisites ?? null, rootId, `root:${courseCode}`);
	}

	return { nodes, edges };
}

const getLayoutedElements = async (
	nodes: Node[],
	edges: Edge[],
	direction: ElkDirection,
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
	const isHorizontal = direction === 'RIGHT';

	const graph = {
		id: 'root',
		layoutOptions: { 'elk.direction': direction, ...elkOptions },
		children: nodes.map((n) => ({
			...n,
			targetPosition: isHorizontal ? 'left' : 'top',
			sourcePosition: isHorizontal ? 'right' : 'bottom',
			width: 200,
			height: 56,
		})),
		edges,
		};

				const layouted = (await elk.layout(graph)) as {
					children: Array<{ id: string; x: number; y: number }>;
					edges: Array<Record<string, unknown>>;
				};
				const posById = new Map<string, { x: number; y: number }>(
					layouted.children.map((c) => [c.id, { x: c.x, y: c.y }]),
				);
			return {
				nodes: nodes.map((n) => ({
					...n,
					position: posById.get(n.id) ?? n.position,
				})),
				edges: edges,
			};
};

function CombinedFlow() {
	const direction: ElkDirection = 'DOWN';

	const initial = useMemo(() => buildGraphForCourses(['ECON 201', 'CMPT 225']), []);
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
	const { fitView } = useReactFlow();
	const { theme } = useTheme();
	const colorMode: ColorMode = useMemo(() => {
		if (theme === 'system') return 'system';
		return theme === 'dark' ? 'dark' : 'light';
	}, [theme]);

	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges],
	);

	useLayoutEffect(() => {
		(async () => {
			const built = buildGraphForCourses(['ECON 201', 'CMPT 225']);
			const layouted = await getLayoutedElements(built.nodes, built.edges, direction);
			setNodes(layouted.nodes);
			setEdges(layouted.edges);
			requestAnimationFrame(() => fitView());
		})();
	}, [setNodes, setEdges, fitView]);

	return (
		<div className="h-[calc(100vh-4rem)] w-full flex flex-col">
			<PageHeader />
			<div className="flex-1 min-h-0">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onConnect={onConnect}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					fitView
							colorMode={colorMode}
					proOptions={{ hideAttribution: true }}
					className="h-full"
					panOnDrag
					zoomOnScroll
					zoomOnPinch
					panOnScroll={true}
					zoomOnDoubleClick={false}
					selectionOnDrag={false}
					minZoom={0.1}
					maxZoom={2}
				>
					<Background />
				</ReactFlow>
			</div>
		</div>
	);
	}

function PageHeader() {
	return (
		<div className="h-12 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between">
			<div className="text-sm font-medium text-slate-700 dark:text-slate-200">Prerequisite Graph — ECON 201 + CMPT 225</div>
			<ThemeToggle />
		</div>
	);
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;

	const isDark = resolvedTheme === 'dark';
	return (
		<button
			type="button"
			aria-label="Toggle dark mode"
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors bg-slate-200 dark:bg-slate-700"
		>
			<span
				className={
					'inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-200 shadow transition-transform ' +
					(isDark ? 'translate-x-7' : 'translate-x-2')
				}
			/>
		</button>
	);
}

export default function Page() {
	return (
		<ReactFlowProvider>
			<CombinedFlow />
		</ReactFlowProvider>
	);
}
