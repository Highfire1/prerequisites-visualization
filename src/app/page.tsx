import React from 'react';
import Link from 'next/link';

const Page = () => {
  return (
    <div className="p-5 font-sans flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mt-10">Prerequisites Visualizations</h1>
      <p className="text-gray-500">
        Disclaimer: The data presented here may contain errors and omissions.</p>
      <p className="text-gray-500">Please refer to the official instution website for the most accurate information.</p>

      <div className="my-6 space-y-4">
        <Link
          href="/sfu"
          className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-[#7A003C]" // SFU color
        >
          SFU
        </Link>
        {/* <Link
          href="/ubc"
          className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-[#002145]" // UBC color
        >
          UBC
        </Link> */}
        {/* <Link
          href="/langara"
          className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-[#F47920]" // Langara color
        >
          Langara
        </Link> */}

      </div>

      

      
      <Link
        href="https://github.com/AndersonTseng/prerequisites-visualization"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-gray-800 mt-10"
      >
        Check out the codebase on GitHub
      </Link>
      <p className="text-gray-500 pb-2">
        By <a href="https://andersontseng.ca" target="_blank" rel="noopener noreferrer" className=" underline">Anderson Tseng</a>
      </p>
    </div>
  );
};

export default Page;
