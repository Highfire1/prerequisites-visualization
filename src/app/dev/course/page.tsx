import Link from 'next/link';

export default function TestsIndexPage() {
    const tests = [
        {
            title: 'force graph',
            path: '/dev/course/graph'
        },
        {
            title: 'horizontal tree',
            path: '/dev/course/tree'
        },
        {
            title: 'radial tree',
            path: '/dev/course/radial-tree'
        },
        {
            title: 'tangled tree',
            path: '/dev/course/tangled-tree'
        }
    ];

    return (
        <div className="p-5 font-sans flex flex-col items-center justify-center min-h-screen bg-gray-200">
            <h1 className="text-2xl font-bold mt-10 text-black">Experiments</h1>
            <p className="text-black">
                Different ways to visualize the prerequisites for a course.
            </p>

            <div className="my-6 space-y-4">
                {tests.map((test) => (
                    <Link
                        key={test.path}
                        href={test.path}
                        className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-blue-600 hover:bg-blue-700"
                    >
                        {test.title}
                    </Link>
                ))}
            </div>

            <Link
                href="/"
                className="block w-96 text-center py-3 text-white font-bold rounded-lg bg-gray-800 mt-10"
            >
                Back to Main Application
            </Link>
        </div>
    );
}
