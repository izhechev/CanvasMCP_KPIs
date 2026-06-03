import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';

// CourseResult is the LLM-friendly shape returned by this tool.
// It renames Canvas API fields (e.g. course_code → courseCode) to cleaner names
// and only includes the fields the LLM actually needs — not the full Canvas response.
export interface CourseResult {
  courseId: string;
  name: string;
  courseCode: string;
  enrollmentType: string;
  createdAt: string;
  startAt: string | null;
  endAt: string | null;
}

// parameters is the Zod schema for this tool's inputs.
// fastmcp validates the LLM's arguments against this before handle() is called.
// If the LLM sends a wrong type or unknown field, Zod rejects it — no Canvas call is made.
const parameters = z.object({
  enrollment_state: z
    .string()
    .optional()
    .describe('Filter by enrollment state. Default: active.'),
});

// handle is the actual tool logic — called by fastmcp after Zod validation passes.
async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<CourseResult[]> {
  // Step 1: Resolve the student's Canvas bearer token.
  // In development this returns CANVAS_TEST_TOKEN; in production it decrypts from the store.
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Call Canvas API to get the student's enrolled courses
  const courses = await deps.canvasApi.getCourses(token, args.enrollment_state);

  // Step 3: Map Canvas response objects to the cleaner LLM-friendly CourseResult shape.
  // c.enrollments?.[0]?.type uses optional chaining — safely returns undefined if missing.
  // ?? 'student' provides a default if the enrollment type is not present.
  return courses.map((c) => ({
    courseId: String(c.id),
    name: c.name,
    courseCode: c.course_code,
    enrollmentType: c.enrollments?.[0]?.type ?? 'student',
    createdAt: c.created_at,
    startAt: c.start_at,
    endAt: c.end_at,
  }));
}

// The tool object is exported as a const satisfying the Tool interface.
// It is imported by tools/index.ts and registered with FastMCP at startup.
export const getCoursesTool: Tool<typeof parameters> = {
  name: 'get_courses',
  // description is what the LLM reads to decide whether to call this tool.
  // It explicitly states what the tool does NOT return to prevent the LLM from
  // calling get_courses when it actually needs get_grades or get_assignments.
  description:
    'Retrieve courses the student is enrolled in from Canvas LMS. Call when a student asks about their courses, classes, or subjects. Returns course names and codes. Does not return grades or assignments.',
  parameters,
  handle,
};
