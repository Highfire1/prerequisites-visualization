import CourseGraph from '../CourseGraph';
import sfuCoursesData from '../../../sfu-verified-courses.json';

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

export default function GraphPage({ params }: PageProps) {
  const courseId = `${params.dept.toUpperCase()} ${params.number}`;
  
  // Find the course in our data
  const course = sfuCoursesData.courses.find(
    (c: Course) => c.dept === params.dept.toUpperCase() && c.number === params.number
  );

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
      <CourseGraph courseId={courseId} />
    </div>
  );
}