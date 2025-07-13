"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const TestGraphVisualization = dynamic(() => import("./graph"), {
  ssr: false,
});

export default function TestPage() {
  return (
    <div className="w-screen h-screen flex flex-col">
      <header className="m-2">
        <h1 className="text-3xl font-bold">
          <Link href={"/tests"}>
            Force Directed Node Graph
          </Link>
        </h1>
        <p className="text-m">
          Sigma.js w/ <Link
            className='text-blue-600 hover:underline'
            target='_blank'
            href="https://www.sfu.ca/students/calendar/2025/fall/courses/econ/305.html"
          >ECON 305</Link>
        </p>
        <div className="mt-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            Groups (Logic)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            Courses
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            Credit Requirements
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            Notes
          </span>
        </div>
      </header>

      <main className="w-full flex-grow">
        <TestGraphVisualization />
      </main>
    </div>
  );
}
