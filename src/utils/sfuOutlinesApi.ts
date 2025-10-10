export type SfuOutline = {
  corequisites?: string;
  degreeLevel?: string;
  deliveryMethod?: string;
  dept: string;
  description?: string;
  designation?: string;
  notes?: string;
  number: string;
  prerequisites?: string;
  title?: string;
  units?: string;
  offerings?: Array<{
    instructors?: string[];
    term?: string;
  }>;
};

// Fetch outlines; if dept/number omitted, API is expected to return all outlines
export async function fetchOutlines(params?: { dept?: string; number?: string }): Promise<SfuOutline[]> {
  const base = 'https://api.sfucourses.com/v1/rest/outlines';
  const url = new URL(base);
  if (params?.dept != null) url.searchParams.set('dept', params.dept.toUpperCase());
  if (params?.number != null) url.searchParams.set('number', params.number);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    // Cache at build time; for client-side it will use the browser cache
    cache: 'force-cache',
  });
  if (!res.ok) {
    // Return empty array on failure so callers can treat as not found
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as SfuOutline[]) : [];
}

export async function isValidCourseSFU(dept: string, number: string): Promise<boolean> {
  try {
    const outlines = await fetchOutlines({ dept, number });
    return outlines.length > 0;
  } catch {
    return false;
  }
}
