/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { prerequisiteData, PrereqNode } from './prerequisiteData';

interface TangledTreeNode {
  id: string;
  level: number;
  parents: string[];
}

export const TangledTreeVisualization: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Extract all nodes from prerequisite data structure
    const extractNodes = (node: PrereqNode): string[] => {
      const nodes: string[] = [];
      
      if (node.type === "transcript") {
        nodes.push(node.course);
      } else if (node.type === "creditCount") {
        nodes.push(`${node.creditCount} credits`);
      } else if (node.type === "note") {
        nodes.push(node.text);
      } else if (node.type === "other") {
        nodes.push(node.text);
      } else if (node.type === "group") {
        node.children.forEach(child => {
          nodes.push(...extractNodes(child));
        });
      }
      
      return nodes;
    };

    // Convert prerequisite data to levels for tangled tree
    const convertToLevels = () => {
      const levels: TangledTreeNode[][] = [];
      const processedCourses = new Set<string>();
      
      // Start with ECON 305 at level 0
      levels[0] = [{ id: "ECON 305", level: 0, parents: [] }];
      processedCourses.add("ECON 305");

      for (let currentLevel = 0; currentLevel < 4; currentLevel++) {
        const nextLevel: TangledTreeNode[] = [];
        
        levels[currentLevel].forEach(node => {
          const prereqData = prerequisiteData[node.id];
          if (prereqData) {
            const allNodes = extractNodes(prereqData);
            allNodes.forEach((nodeId: string) => {
              let existingNode = nextLevel.find(n => n.id === nodeId);
              if (!existingNode) {
                // Check if node exists in any previous level
                existingNode = levels.flat().find(n => n.id === nodeId);
                if (!existingNode) {
                  nextLevel.push({
                    id: nodeId,
                    level: currentLevel + 1,
                    parents: [node.id]
                  });
                }
              } else {
                // Add this as another parent if not already present
                if (!existingNode.parents.includes(node.id)) {
                  existingNode.parents.push(node.id);
                }
              }
            });
          }
        });

        if (nextLevel.length > 0) {
          levels[currentLevel + 1] = nextLevel;
        } else {
          break;
        }
      }

      return levels.filter(level => level.length > 0);
    };

    // The tangled tree layout algorithm
    const constructTangleLayout = (levelsData: TangledTreeNode[][], options: any = {}) => {
      // Precompute level depth
      levelsData.forEach((l, i) => l.forEach(n => (n.level = i)));

      const nodes = levelsData.reduce((a, x) => a.concat(x), []);
      const nodes_index: { [key: string]: TangledTreeNode } = {};
      nodes.forEach(d => (nodes_index[d.id] = d));

      // Objectification - convert parent strings to parent objects
      nodes.forEach(d => {
        d.parents = (d.parents === undefined ? [] : d.parents).map(
          p => nodes_index[p]
        ) as any;
      });

      // Precompute bundles
      levelsData.forEach((l, i) => {
        const index: any = {};
        l.forEach((n: any) => {
          if (n.parents.length === 0) {
            return;
          }

          const id = n.parents
            .map((d: any) => d.id)
            .sort()
            .join('-X-');
          if (id in index) {
            index[id].parents = index[id].parents.concat(n.parents);
          } else {
            index[id] = {
              id: id,
              parents: n.parents.slice(),
              level: i,
              span: i - (Number(d3.min(n.parents, (p: any) => p.level)) || 0)
            };
          }
          n.bundle = index[id];
        });
        (l as any).bundles = Object.keys(index).map(k => index[k]);
        (l as any).bundles.forEach((b: any, i: number) => (b.i = i));
      });

      const links: any[] = [];
      nodes.forEach((d: any) => {
        d.parents.forEach((p: any) =>
          links.push({ source: d, bundle: d.bundle, target: p })
        );
      });

      const bundles = levelsData.reduce((a: any, x: any) => a.concat(x.bundles || []), []);

      // Reverse pointer from parent to bundles
      bundles.forEach((b: any) =>
        b.parents.forEach((p: any) => {
          if (p.bundles_index === undefined) {
            p.bundles_index = {};
          }
          if (!(b.id in p.bundles_index)) {
            p.bundles_index[b.id] = [];
          }
          p.bundles_index[b.id].push(b);
        })
      );

      nodes.forEach((n: any) => {
        if (n.bundles_index !== undefined) {
          n.bundles = Object.keys(n.bundles_index).map(k => n.bundles_index[k]);
        } else {
          n.bundles_index = {};
          n.bundles = [];
        }
        n.bundles.sort((a: any, b: any) => d3.descending(d3.max(a, (d: any) => d.span), d3.max(b, (d: any) => d.span)));
        n.bundles.forEach((b: any, i: number) => (b.i = i));
      });

      links.forEach((l: any) => {
        if (l.bundle.links === undefined) {
          l.bundle.links = [];
        }
        l.bundle.links.push(l);
      });

      // Layout parameters
      const padding = 8;
      const node_height = 30;
      const node_width = 150;
      const bundle_width = 14;
      const level_y_padding = 16;
      const metro_d = 4;
      const min_family_height = 22;
      
      options.c ||= 16;
      const c = options.c;
      options.bigc ||= node_width + c;

      nodes.forEach(
        (n: any) => (n.height = (Math.max(1, n.bundles.length) - 1) * metro_d)
      );

      let x_offset = padding;
      let y_offset = padding;
      levelsData.forEach((l: any) => {
        x_offset += (l.bundles?.length || 0) * bundle_width;
        y_offset += level_y_padding;
        l.forEach((n: any) => {
          n.x = n.level * node_width + x_offset;
          n.y = node_height + y_offset + n.height / 2;
          y_offset += node_height + n.height;
        });
      });

      let i = 0;
      levelsData.forEach((l: any) => {
        (l.bundles || []).forEach((b: any) => {
          b.x =
            (Number(d3.max(b.parents, (d: any) => d.x)) || 0) +
            node_width +
            ((l.bundles?.length || 1) - 1 - b.i) * bundle_width;
          b.y = i * node_height;
        });
        i += l.length;
      });

      links.forEach((l: any) => {
        l.xt = l.target.x;
        l.yt =
          l.target.y +
          l.target.bundles_index[l.bundle.id].i * metro_d -
          (l.target.bundles.length * metro_d) / 2 +
          metro_d / 2;
        l.xb = l.bundle.x;
        l.yb = l.bundle.y;
        l.xs = l.source.x;
        l.ys = l.source.y;
      });
      
      // Compress vertical space
      let y_negative_offset = 0;
      levelsData.forEach((l: any) => {
        y_negative_offset +=
          -min_family_height +
            (Number(d3.min(l.bundles || [], (b: any) =>
              d3.min(b.links || [], (link: any) => link.ys - 2*c - (link.yt + c))
            )) || 0);
        l.forEach((n: any) => (n.y -= y_negative_offset));
      });

      // Update link positions after compression
      links.forEach((l: any) => {
        l.yt =
          l.target.y +
          l.target.bundles_index[l.bundle.id].i * metro_d -
          (l.target.bundles.length * metro_d) / 2 +
          metro_d / 2;
        l.ys = l.source.y;
        l.c1 = l.source.level - l.target.level > 1 ? Math.min(options.bigc, l.xb-l.xt, l.yb-l.yt)-c : c;
        l.c2 = c;
      });

      const layout = {
        width: (Number(d3.max(nodes, (n: any) => n.x)) || 0) + node_width + 2 * padding,
        height: (Number(d3.max(nodes, (n: any) => n.y)) || 0) + node_height / 2 + 2 * padding,
        node_height,
        node_width,
        bundle_width,
        level_y_padding,
        metro_d
      };

      return { levels: levelsData, nodes, nodes_index, links, bundles, layout };
    };

    if (!svgRef.current) return;
    
    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const levels = convertToLevels();
    const { nodes, links, layout } = constructTangleLayout(levels);

    // Set up SVG
    const svg = d3.select(svgRef.current);
    const width = Math.max(layout.width, 800);
    const height = Math.max(layout.height, 600);
    
    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background-color", "#f8f9fa");

    // Create main group for zooming
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Draw links with the nicer styling
    const linkGroup = g.append("g").attr("class", "links");
    
    // Group links by bundle for better rendering
    const bundleMap = new Map();
    links.forEach((link: any) => {
      const bundleId = link.bundle.id;
      if (!bundleMap.has(bundleId)) {
        bundleMap.set(bundleId, []);
      }
      bundleMap.get(bundleId).push(link);
    });

    bundleMap.forEach((bundleLinks) => {
      // Create path data for all links in this bundle
      const pathData = bundleLinks.map((l: any) => 
        `M${l.xt} ${l.yt}
         L${l.xb - l.c1} ${l.yt}
         A${l.c1} ${l.c1} 90 0 1 ${l.xb} ${l.yt + l.c1}
         L${l.xb} ${l.ys - l.c2}
         A${l.c2} ${l.c2} 90 0 0 ${l.xb + l.c2} ${l.ys}
         L${l.xs} ${l.ys}`
      ).join(" ");

      // Background stroke (wider, light color)
      linkGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", "#f8f9fa")
        .attr("stroke-width", 5)
        .attr("stroke-linecap", "round");

      // Foreground stroke (thinner, colored)
      linkGroup
        .append("path")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", "#6c757d")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");
    });

    // Draw nodes with vertical line styling
    const nodeGroup = g.append("g").attr("class", "nodes");
    
    nodes.forEach((node: any) => {
      const nodeG = nodeGroup
        .append("g")
        .attr("class", "node-group");

      // Determine node color based on type
      let nodeColor = "#007bff"; // blue for courses
      if (node.level === 0) {
        nodeColor = "#dc3545"; // red for starting course
      } else if (node.id.includes("credits")) {
        nodeColor = "#28a745"; // green for credits
      } else if (node.id.length > 20) {
        nodeColor = "#ffc107"; // yellow for notes/other text
      }

      // Background vertical line (wider, black)
      nodeG
        .append("line")
        .attr("x1", node.x)
        .attr("y1", node.y - node.height / 2)
        .attr("x2", node.x)
        .attr("y2", node.y + node.height / 2)
        .attr("stroke", "black")
        .attr("stroke-width", 8)
        .attr("stroke-linecap", "round");

      // Foreground vertical line (thinner, white)
      nodeG
        .append("line")
        .attr("x1", node.x)
        .attr("y1", node.y - node.height / 2)
        .attr("x2", node.x)
        .attr("y2", node.y + node.height / 2)
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("stroke-linecap", "round");

      // Background text (stroke for outline)
      nodeG
        .append("text")
        .attr("x", node.x + 6)
        .attr("y", node.y - node.height / 2 - 6)
        .attr("font-family", "sans-serif")
        .attr("font-size", "10px")
        .attr("stroke", "#f8f9fa")
        .attr("stroke-width", 2)
        .attr("fill", "#f8f9fa")
        .text(node.id.length > 25 ? node.id.substring(0, 22) + "..." : node.id);

      // Foreground text
      nodeG
        .append("text")
        .attr("x", node.x + 6)
        .attr("y", node.y - node.height / 2 - 6)
        .attr("font-family", "sans-serif")
        .attr("font-size", "10px")
        .attr("fill", nodeColor)
        .attr("pointer-events", "none")
        .text(node.id.length > 25 ? node.id.substring(0, 22) + "..." : node.id);
    });

  }, []);

  return (
    <div className="w-full h-[650px] border border-gray-300 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default TangledTreeVisualization;
