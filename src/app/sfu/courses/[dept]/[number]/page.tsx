import CourseGraph from './CourseGraph';
import { getAllCourses, getCourseByDeptAndNumber } from '../../../../../utils/courseApi';
import { fetchOutlines } from '../../../../../utils/sfuOutlinesApi';

interface PageProps {
  params: Promise<{
    dept: string;
    number: string;
  }>;
}

// Generate static paths for all courses from API
export async function generateStaticParams() {
  try {
    // Prefer official outlines API to enumerate ALL courses
    const outlines = await fetchOutlines();
    const params = outlines.map((o) => ({
      dept: String(o.dept).toLowerCase(),
      number: String(o.number).toLowerCase(),
    }));
    // Fallback: if outlines unexpectedly empty, use crowdsourced list
    if (params.length === 0) {
      const courses = await getAllCourses();
      return courses.map((course) => ({ dept: String(course.dept).toLowerCase(), number: String(course.number).toLowerCase() }));
    }
    return params;
  } catch (error) {
    console.error('Error generating static params from outlines:', error);
    try {
      const courses = await getAllCourses();
      return courses.map((course) => ({ dept: String(course.dept).toLowerCase(), number: String(course.number).toLowerCase() }));
    } catch (e) {
      console.error('Error falling back to crowdsourced params:', e);
      return [];
    }
  }
}

// With static export, only the paths from generateStaticParams are valid
export const dynamicParams = false;
// Ensure this route is fully static
export const revalidate = false;

export default async function CoursePage({ params }: PageProps) {
  const resolvedParams = await params;
  const courseId = `${resolvedParams.dept.toUpperCase()} ${resolvedParams.number.toUpperCase()}`;

  // Fetch the crowdsourced data (may not include every course)
  const [allCourses, course] = await Promise.all([
    getAllCourses(),
    getCourseByDeptAndNumber(resolvedParams.dept, resolvedParams.number.toUpperCase()),
  ]);

  // If this course exists in outlines but not in our crowdsourced data, show a helpful message
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

  // Render the graph regardless; the component will indicate when data is missing for a course
  return (
    <div className="w-full h-screen bg-white dark:bg-black">
      <CourseGraph courseId={courseId} courses={allCourses} />
    </div>
  );
}