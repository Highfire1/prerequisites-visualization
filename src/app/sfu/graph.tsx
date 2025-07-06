'use client'

import React, { useEffect, useCallback, useState } from "react";
import {
    SigmaContainer,
    useLoadGraph,
    ControlsContainer,
    ZoomControl,
    FullScreenControl,
    useRegisterEvents,
    useSetSettings,
    useSigma
} from "@react-sigma/core";

import "@react-sigma/core/lib/style.css";
import { GraphSearch, GraphSearchOption } from '@react-sigma/graph-search';
import '@react-sigma/graph-search/lib/style.css';
import { MiniMap } from '@react-sigma/minimap';
import Papa from "papaparse";
import {
    AiOutlineFullscreen,
    AiOutlineFullscreenExit,
    AiOutlineZoomIn,
    AiOutlineZoomOut,
} from 'react-icons/ai';
import { MdFilterCenterFocus } from 'react-icons/md';
import { NodeData, LinkData } from '../../types/graph';
import { getGroupColor } from '../../utils/colors';
import { FocusOnNode } from '../../components/FocusOnNode';

// Component that loads the graph data and handles hover effects
const GraphLoader: React.FC<{ disableHoverEffect?: boolean }> = ({ disableHoverEffect }) => {
    const loadGraph = useLoadGraph();
    const registerEvents = useRegisterEvents();
    const setSettings = useSetSettings();
    const sigma = useSigma();
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    useEffect(() => {
        const loadCSVData = async () => {
            try {
                // Dynamic imports to avoid SSR issues
                const { default: Graph } = await import("graphology");
                const { default: forceAtlas2 } = await import("graphology-layout-forceatlas2");
                // const { default: noverlap } = await import("graphology-layout-noverlap");

                // Load nodes CSV
                const nodesResponse = await fetch('/data/sfu/nodes.csv');
                const nodesCSV = await nodesResponse.text();

                // Load links CSV
                const linksResponse = await fetch('/data/sfu/links.csv');
                const linksCSV = await linksResponse.text();

                // Parse CSV data
                const nodesData = Papa.parse(nodesCSV, { header: true, skipEmptyLines: true });
                const linksData = Papa.parse(linksCSV, { header: true, skipEmptyLines: true });

                // Create a graphology graph
                const graph = new Graph();

                // Add nodes from CSV
                (nodesData.data as NodeData[]).forEach((node: NodeData) => {
                    // Initialize with random positions (will be overridden by layout)
                    const x = Math.random() * 400;
                    const y = Math.random() * 400;

                    const nodeColor = getGroupColor(node.group);

                    const size = parseInt(node.size) * 2
                    console.log(size)

                    graph.addNode(node.id, {
                        label: node.id,
                        x: x,
                        y: y,
                        size: size,
                        color: nodeColor,
                        // group: node.group,
                        // depth: parseInt(node.depth) || 0
                    });
                });

                // Add edges from CSV
                (linksData.data as LinkData[]).forEach((link: LinkData) => {
                    if (graph.hasNode(link.source) && graph.hasNode(link.target)) {
                        // Get the source node's color to use for the edge
                        const sourceNodeColor = graph.getNodeAttribute(link.source, 'color');
                        
                        graph.addEdge(link.source, link.target, {
                            weight: parseFloat(link.value) || 1, // Use weight for layout
                            size: 2,
                            color: sourceNodeColor || "#999" // Use source node color, fallback to gray
                        });
                    }
                });

                // Apply Force Atlas 2 layout
                const positions = forceAtlas2(graph, {
                    iterations: 300,
                    settings: {
                        gravity: 1,
                        scalingRatio: 10,
                        strongGravityMode: false,
                        barnesHutOptimize: true,
                        barnesHutTheta: 0.5,
                        slowDown: 1,
                        linLogMode: false,
                        outboundAttractionDistribution: false,
                        adjustSizes: false,
                        edgeWeightInfluence: 1
                    }
                    // settings: {
                    //     gravity: 2, // Increase gravity to spread out the graph more
                    //     scalingRatio: 10, // Increase scaling ratio for better spacing
                    //     strongGravityMode: false, // Enable strong gravity to reduce clustering in the center
                    //     barnesHutOptimize: true,
                    //     barnesHutTheta: 0.5, // Adjust theta for better performance and layout
                    //     slowDown: 1, // Reduce slowDown to speed up layout convergence
                    //     linLogMode: false, // Enable lin-log mode to reduce clustering
                    //     outboundAttractionDistribution: true, // Spread nodes more evenly
                    //     adjustSizes: false, // Adjust sizes to avoid overlap
                    //     edgeWeightInfluence: 2
                    // }
                });

                // Update node positions with layout results
                graph.updateEachNodeAttributes((node: string, attr: Record<string, unknown>) => {
                    return {
                        ...attr,
                        x: positions[node].x,
                        y: positions[node].y
                    };
                });

                // Apply noverlap to prevent node overlaps
                // doesn't really seem to do anything unfortunately
                // noverlap(graph, {
                //     maxIterations: 500,
                //     settings: {
                //         margin: 10,
                //         expansion: 2,
                //         gridSize: 20,
                //         speed: 3
                //     }
                // });

                // Load the graph into Sigma
                loadGraph(graph);

                // Register hover events after loading the graph
                registerEvents({
                    enterNode: (event) => setHoveredNode(event.node),
                    leaveNode: () => setHoveredNode(null),
                });

            } catch (error) {
                console.error('Error loading CSV data:', error);

                // Fallback to hardcoded data if CSV loading fails
                try {
                    const { default: Graph } = await import("graphology");

                    const graph = new Graph();
                    graph.addNode("1", { label: "Sorry, something went wrong!", x: 0, y: 0, size: 10, color: "blue" });
                    graph.addNode("2", { label: "Try reloading the page :(", x: 1, y: 1, size: 20, color: "red" });
                    graph.addEdge("1", "2", { size: 5, color: "purple" });

                    loadGraph(graph);

                    // Register hover events for fallback graph too
                    registerEvents({
                        enterNode: (event) => setHoveredNode(event.node),
                        leaveNode: () => setHoveredNode(null),
                    });
                } catch (fallbackError) {
                    console.error('Failed to load fallback graph:', fallbackError);
                }
            }
        };

        loadCSVData();
    }, [loadGraph, registerEvents]);

    /**
     * When component mount or hovered node change
     * => Setting the sigma reducers
     */
    useEffect(() => {
        setSettings({
            nodeReducer: (node, data) => {
                const graph = sigma.getGraph();
                const newData = { ...data, highlighted: false } as Record<string, unknown>;

                if (!disableHoverEffect && hoveredNode) {
                    if (node === hoveredNode || graph.neighbors(hoveredNode).includes(node)) {
                        newData.highlighted = true;
                        // Show label for hovered node and its neighbors
                        newData.label = data.label;
                    } else {
                        // Disable graying out for now (set to false to re-enable)
                        if (false) {
                            newData.color = '#E2E2E2';
                        }
                        newData.highlighted = false;
                        // Hide label for unconnected nodes
                        newData.label = '';
                    }
                } else {
                    // When not hovering, show all labels
                    newData.label = data.label;
                }
                return newData;
            },
            edgeReducer: (edge, data) => {
                const graph = sigma.getGraph();
                const newData = { ...data, hidden: false } as Record<string, unknown>;

                if (!disableHoverEffect && hoveredNode && !graph.extremities(edge).includes(hoveredNode)) {
                    newData.hidden = true;
                }
                return newData;
            },
        });
    }, [hoveredNode, setSettings, sigma, disableHoverEffect]);

    return null; // This component doesn't render anything
};

