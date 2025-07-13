import Link from 'next/link';

export default function TestsIndexPage() {
    const tests = [
        {
            title: 'course graph',
            path: '/tests/course-graph'
        },
        {
            title: 'course horizontal tree',
            path: '/tests/course-tree'
        },
        {
            title: 'course radial tree',
            path: '/tests/course-radial-tree'
        },
    ];

    return (
        <div className="p-5 font-sans flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-2xl font-bold mt-10">Prerequisites Visualization Tests</h1>
            <p className="text-gray-500">
                Different approaches to visualizing ECON 305 prerequisites with ONE_OF/ALL_OF logic.
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
