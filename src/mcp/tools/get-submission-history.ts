import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';

// SubmissionHistoryResult is the LLM-friendly shape for one submission record.
// Focused on "what did I hand in and when" — no rubric details or comments
// (those are in get_feedback which is the right tool for that question).
export interface SubmissionHistoryResult {
  assignmentId: string;
  assignmentName: string;
  courseId: string;
  courseName: string;
  // When the student submitted — never null here because we filter out unsubmitted below
  submittedAt: string;
  // Which attempt number this is (1 = first submission, 2 = resubmission, etc.), null if unknown
  attempt: number | null;
  // When the teacher graded this submission, null if not yet graded
  gradedAt: string | null;
  score: number | null;
  grade: string | null;
  // Canvas workflow_state: "submitted" | "graded" | "pending_review" | "unsubmitted"
  workflowState: string;
}

const parameters = z.object({
  since: z
    .string()
    .optional()
    .describe('ISO date string. Only return submissions after this date.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<SubmissionHistoryResult[]> {
  // Step 1: Get the student's Canvas token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Get all active courses
  const courses = await deps.canvasApi.getCourses(token);

  // Step 3: Fetch submissions for all courses in parallel.
  // .catch(() => []) per course — if one course returns 403 (e.g. student lost access),
  // that course returns an empty array and the rest still succeed.
  const perCourse = await Promise.all(
    courses.map(async (c) => {
      const subs = await deps.canvasApi
        .getSubmissions(token, String(c.id))
        .catch(() => []);
      return (
        subs
          // Filter out assignments the student has not submitted yet
          .filter((s) => s.submitted_at !== null)
          .map(
            (s): SubmissionHistoryResult => ({
              assignmentId: String(s.assignment_id),
              assignmentName:
                s.assignment?.name ?? `Assignment ${s.assignment_id}`,
              courseId: String(c.id),
              courseName: c.name,
              // Non-null assertion (!) is safe here because we filtered null out above
              submittedAt: s.submitted_at!,
              attempt: s.attempt,
              gradedAt: s.graded_at,
              score: s.score,
              grade: s.grade,
              workflowState: s.workflow_state ?? 'submitted',
            }),
          )
      );
    }),
  );

  // Flatten all courses into a single list
  let results = perCourse.flat();

  // If 'since' was provided, filter to only submissions after that date
  if (args.since) {
    const sinceDate = new Date(args.since);
    results = results.filter(
      (r) => new Date(r.submittedAt).getTime() > sinceDate.getTime(),
    );
  }
  return results;
}

export const getSubmissionHistoryTool: Tool<typeof parameters> = {
  name: 'get_submission_history',
  description:
    'Retrieve a chronological history of all submitted assignments across all Canvas courses. ' +
    'Call when a student asks what they have handed in, their submission history, ' +
    'or which assignments are still pending grading. Returns assignment names, course, ' +
    'submission date, score, and workflow state. Does not return rubric details or teacher comments.',
  parameters,
  handle,
};
