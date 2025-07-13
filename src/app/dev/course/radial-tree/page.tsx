"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

// Dynamically import the radial tree component to avoid SSR issues with D3
const RadialTreeVisualization = dynamic(() => import("./tree"), { ssr: false });

export default function RadialTreePage() {
    const [layoutType, setLayoutType] = useState<"tree" | "cluster">("cluster");
    const [maxDepth, setMaxDepth] = useState<number>(0);

    return (
        <div className='h-[calc(100vh-20px)] overflow-hidden'>
            <div className="bg-gray-50 px-4 py-4 flex flex-col h-full">
                <header className='flex-shrink-0'>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        <Link href={"/dev/course"}>Radial Tree</Link>
                    </h1>
                    <p className="text-gray-600 mb-4">
                        D3.js w/ <Link
                            className='text-blue-600 hover:underline'
                            target='_blank'
                            href="https://www.sfu.ca/students/calendar/2025/fall/courses/econ/305.html"
                        >ECON 305</Link> and co.
                    </p>
                    
                    {/* Layout Toggle */}
                    <div className="flex items-center gap-6 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Layout:</span>
                            <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    onClick={() => setLayoutType("tree")}
                                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                                        layoutType === "tree"
                                            ? "bg-blue-500 text-white"
                                            : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    Tidy
                                </button>
                                <button
                                    onClick={() => setLayoutType("cluster")}
                                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                                        layoutType === "cluster"
                                            ? "bg-blue-500 text-white"
                                            : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    Cluster
                                </button>
                            </div>
                        </div>

                        {/* Depth Toggle */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Depth:</span>
                            <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
                                {[0, 1, 2, 3].map((depth) => (
                                    <button
                                        key={depth}
                                        onClick={() => setMaxDepth(depth)}
                                        className={`px-3 py-1 text-sm font-medium transition-colors ${
                                            maxDepth === depth
                                                ? "bg-blue-500 text-white"
                                                : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                    >
                                        {depth}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>
                {/* Visualization */}
                <div className="bg-white rounded-lg shadow-sm border flex-1 min-h-0 overflow-hidden">
                    <RadialTreeVisualization layoutType={layoutType} maxDepth={maxDepth} />
                </div>
            </div>
        </div>
    );
}
