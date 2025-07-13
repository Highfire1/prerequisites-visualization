"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import to avoid SSR issues with D3
const TangledTreeVisualization = dynamic(
    () => import('./tree').then(mod => mod.TangledTreeVisualization),
    { ssr: false }
);

export default function TangledTreePage() {
    return (
        <div className="p-4 bg-white">
            <header className='flex-shrink-0 text-black'>
                <h1 className="text-3xl font-bold mb-2">
                    <Link href={"/dev/course"}>Tangled Tree</Link>
                </h1>
                <p className=" mb-6">
                    D3.js w/ <Link
                        className='text-blue-600 hover:underline'
                        target='_blank'
                        href="https://www.sfu.ca/students/calendar/2025/fall/courses/econ/305.html"
                    >ECON 305</Link>
                </p>
            </header>

            <Suspense fallback={<div>Loading...</div>}>
                <TangledTreeVisualization />
            </Suspense>
        </div>
    );
}
