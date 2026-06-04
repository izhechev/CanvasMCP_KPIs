import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';
import { stripHtml } from '../../common/strip-html';

// AnnouncementResult is the LLM-friendly shape for one course announcement.
// Canvas stores announcement bodies as raw HTML — we strip the HTML before returning.
export interface AnnouncementResult {
  title: string;
  postedAt: string;
  // Display name of the teacher or staff member who posted the announcement
  authorName: string;
  // Full content with HTML stripped — plain text the LLM can read directly
  contentPreview: string;
  // Link to the announcement on Canvas (useful if the student wants to read more)
  url: string;
  courseName: string;
}

const parameters = z.object({
  course_id: z
    .string()
    .optional()
    .describe('Canvas course ID. Omit for all courses.'),
  count: z
    .number()
    .optional()
    .describe('How many announcements to return. Default 20.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<AnnouncementResult[]> {
  // Step 1: Get the student's Canvas token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Build the list of courses to fetch announcements for.
  // If a specific course_id is given, use only that course.
  // Otherwise, fetch all active courses and get announcements for all of them.
  let courseEntries: Array<{ id: string; name: string }>;
  if (args.course_id) {
    // When filtering by course_id, we don't have the name — use a placeholder
    courseEntries = [{ id: args.course_id, name: `Course ${args.course_id}` }];
  } else {
    const courses = await deps.canvasApi.getCourses(token);
    courseEntries = courses.map((c) => ({ id: String(c.id), name: c.name }));
  }

  // Step 3: CanvasService.getAnnouncements() handles the parallel fetching,
  // merging, sorting newest-first, and limiting to 'count' items
  const announcements = await deps.canvasApi.getAnnouncements(
    token,
    courseEntries,
    args.count ?? 20,
  );

  // Step 4: Map to the LLM-friendly output shape
  return announcements.map((a) => ({
    title: a.title,
    postedAt: a.posted_at,
    // a.author can be null if Canvas did not return author info
    authorName: a.author?.display_name ?? 'Unknown',
    // Strip HTML from the announcement body so the LLM gets plain readable text
    contentPreview: stripHtml(a.message ?? ''),
    url: a.html_url,
    // course_name was added by CanvasService.getAnnouncements() — Canvas does not include it natively
    courseName: a.course_name,
  }));
}

export const getAnnouncementsTool: Tool<typeof parameters> = {
  name: 'get_announcements',
  description:
    'Retrieve course announcements from Canvas LMS. Call when a student asks about news, updates, announcements, or what is happening in a course. Returns titles, dates, content previews, and course names.',
  parameters,
  handle,
};
