"use client";
import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { prerequisiteData, PrereqNode, TranscriptNode, GroupNode, CreditCountNode, NoteNode, OtherNode } from "./prerequisiteData";

// Re-export types for convenience
export type { PrereqNode, TranscriptNode, GroupNode, CreditCountNode, NoteNode, OtherNode };

interface RadialTreeVisualizationProps {
    layoutType?: "tree" | "cluster";
    maxDepth?: number;
}

const RadialTreeVisualization: React.FC<RadialTreeVisualizationProps> = ({ 
    layoutType = "cluster", 
    maxDepth = 1
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Function to recursively expand prerequisites with depth limit
    const expandPrerequisites = (node: PrereqNode, currentDepth: number = 0): PrereqNode => {
        if (currentDepth >= maxDepth) {
            // Stop expanding at max depth
            return node;
        }
        
        if (node.type === "transcript" && node.course && prerequisiteData[node.course]) {
            // This course has prerequisites, add them as children
            return {
                ...node,
                children: [expandPrerequisites(prerequisiteData[node.course], currentDepth + 1)]
            } as any;
        } else if (node.type === "group") {
            // Recursively expand children in groups
            return {
                ...node,
                children: node.children.map(child => expandPrerequisites(child, currentDepth))
            };
        }
        // No prerequisites for this node
        return node;
    };

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;
        
        // Get container dimensions
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const size = Math.min(containerWidth, containerHeight) - 40; // padding
        const radius = size / 2 - 60; // more margin for labels

        const svg = d3.select(svgRef.current)
            .attr("width", containerWidth)
            .attr("height", containerHeight)
            .attr("viewBox", [-size/2, -size/2, size, size])
            .attr("style", "font: 12px sans-serif;");
        svg.selectAll("*").remove();

        // D3 radial layout (tree or cluster)
        const tree = layoutType === "cluster" 
            ? d3.cluster<any>()
                .size([2 * Math.PI, radius])
                .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth)
            : d3.tree<any>()
                .size([2 * Math.PI, radius])
                .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

        // Create root node for ECON 305 with prerequisites as children
        const rootData: TranscriptNode = {
            type: "transcript",
            course: "ECON 305"
        };

        // Get expanded prerequisites for ECON 305
        const expandedPrereqs = expandPrerequisites(prerequisiteData["ECON 305"]);

        // Add the prerequisites as children
        const hierarchyData = {
            ...rootData,
            children: [expandedPrereqs]
        };

        // Convert to D3 hierarchy
        const root = tree(d3.hierarchy<any>(hierarchyData));

        // For tree layout, we can adjust spacing; cluster handles it naturally
        if (layoutType === "tree" || true) {
            root.descendants().forEach(d => {
                d.y = d.depth * 60; // Increase spacing between layers for tree layout
            });
        }

        // Create a group for all the content that will be zoomed/panned
        const g = svg.append("g");

        // Links
        g.append("g")
            .attr("fill", "none")
            .attr("stroke", "#555")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            // @ts-ignore: D3 type inference issue
            .attr("d", d3.linkRadial()
                .angle((d: any) => d.x)
                .radius((d: any) => d.y)
            );

        // Nodes
        g.append("g")
            .selectAll("circle")
            .data(root.descendants())
            .join("circle")
            .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
            .attr("fill", d => {
            const node = d.data as any;
            if (node.type === "transcript") return "#3B82F6"; // Blue for transcript
            if (node.type === "group") return "#10B981"; // Green for group
            return "#EF4444"; // Red for others
            })
            .attr("r", 5);

        // Labels
        g.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 3)
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0) rotate(${d.x >= Math.PI ? 180 : 0})`)
            .attr("dy", "0.31em")
            .attr("x", d => d.x < Math.PI === !d.children ? 6 : -6)
            .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
            .attr("paint-order", "stroke")
            .attr("stroke", "white")
            .attr("fill", "black")
            .text(d => {
                const node = d.data as any;
                if (node.type === "transcript") return node.course + (node.minGrade ? ` (${node.minGrade})` : "");
                if (node.type === "creditCount") return `${node.creditCount} Credits`;
                if (node.type === "group") return node.logic.replace("_", " ");
                if (node.type === "note") return node.text?.substring(0, 30) + "...";
                if (node.type === "other") return node.text?.substring(0, 30) + "...";
                // @ts-ignore: fallback for union type
                return (node as any).type;
            });

        // Add zoom and pan functionality
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4]) // Allow zooming from 10% to 400%
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        // Apply zoom behavior to SVG
        svg.call(zoom);

        // Optional: Add a reset button functionality (double-click to reset)
        svg.on('dblclick.zoom', () => {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        });
    }, [layoutType, maxDepth]); // Re-render when layout type or max depth changes

    return (
        <div ref={containerRef} className="w-full h-full">
            <svg ref={svgRef} className="w-full h-full"></svg>
        </div>
    );
};

export default RadialTreeVisualization;
