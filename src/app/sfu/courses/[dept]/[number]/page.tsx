import Link from 'next/link';
import CoursePageClient from './CoursePageClient';
import sfuCoursesData from '../../sfu-verified-courses.json';

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

interface PageProps {
  params: {
    dept: string;
    number: string;
  };
}

// Generate static paths for all courses in the JSON data
export async function generateStaticParams() {
  return sfuCoursesData.courses.map((course: Course) => ({
    dept: course.dept,
    number: course.number,
  }));
}

export default function CoursePage({ params }: PageProps) {
  const courseId = `${params.dept.toUpperCase()} ${params.number}`;
  
  // Find the course in our data
  const course = sfuCoursesData.courses.find(
    (c: Course) => c.dept === params.dept.toUpperCase() && c.number === params.number
  );

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8 bg-white dark:bg-black min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Course Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sorry, we don&apos;t have prerequisite data for {courseId} yet.
          </p>
          <Link
            href="/sfu/courses"
            className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            ← Back to Course List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-white dark:bg-black min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/sfu/courses"
            className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            ← Back to Courses
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {course.dept} {course.number}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">{course.title}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Course Description</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{course.description}</p>
          
          {course.prerequisites && (
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Prerequisites (Original Text)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                {course.prerequisites}
              </p>
            </div>
          )}
          
          {course.corequisites && (
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Corequisites</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                {course.corequisites}
              </p>
            </div>
          )}
          
          {course.notes && (
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                {course.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      <CoursePageClient courseId={courseId} dept={params.dept} number={params.number} />
    </div>
  );
}