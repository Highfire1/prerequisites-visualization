import CourseGraph from './CourseGraph';
import { getAllCourses, getCourseByDeptAndNumber } from '../../../../../utils/courseApi';

interface PageProps {
  params: Promise<{
    dept: string;
    number: string;
  }>;
}

// Generate static paths for all courses from API
export async function generateStaticParams() {
  try {
    const courses = await getAllCourses();
    const params = courses.map((course) => ({
      // Keep original casing to match links like /sfu/courses/CMPT/105W
      dept: String(course.dept),
      number: String(course.number),
    }));
    console.log(`Generated ${params.length} static params for courses`);
    return params;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

// With static export, only the paths from generateStaticParams are valid
export const dynamicParams = false;
// Ensure this route is fully static
export const revalidate = false;

export default async function CoursePage({ params }: PageProps) {
  const resolvedParams = await params;
  const courseId = `${resolvedParams.dept.toUpperCase()} ${resolvedParams.number}`;
  
  // Fetch the course and all courses from API at build time
  const [course, allCourses] = await Promise.all([
    getCourseByDeptAndNumber(resolvedParams.dept, resolvedParams.number),
    getAllCourses()
  ]);

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Course Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            No prerequisite data available for {courseId}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Contribute today at{' '}
            <a
              href="https://crowdsource.sfucourses.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              crowdsource.sfucourses.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white dark:bg-black">
      <CourseGraph courseId={courseId} courses={allCourses} />
    </div>
  );
}