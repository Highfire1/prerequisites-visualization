'use client'

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Test data structure - same as before
const testData = {
    "type": "group",
    "logic": "ONE_OF",
    "children": [
        {
            "type": "group",
            "logic": "ALL_OF",
            "children": [
                {
                    "type": "transcript",
                    "course": "ECON 201",
                    "minGrade": "C-"
                },
                {
                    "type": "creditCount",
                    "creditCount": 45
                }
            ]
        },
        {
            "type": "group",
            "logic": "ALL_OF",
            "children": [
                {
                    "type": "transcript",
                    "course": "ECON 103",
                    "minGrade": "A-"
                },
                {
                    "type": "transcript",
                    "course": "ECON 105",
                    "minGrade": "A-"
                },
                {
                    "type": "transcript",
                    "course": "ECON 201",
                    "canBeTakenConcurrently": "true"
                },
                {
                    "type": "creditCount",
                    "creditCount": 30
                },
                {
                    "type": "note",
                    "text": "Students seeking permission to enroll on this basis must contact the undergraduate advisor in economics."
                }
            ]
        }
    ]
};

// Target course that requires these prerequisites
const targetCourse = {
    "type": "transcript",
    "course": "ECON 305",
    "isTarget": true
};

interface TreeNode {
    id: string;
    type: string;
    logic?: string;
    course?: string;
    minGrade?: string;
    canBeTakenConcurrently?: string;
    creditCount?: number;
    text?: string;
    isTarget?: boolean;
    children?: TreeNode[];
}

const D3TreeVisualization: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const renderTree = () => {
            // Clear previous content
            d3.select(svgRef.current!).selectAll("*").remove();

            // Set up dimensions
            const container = containerRef.current!;
            const margin = { top: 50, right: 120, bottom: 50, left: 120 };
            const width = container.clientWidth - margin.left - margin.right;
            const height = container.clientHeight - margin.top - margin.bottom;

            // Create SVG
            const svg = d3.select(svgRef.current!)
                .attr("width", container.clientWidth)
                .attr("height", container.clientHeight);

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

        // Transform data into D3 hierarchy format
        const transformData = (node: any, parent: TreeNode | null = null): TreeNode => {
            const id = Math.random().toString(36).substr(2, 9);
            
            const treeNode: TreeNode = {
                id,
                type: node.type,
                logic: node.logic,
                course: node.course,
                minGrade: node.minGrade,
                canBeTakenConcurrently: node.canBeTakenConcurrently,
                creditCount: node.creditCount,
                text: node.text,
                isTarget: node.isTarget,
                children: []
            };

            if (node.children && Array.isArray(node.children)) {
                treeNode.children = node.children.map((child: any) => transformData(child, treeNode));
            }

            return treeNode;
        };

        // Create root with target course at the top and prerequisites below
        const rootData: TreeNode = {
            id: 'root',
            type: 'transcript',
            course: 'ECON 305',
            isTarget: true,
            children: [transformData(testData)]
        };

        // Create D3 hierarchy
        const root = d3.hierarchy(rootData);
        
        // Create tree layout
        const treeLayout = d3.tree<TreeNode>()
            .size([height, width])
            .separation((a, b) => {
                // More separation for different logic groups
                if (a.parent === b.parent) {
                    return a.data.logic !== b.data.logic ? 2 : 1;
                }
                return 2;
            });

        // Apply layout
        treeLayout(root);

        // Helper functions for styling
        const getNodeColor = (d: any): string => {
            const node = d.data as TreeNode;
            if (node.isTarget) return '#DC2626'; // Red for target
            switch (node.type) {
                case 'group': return '#3B82F6'; // Blue for logic groups
                case 'transcript': return '#10B981'; // Green for courses
                case 'creditCount': return '#F59E0B'; // Orange for credit requirements
                case 'note': return '#8B5CF6'; // Purple for notes
                default: return '#6B7280'; // Gray
            }
        };

        const getNodeSize = (d: any): number => {
            const node = d.data as TreeNode;
            if (node.isTarget) return 8;
            switch (node.type) {
                case 'group': return 6;
                case 'transcript': return 5;
                case 'creditCount': return 4;
                case 'note': return 4;
                default: return 4;
            }
        };

        const getNodeLabel = (d: any): string => {
            const node = d.data as TreeNode;
            switch (node.type) {
                case 'group':
                    return node.logic ? node.logic.replace('_', ' ') : 'GROUP';
                case 'transcript':
                    const grade = node.minGrade ? ` (${node.minGrade})` : '';
                    const concurrent = node.canBeTakenConcurrently ? ' [Concurrent]' : '';
                    return `${node.course}${grade}${concurrent}`;
                case 'creditCount':
                    return `${node.creditCount} Credits`;
                case 'note':
                    return `Note: ${node.text?.substring(0, 30)}...`;
                default:
                    return 'Unknown';
            }
        };

        // Add links (connections between nodes)
        const links = g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical<any, any>()
                .x(d => d.y)
                .y(d => d.x)
            )
            .attr('fill', 'none')
            .attr('stroke', '#9CA3AF')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);

        // Add nodes
        const nodes = g.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.y},${d.x})`);

        // Add circles for nodes
        nodes.append('circle')
            .attr('r', d => getNodeSize(d))
            .attr('fill', d => getNodeColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer');

        // Add special styling for logic groups
        nodes.filter(d => d.data.type === 'group')
            .select('circle')
            .attr('stroke-dasharray', '3,3')
            .attr('stroke-width', 3);

        // Add labels
        nodes.append('text')
            .attr('dy', '0.31em')
            .attr('x', d => d.children ? -10 : 10)
            .attr('text-anchor', d => d.children ? 'end' : 'start')
            .text(d => getNodeLabel(d))
            .style('font-size', '12px')
            .style('font-family', 'Arial, sans-serif')
            .style('fill', '#374151');

        // Add tooltips
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('padding', '8px')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0);

        nodes
            .on('mouseover', function(event, d) {
                const node = d.data as TreeNode;
                let tooltipText = getNodeLabel(d);
                
                if (node.type === 'note' && node.text) {
                    tooltipText = `Note: ${node.text}`;
                }
                
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                tooltip.html(tooltipText)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(d) {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add zoom and pan
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Add logic group backgrounds
        const logicGroups = root.descendants().filter(d => d.data.type === 'group');
        
        logicGroups.forEach(groupNode => {
            if (!groupNode.children) return;
            
            // Calculate bounding box for the group's children
            const children = groupNode.children;
            const minX = d3.min(children, d => d.x) || 0;
            const maxX = d3.max(children, d => d.x) || 0;
            const minY = d3.min(children, d => d.y) || 0;
            const maxY = d3.max(children, d => d.y) || 0;
            
            const padding = 20;
            const groupRect = g.insert('rect', ':first-child')
                .attr('x', minY - padding)
                .attr('y', minX - padding)
                .attr('width', maxY - minY + 2 * padding)
                .attr('height', maxX - minX + 2 * padding)
                .attr('fill', getNodeColor(groupNode))
                .attr('fill-opacity', 0.1)
                .attr('stroke', getNodeColor(groupNode))
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5')
                .attr('rx', 8);
        });

        // Cleanup function
        return () => {
            tooltip.remove();
        };
        };

        // Initial render
        renderTree();

        // Add resize observer to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            renderTree();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // Cleanup
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full">
            <svg ref={svgRef} className="w-full h-full"></svg>
        </div>
    );
};

export default D3TreeVisualization;
