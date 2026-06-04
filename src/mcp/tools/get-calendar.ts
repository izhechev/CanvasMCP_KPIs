import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';
import { stripHtml } from '../../common/strip-html';

// CalendarEventResult is the LLM-friendly shape for one calendar entry.
// Canvas returns both regular events (lectures, meetings) and assignment deadlines
// through the same calendar endpoint — eventType distinguishes them.
export interface CalendarEventResult {
  eventId: string;
  title: string;
  startAt: string;
  // endAt is null for events with no end time defined
  endAt: string | null;
  // Plain-text preview of the event description (HTML stripped)
  descriptionPreview: string;
  // Link to the event on Canvas
  url: string;
  // The course this event belongs to, or null for institution-wide events
  courseId: string | null;
  // "event" for calendar events, "assignment" for assignment deadlines
  eventType: string;
}

const parameters = z.object({
  start_date: z
    .string()
    .optional()
    .describe('ISO date string. Start of the date range.'),
  end_date: z
    .string()
    .optional()
    .describe('ISO date string. End of the date range.'),
});

async function handle(
  deps: ToolDeps,
  args: z.infer<typeof parameters>,
): Promise<CalendarEventResult[]> {
  // Step 1: Get the student's Canvas token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Get all active courses to build the list of course IDs.
  // Canvas calendar requires explicit context_codes[] — it does not have a "my courses" shortcut.
  const courses = await deps.canvasApi.getCourses(token);
  const courseIds = courses.map((c) => String(c.id));

  // Step 3: Build the default date range if none was provided.
  // Default: today → 30 days from now — covers the student's immediate upcoming schedule.
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 30);

  // Step 4: Fetch calendar events (Canvas internally splits into two calls — events + assignments)
  const events = await deps.canvasApi.getCalendarEvents(
    token,
    courseIds,
    // .slice(0, 10) converts full ISO datetime to just the date part (YYYY-MM-DD)
    args.start_date ?? now.toISOString().slice(0, 10),
    args.end_date ?? defaultEnd.toISOString().slice(0, 10),
  );

  // Step 5: Map Canvas events to the LLM-friendly output shape
  return events.map((e) => {
    // Canvas context_code format is "course_12345" — extract just the numeric course ID
    const courseMatch = /^course_(\d+)$/.exec(e.context_code);
    return {
      eventId: String(e.id),
      title: e.title,
      startAt: e.start_at,
      endAt: e.end_at,
      descriptionPreview: stripHtml(e.description ?? ''),
      url: e.html_url,
      // courseMatch[1] is the captured group (the digits after "course_")
      courseId: courseMatch ? courseMatch[1] : null,
      eventType: e.type,
    };
  });
}

export const getCalendarTool: Tool<typeof parameters> = {
  name: 'get_calendar',
  description:
    'Retrieve upcoming calendar events and assignment deadlines from Canvas LMS. Call when a student asks about their schedule, upcoming events, or what is due this week. Returns event titles, start and end times, and associated course. Default range is 30 days from today.',
  parameters,
  handle,
};
