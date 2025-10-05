"use client";

import Link from 'next/link';
import sfuCoursesData from './sfu-verified-courses.json';

type Course = {
  id: number;
  dept: string;
  number: string;
  title: string;
  description: string;
  prerequisites: string;
  corequisites: string;
  notes: string;
  parse_status: string;
  parsed_prerequisites: Record<string, unknown> | null;
  parsed_credit_conflicts: Record<string, unknown> | null;
  verified_at: string;
};

export default function SFUCoursesPage() {
  const courses: Course[] = sfuCoursesData.courses;

  // Group courses by department
  const coursesByDept = courses.reduce((acc, course) => {
    if (!acc[course.dept]) {
      acc[course.dept] = [];
    }
    acc[course.dept].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          SFU Course Prerequisites
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Browse verified course prerequisite data from Simon Fraser University.
          Total courses: {courses.length}
        </p>

        <div className="space-y-8">
          {Object.entries(coursesByDept)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dept, deptCourses]) => (
              <div key={dept} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{dept}</h2>
                </div>
                <div className="p-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {deptCourses
                      .sort((a, b) => a.number.localeCompare(b.number))
                      .map((course) => (
                        <Link
                          key={course.id}
                          href={`/sfu/courses/${course.dept}/${course.number}`}
                          className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
                        >
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {course.dept} {course.number}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {course.title}
                          </div>
                          {course.prerequisites && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              Has prerequisites
                            </div>
                          )}
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Data last updated: {new Date(sfuCoursesData.metadata.exportDate).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}