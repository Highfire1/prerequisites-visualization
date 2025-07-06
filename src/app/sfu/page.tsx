"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const GraphVisualization = dynamic(() => import("./graph"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="w-screen h-screen flex flex-col">
      <header className="m-2">
        <h1 className="text-3xl font-bold">
          <Link href={"/"}>
            SFU Prerequisites Visualization
          </Link>
        </h1>
        <p className="text-m">
          Data may have errors or omissions. Check out the{" "}
          <Link href="https://github.com/Highfire1/prerequisites-visualization" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </Link>{" "}
          for more information.
        </p>
      </header>

      <main className="w-full flex-grow bg-green">
        <GraphVisualization />
      </main>
    </div>
  );
}