// Main component using SigmaContainer with controls
const GraphVisualization: React.FC = () => {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [focusNode, setFocusNode] = useState<string | null>(null);

    const onFocus = useCallback((value: GraphSearchOption | null) => {
        if (value === null) setFocusNode(null);
        else if (value.type === 'nodes') setFocusNode(value.id);
    }, []);

    const onChange = useCallback((value: GraphSearchOption | null) => {
        if (value === null) setSelectedNode(null);
        else if (value.type === 'nodes') setSelectedNode(value.id);
    }, []);

    const postSearchResult = useCallback((options: GraphSearchOption[]): GraphSearchOption[] => {
        return options.length <= 10
            ? options
            : [
                ...options.slice(0, 10),
                {
                    type: 'message',
                    message: <span className="text-center text-muted">And {options.length - 10} others</span>,
                },
            ];
    }, []);

    return (
        <SigmaContainer
            className="w-full h-full"
            // style={{ backgroundColor: '#D3D3D3' }}
            settings={{
                allowInvalidContainer: true,
                renderLabels: true, // Enable labels so we can control them dynamically
                // defaultNodeType: 'image',
                defaultEdgeType: 'arrow',
                // labelDensity: 0.07,
                // labelGridCellSize: 60,
                // labelRenderedSizeThreshold: 15,
                // labelFont: 'Lato, sans-serif',
                // zIndex: true,
                // renderEdgeLabels: false,
                // defaultNodeColor: "#999",
                // defaultEdgeColor: "#ccc",
                // labelColor: { color: "#000" },
                // labelSize: 12,
                minCameraRatio: 0.005,
                maxCameraRatio: 1.5,
            }}
        >
            <GraphLoader disableHoverEffect={false} />
            <FocusOnNode node={focusNode ?? selectedNode} />

            {/* Search Controls - Top Right */}
            <ControlsContainer position={'top-right'}>
                <GraphSearch
                    type="nodes"
                    value={selectedNode ? { type: 'nodes', id: selectedNode } : null}
                    onFocus={onFocus}
                    onChange={onChange}
                    postSearchResult={postSearchResult}
                />
            </ControlsContainer>

            {/* Zoom and Fullscreen Controls - Bottom Right */}
            <ControlsContainer position={'bottom-right'}>
                <ZoomControl labels={{ zoomIn: 'Zoom In', zoomOut: 'Zoom Out', reset: 'Reset View' }}>
                    <AiOutlineZoomIn />
                    <AiOutlineZoomOut />
                    <MdFilterCenterFocus />
                </ZoomControl>
                <FullScreenControl labels={{ enter: 'Fullscreen', exit: 'Exit Fullscreen' }}>
                    <AiOutlineFullscreen />
                    <AiOutlineFullscreenExit />
                </FullScreenControl>
            </ControlsContainer>

            {/* Minimap - Bottom Left */}
            <ControlsContainer position={'bottom-left'}>
                <MiniMap width="150px" height="150px" />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphVisualization;