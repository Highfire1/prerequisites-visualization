'use client'

import React, { useEffect, useState } from "react";
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
import {
    AiOutlineFullscreen,
    AiOutlineFullscreenExit,
    AiOutlineZoomIn,
    AiOutlineZoomOut,
} from 'react-icons/ai';
import { MdFilterCenterFocus } from 'react-icons/md';

// Test data structure
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

// Component that loads the graph data
const TestGraphLoader: React.FC<{ disableHoverEffect?: boolean }> = ({ disableHoverEffect = false }) => {
    const loadGraph = useLoadGraph();
    const registerEvents = useRegisterEvents();
    const setSettings = useSetSettings();
    const sigma = useSigma();
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    useEffect(() => {
        const loadTestGraph = async () => {
            try {
                const { default: Graph } = await import("graphology");
                const { default: forceAtlas2 } = await import("graphology-layout-forceatlas2");

                const graph = new Graph();
                let nodeId = 0;

                // Helper function to get colors based on node type
                const getNodeColor = (type: string) => {
                    switch (type) {
                        case 'group': return '#3B82F6'; // Blue for logic groups
                        case 'transcript': return '#10B981'; // Green for courses
                        case 'creditCount': return '#F59E0B'; // Orange for credit requirements
                        case 'note': return '#8B5CF6'; // Purple for notes
                        default: return '#6B7280'; // Gray
                    }
                };

                // Helper function to get node size based on type
                const getNodeSize = (type: string) => {
                    switch (type) {
                        case 'group': return 10;
                        case 'transcript': return 12;
                        case 'creditCount': return 10;
                        case 'note': return 8;
                        default: return 10;
                    }
                };

                // Helper function to create label text
                const createLabel = (node: any) => {
                    switch (node.type) {
                        case 'group':
                            return '' // return `${node.logic.replace('_', ' ')}`;
                        case 'transcript':
                            const grade = node.minGrade ? ` (${node.minGrade})` : '';
                            const concurrent = node.canBeTakenConcurrently ? ' [Concurrent]' : '';
                            return `${node.course}${grade}${concurrent}`;
                        case 'creditCount':
                            return `${node.creditCount} Credits`;
                        case 'note':
                            return `Note: ${node.text.substring(0, 30)}...`;
                        default:
                            return 'Unknown';
                    }
                };

                // Recursive function to build graph from data structure
                const buildGraph = (node: any, parentId: number | null = null): number[] => {
                    // Special handling for ONE_OF groups - skip the node and return child IDs
                    if (node.type === 'group' && node.logic === 'ONE_OF') {
                        const childIds: number[] = [];
                        if (node.children && Array.isArray(node.children)) {
                            node.children.forEach((child: any) => {
                                const childNodeIds = buildGraph(child, parentId);
                                childIds.push(...childNodeIds);
                            });
                        }
                        return childIds;
                    }

                    // Normal node creation for all other types
                    const currentId = nodeId++;
                    const label = createLabel(node);
                    
                    graph.addNode(currentId.toString(), {
                        label: label,
                        x: Math.random() * 400,
                        y: Math.random() * 400,
                        size: getNodeSize(node.type),
                        color: getNodeColor(node.type)
                    });

                    // Connect to parent if exists
                    if (parentId !== null) {
                        graph.addEdge(currentId.toString(), parentId.toString(), {
                            size: 2,
                            color: '#9CA3AF',
                            label: 'ALL OF'
                        });
                    }

                    // Process children if they exist
                    if (node.children && Array.isArray(node.children)) {
                        node.children.forEach((child: any) => {
                            buildGraph(child, currentId);
                        });
                    }

                    return [currentId];
                };

                // Build the graph from test data
                const prerequisiteNodeIds = buildGraph(testData);

                // Add the target course (ECON 305) that these are prerequisites for
                const targetId = nodeId++;
                graph.addNode(targetId.toString(), {
                    label: 'ECON 305 (Target Course)',
                    x: Math.random() * 400,
                    y: Math.random() * 400,
                    size: 20,
                    color: '#DC2626' // Red for the target course
                });

                // Connect each prerequisite path to the target course with "ONE_OF" labeled edges
                prerequisiteNodeIds.forEach((prereqId, index) => {
                    graph.addEdge(prereqId.toString(), targetId.toString(), {
                        size: 3,
                        color: '#DC2626',
                        label: 'ONE OF' // Label both edges to show they're both part of the choice
                    });
                });

                // Apply Force Atlas 2 layout
                const positions = forceAtlas2(graph, {
                    iterations: 200,
                    settings: {
                        gravity: 0.5,
                        scalingRatio: 15,
                        strongGravityMode: false,
                        barnesHutOptimize: true,
                        barnesHutTheta: 0.5,
                        slowDown: 1,
                        linLogMode: false,
                        outboundAttractionDistribution: false,
                        adjustSizes: false,
                        edgeWeightInfluence: 3
                    }
                });

                // Update node positions with layout results
                graph.updateEachNodeAttributes((node: string, attr: Record<string, unknown>) => {
                    return {
                        ...attr,
                        x: positions[node].x,
                        y: positions[node].y
                    };
                });

                // Load the graph into Sigma
                loadGraph(graph);

                // Register hover events after loading the graph
                registerEvents({
                    enterNode: (event) => setHoveredNode(event.node),
                    leaveNode: () => setHoveredNode(null),
                });

            } catch (error) {
                console.error('Error loading test graph:', error);
            }
        };

        loadTestGraph();
    }, [loadGraph, registerEvents]);

    /**
     * When component mount or hovered node change
     * => Setting the sigma reducers
     */
    useEffect(() => {
        setSettings({
            // nodeReducer: (node, data) => {
            //     const graph = sigma.getGraph();
            //     const newData = { ...data, highlighted: data.highlighted || false } as Record<string, unknown>;

            //     // Make ALL_OF nodes visually larger
            //     if (data.label === '') { // ALL_OF nodes have empty labels
            //         newData.size = 200;
            //         newData.color = 'rgba(59, 130, 246, 0.3)'; // Blue with 30% opacity
            //     }

            //     if (!disableHoverEffect && hoveredNode) {
            //         if (node === hoveredNode || graph.neighbors(hoveredNode).includes(node)) {
            //             newData.highlighted = true;
            //         } else {
            //             newData.color = '#E2E2E2';
            //             newData.highlighted = false;
            //         }
            //     }
            //     return newData;
            // },
            // edgeReducer: (edge, data) => {
            //     const graph = sigma.getGraph();
            //     const newData = { ...data, hidden: false } as Record<string, unknown>;

            //     if (!disableHoverEffect && hoveredNode && !graph.extremities(edge).includes(hoveredNode)) {
            //         newData.hidden = true;
            //     }
            //     return newData;
            // },
        });
    }, [hoveredNode, setSettings, sigma, disableHoverEffect]);

    return null; // This component doesn't render anything
};

// Main test component
const TestGraphVisualization: React.FC = () => {
    return (
        <SigmaContainer
            className="w-full h-full"
            settings={{
                allowInvalidContainer: true,
                renderLabels: true,
                renderEdgeLabels: true, // Enable edge labels to show "ONE_OF"
                defaultEdgeType: 'arrow',
                minCameraRatio: 0.1,
                maxCameraRatio: 2,
                // Node label settings
                labelFont: 'Arial, sans-serif',
                labelSize: 12,
                labelWeight: 'bold',
                labelColor: { color: '#000' },
                labelDensity: 0.07,
                labelGridCellSize: 60,
                labelRenderedSizeThreshold: 8,
                // Edge label settings
                edgeLabelFont: 'Arial, sans-serif',
                edgeLabelSize: 10,
                edgeLabelWeight: 'bold',
                edgeLabelColor: { color: '#DC2626' }, // Red color for edge labels
            }}
        >
            <TestGraphLoader />
            
            {/* Controls */}
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
        </SigmaContainer>
    );
};

export default TestGraphVisualization;
