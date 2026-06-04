import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';
import { stripHtml } from '../../common/strip-html';

// AssignmentResult is the LLM-friendly output for a single assignment.
// description is cut to a 200-character preview — full assignment briefs can be thousands
// of characters and are not needed for the LLM to answer "what is due this week?".
export interface AssignmentResult {
  assignmentId: string;
  name: string;
  courseId: string;
  courseName: string;
  // dueAt is null if the assignment has no deadline set in Canvas
  dueAt: string | null;
  // pointsPossible is null for ungraded or pass/fail assignments
  pointsPossible: number | null;
  // submissionTypes lists how the student can submit (e.g. ["online_upload", "online_text_entry"])
  submissionTypes: string[];
  // Short plain-text preview of the assignment description (HTML stripped, max 200 chars)
  descriptionPreview: string;
}

const parameters = z.object({
  course_id: z
    .string()
    .optional()
    .describe('Canvas course ID. Omit for all courses.'),
  due_after: z
    .string()
    .optional()
    .describe('ISO date string. Only return assignments due after this date.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<AssignmentResult[]> {
  // Step 1: Get the student's Canvas token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Get all active courses, then filter to the requested one if specified
  const courses = await deps.canvasApi.getCourses(token);
  const filteredCourses = args.course_id
    ? courses.filter((c) => String(c.id) === args.course_id)
    : courses;

  // Step 3: Fetch assignments for all courses in parallel
  const perCourse = await Promise.all(
    filteredCourses.map(async (c) => {
      const assignments = await deps.canvasApi.getAssignments(
        token,
        String(c.id),
      );
      return assignments.map(
        (a): AssignmentResult => ({
          assignmentId: String(a.id),
          name: a.name,
          courseId: String(c.id),
          courseName: c.name,
          dueAt: a.due_at,
          pointsPossible: a.points_possible,
          submissionTypes: a.submission_types,
          // Strip HTML from description and cut to 200 chars to keep the response concise
          descriptionPreview: stripHtml(a.description ?? '').slice(0, 200),
        }),
      );
    }),
  );

  // Flatten results from all courses into a single list
  let results = perCourse.flat();

  // If due_after was provided, filter out assignments with no due date or due before that date
  if (args.due_after) {
    const after = new Date(args.due_after);
    results = results.filter(
      (a) => a.dueAt !== null && new Date(a.dueAt) > after,
    );
  }
  return results;
}

export const getAssignmentsTool: Tool<typeof parameters> = {
  name: 'get_assignments',
  description:
    'Retrieve assignments for a course from Canvas LMS. Call when a student asks about assignments, homework, tasks, deadlines, or what is due. Returns assignment names, due dates, and point values. Does not return grades or submission feedback.',
  parameters,
  handle,
};
