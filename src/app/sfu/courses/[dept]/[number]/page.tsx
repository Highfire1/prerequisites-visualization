import CourseGraph from "./CourseGraph";
import { getCourseByDeptAndNumber, getCoursesForGraph } from "../../../../../utils/courseApi";
import { fetchOutlines } from "../../../../../utils/sfuOutlinesApi";

interface PageProps {
  params: Promise<{
    dept: string;
    number: string;
  }>;
}

export async function generateStaticParams() {
  const outlines = await fetchOutlines();
  const params = outlines.map((o) => ({
    dept: String(o.dept).toLowerCase(),
    number: String(o.number).toLowerCase(),
  }));

  if (params.length === 0) {
    throw new Error("Outlines API returned no data; cannot generate static params");
  }
  
  return params;
}

export const dynamicParams = false;
export const revalidate = false;

export default async function CoursePage({ params }: PageProps) {
  const resolvedParams = await params;
  const courseId = `${resolvedParams.dept.toUpperCase()} ${resolvedParams.number.toUpperCase()}`;

  const [neededCourses, course] = await Promise.all([
    getCoursesForGraph(resolvedParams.dept, resolvedParams.number.toUpperCase()),
    getCourseByDeptAndNumber(resolvedParams.dept, resolvedParams.number.toUpperCase()),
  ]);

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="text-center px-6 max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            No prerequisite data yet
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            We have not yet parsed {courseId}.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            You can help by contributing at
            {' '}
            <a
              href="https://crowdsource.sfucourses.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              crowdsource.sfucourses.com
            </a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white dark:bg-black">
      <CourseGraph courseId={courseId} courses={neededCourses} />
    </div>
  );
}