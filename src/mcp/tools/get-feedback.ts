import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';

// FeedbackResult is the LLM-friendly output shape for one graded assignment.
// It flattens Canvas's nested submission + rubric structure into a flat object
// the LLM can read and summarise directly.
export interface FeedbackResult {
  courseName: string;
  assignmentName: string;
  score: number | null;
  grade: string | null;
  // All teacher comments on this submission, formatted as "TeacherName: comment text"
  teacherComments: string[];
  // Rubric scores per criterion — useful for detailed feedback explanations
  rubric: Array<{ criterion: string; points: number }>;
}

// parameters defines what the LLM must/can send when calling this tool.
// course_id and assignment_id are optional — if omitted, all courses/assignments are returned.
const parameters = z.object({
  course_id: z
    .string()
    .optional()
    .describe('Canvas course ID. Omit for all courses.'),
  assignment_id: z
    .string()
    .optional()
    .describe('Specific assignment ID. Omit for recent feedback.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<FeedbackResult[]> {
  // Step 1: Get the student's Canvas access token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Get all active courses, then filter to the requested one (if specified)
  const courses = await deps.canvasApi.getCourses(token);
  const filteredCourses = args.course_id
    ? courses.filter((c) => String(c.id) === args.course_id)
    : courses;

  // Step 3: For each course, fetch submissions in parallel using Promise.all.
  // .catch(() => []) swallows errors per-course — if Canvas returns 403 for one course
  // (student lost access), the other courses still return their data.
  const results = await Promise.all(
    filteredCourses.map(async (course) => {
      const submissions = await deps.canvasApi
        .getSubmissions(token, String(course.id))
        .catch(() => []);

      // Only include submissions that were actually submitted (not drafts)
      let filtered = submissions.filter((s) => s.submitted_at !== null);

      // Further filter to a specific assignment if the LLM requested one
      if (args.assignment_id) {
        filtered = filtered.filter(
          (s) => String(s.assignment_id) === args.assignment_id,
        );
      }

      // Map each submission to a FeedbackResult
      return filtered.map(
        (s): FeedbackResult => ({
          courseName: course.name,
          // Use the assignment name if available; fall back to the ID if Canvas didn't include it
          assignmentName: s.assignment?.name ?? `Assignment ${s.assignment_id}`,
          score: s.score,
          grade: s.grade,
          // Format each comment as "AuthorName: comment text" for readability
          teacherComments: (s.submission_comments ?? []).map(
            (c) => `${c.author_name}: ${c.comment}`,
          ),
          // rubric_assessment is a Record<criterionId, {points, description}>.
          // Object.values() extracts just the values, discarding the criterion ID keys.
          rubric: Object.values(s.rubric_assessment ?? {}).map((v) => ({
            criterion: v.description ?? '',
            points: v.points,
          })),
        }),
      );
    }),
  );

  // Flatten the array-of-arrays (one array per course) into a single flat list
  return results.flat();
}

export const getFeedbackTool: Tool<typeof parameters> = {
  name: 'get_feedback',
  description:
    'Retrieve teacher comments and rubric scores on submitted assignments from Canvas LMS. Call when a student asks about feedback, comments, what the teacher said, or how their assignment was graded. Returns instructor comments and rubric criteria. Does not return course grades or announcements.',
  parameters,
  handle,
};
