"use client";

interface CoursePageClientProps {
  courseId: string;
  dept: string;
  number: string;
}

export default function CoursePageClient({ dept, number }: CoursePageClientProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Interactive Prerequisite Graph
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Click on prerequisite courses to explore their requirements. Hover to preview.
        </p>
      </div>
      <div className="h-[80vh]">
        <iframe
          src={`/sfu/courses/${dept}/${number}/graph`}
          className="w-full h-full border-0"
          title={`Prerequisite graph for ${dept} ${number}`}
        />
      </div>
    </div>
  );
}