import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';

// RubricScore is one row of a rubric assessment — one criterion and the points awarded.
export interface RubricScore {
  // The name of the rubric criterion (e.g. "Code quality", "Documentation")
  criterion: string;
  // The rating label that matches the points awarded (e.g. "Proficient", "Needs improvement")
  rating: string;
  points: number;
}

// GradeResult holds the complete grade picture for one course.
// It combines the overall course grade with per-assignment breakdown and rubric scores.
export interface GradeResult {
  courseName: string;
  courseCode: string;
  // Overall current score as a percentage (e.g. 85.5), null if not yet graded
  currentScore: number | null;
  // Overall current letter grade (e.g. "B+"), null if not yet graded
  currentGrade: string | null;
  assignments: Array<{
    name: string;
    score: number | null;
    grade: string | null;
    // workflow_state from Canvas: "submitted" | "graded" | "pending_review" | "unsubmitted"
    status: string;
    // Full rubric breakdown, or null if no rubric exists for this assignment
    rubric: RubricScore[] | null;
  }>;
}

// get_grades does not take student_id — the student is identified via the MCP session context.
const parameters = z.object({
  course_id: z
    .string()
    .optional()
    .describe('Canvas course ID. Omit for all courses.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<GradeResult[]> {
  // Resolve the token using the studentId from the session context
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Get all active courses to find names, codes, and enrollment grade data
  const courses = await deps.canvasApi.getCourses(token);

  // Filter to the requested course if course_id was provided
  const filtered = args.course_id
    ? courses.filter((c) => String(c.id) === args.course_id)
    : courses;

  // Fetch submissions for all filtered courses in parallel
  const submissionsPerCourse = await Promise.all(
    filtered.map((c) =>
      // .catch(() => []) — if one course's submissions fail (e.g. 403), return empty array
      // so the other courses can still return their grade data
      deps.canvasApi.getSubmissions(token, String(c.id)).catch(() => []),
    ),
  );

  return filtered.map((c, i) => {
    // enrollments[0] contains the student's current score and grade for this course
    const enrollment = c.enrollments?.[0];
    const submissions = submissionsPerCourse[i];

    return {
      courseName: c.name,
      courseCode: c.course_code,
      // computed_current_score is Canvas's live percentage grade
      currentScore: enrollment?.computed_current_score ?? null,
      // computed_current_grade is Canvas's live letter grade
      currentGrade: enrollment?.computed_current_grade ?? null,
      assignments: submissions
        // Only include submitted assignments — skip unsubmitted ones
        .filter((s) => s.submitted_at !== null)
        .map((s) => {
          // Build a Map from criterion ID → criterion definition (from the rubric template)
          // so we can look up criterion names and rating labels when building RubricScore objects
          const criteriaMap = new Map(
            (s.assignment?.rubric ?? []).map((rc) => [rc.id, rc]),
          );

          // rubric_assessment is a Record<criterionId, {points, description}> from Canvas.
          // We join it with the rubric template (criteriaMap) to add criterion names and rating labels.
          const rubric: RubricScore[] | null = s.rubric_assessment
            ? Object.entries(s.rubric_assessment).map(([id, v]) => {
                const criterion = criteriaMap.get(id);
                // Find the rating whose point value matches the awarded points
                const rating = criterion?.ratings.find(
                  (r) => r.points === v.points,
                );
                return {
                  criterion: criterion?.description ?? id,
                  rating: rating?.description ?? '',
                  points: v.points,
                };
              })
            : null;

          return {
            name: s.assignment?.name ?? `Assignment ${s.assignment_id}`,
            score: s.score,
            grade: s.grade,
            status: s.workflow_state ?? 'submitted',
            rubric,
          };
        }),
    };
  });
}

export const getGradesTool: Tool<typeof parameters> = {
  name: 'get_grades',
  description:
    'Retrieve course grades and scores from Canvas LMS. Call when a student asks about grades, marks, scores, percentages, or academic standing. Returns current score and letter grade per course plus a breakdown of individual assignment scores and rubric feedback.',
  parameters,
  handle,
};
