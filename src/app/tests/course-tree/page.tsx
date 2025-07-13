'use client'

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import the tree component to avoid SSR issues with D3
const D3TreeVisualization = dynamic(() => import('./tree'), { ssr: false });

export default function TreePage() {
    return (
        // if you remove this calc then the page becomes scrollable
        // i don't know why.
        // and i hate that.
        <div className='h-[calc(100vh-20px)] overflow-hidden'>
            <div className="bg-gray-50 px-4 py-4 flex flex-col h-full">

                <header className='flex-shrink-0'>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        <Link href={"/tests"}>Tree</Link>
                    </h1>
                    <p className="text-gray-600 mb-6">
                        D3.js w/ <Link
                            className='text-blue-600 hover:underline'
                            target='_blank'
                            href="https://www.sfu.ca/students/calendar/2025/fall/courses/econ/305.html"
                        >ECON 305</Link>
                    </p>
                </header>

                {/* Visualization */}
                <div className="bg-white rounded-lg shadow-sm border flex-1 min-h-0 overflow-hidden">
                    <D3TreeVisualization />
                </div>

            </div>
        </div>
    );
}
