// SFU Course data types
export type Course = {
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

export type CourseData = {
    courses: Course[];
    metadata?: {
        exportDate: string;
        totalCourses: number;
    };
};

// Cache for course data to avoid repeated API calls
let courseDataCache: CourseData | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCourseData(): Promise<CourseData> {
    // Check if we have valid cached data
    if (courseDataCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return courseDataCache;
    }

    const apiKey = process.env.CROWDSOURCE_API_KEY;
    if (!apiKey) {
        throw new Error('CROWDSOURCE_API_KEY is not configured in environment variables');
    }

    const response = await fetch('https://crowdsource.sfucourses.com/api/public/export-verified-courses', {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response Error:', response.status, response.statusText, errorText);
        throw new Error(`Failed to fetch course data: ${response.status} ${response.statusText}`);
    }

    // console.log("Response Details:");
    // console.log("Status:", response.status);
    // console.log("Status Text:", response.statusText);
    // console.log("Headers:", Array.from(response.headers.entries()));
    // console.log("Body (as text):", await response.text());

    const data: CourseData = await response.json();

    // Cache the data
    courseDataCache = data;
    cacheTimestamp = Date.now();

    return data;
}

export async function fetchCourseData(): Promise<CourseData> {
    return getCourseData();
}

export async function getCourseByDeptAndNumber(dept: string, number: string): Promise<Course | null> {
    const data = await getCourseData();
    return data.courses.find(
        (course) => course.dept === dept.toUpperCase() && course.number === number
    ) || null;
}

export async function getAllCourses(): Promise<Course[]> {
    const data = await getCourseData();
    return data.courses;
}

// Create course lookup map (cached)
let courseMapCache: Map<string, Course> | null = null;

export async function getCourseMap(): Promise<Map<string, Course>> {
    if (courseMapCache && courseDataCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return courseMapCache;
    }

    const courses = await getAllCourses();
    courseMapCache = new Map<string, Course>();
    courses.forEach(course => {
        const key = `${course.dept} ${course.number}`;
        courseMapCache!.set(key, course);
    });

    return courseMapCache;
}

// Helper to parse prerequisite courses from parsed_prerequisites tree
function extractCourseIdsFromPrereqs(prereqNode: Record<string, unknown>, collected: Set<string> = new Set()): Set<string> {
    if (!prereqNode) return collected;
    
    // Handle course node
    if (prereqNode.type === 'course' && prereqNode.department && prereqNode.number) {
        collected.add(`${prereqNode.department} ${prereqNode.number}`);
    }
    
    // Handle HSCourse node
    if (prereqNode.type === 'HSCourse' && prereqNode.course) {
        collected.add(prereqNode.course as string);
    }
    
    // Recurse into children
    if (prereqNode.children && Array.isArray(prereqNode.children)) {
        prereqNode.children.forEach((child: Record<string, unknown>) => extractCourseIdsFromPrereqs(child, collected));
    }
    
    return collected;
}

// Get only the courses needed for a specific course's prerequisite graph
export async function getCoursesForGraph(dept: string, number: string): Promise<Course[]> {
    const allCourses = await getAllCourses();
    const courseMap = new Map<string, Course>();
    allCourses.forEach(c => courseMap.set(`${c.dept} ${c.number}`, c));
    
    const rootCourse = await getCourseByDeptAndNumber(dept, number);
    if (!rootCourse) {
        return [];
    }
    
    const neededCourseIds = new Set<string>([`${rootCourse.dept} ${rootCourse.number}`]);
    const toProcess = [rootCourse];
    const processed = new Set<string>();
    
    // BFS to collect all prerequisite courses
    while (toProcess.length > 0) {
        const current = toProcess.shift()!;
        const currentId = `${current.dept} ${current.number}`;
        
        if (processed.has(currentId)) continue;
        processed.add(currentId);
        
        if (current.parsed_prerequisites) {
            const prereqIds = extractCourseIdsFromPrereqs(current.parsed_prerequisites);
            prereqIds.forEach(prereqId => {
                if (!neededCourseIds.has(prereqId)) {
                    neededCourseIds.add(prereqId);
                    const prereqCourse = courseMap.get(prereqId);
                    if (prereqCourse) {
                        toProcess.push(prereqCourse);
                    }
                }
            });
        }
    }
    
    // Return only the courses that are needed
    return Array.from(neededCourseIds)
        .map(id => courseMap.get(id))
        .filter((c): c is Course => c !== undefined);
}
