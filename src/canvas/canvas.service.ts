import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanvasAuthError, CanvasRateLimitError } from '../common/errors';
import { fetchAllPages, fetchJson, HttpError } from '../common/http.util';
import {
  CanvasAnnouncement,
  CanvasAssignment,
  CanvasCalendarEvent,
  CanvasConversation,
  CanvasConversationDetail,
  CanvasCourse,
  CanvasEnrollment,
  CanvasSubmission,
} from './interfaces/canvas-api.interface';

export type { CanvasSubmission };

// CanvasService is the single anti-corruption layer between this application and the Canvas LMS API.
// Every Canvas HTTP call goes through this service — no other class calls Canvas directly.
// This means Canvas-specific quirks (required User-Agent header, error code mappings,
// pagination format) are handled in one place and never leak into the rest of the codebase.
@Injectable()
export class CanvasService {
  private readonly logger = new Logger(CanvasService.name);
  // baseUrl defaults to the Fontys Canvas instance; can be overridden via CANVAS_BASE_URL env var
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>(
      'CANVAS_BASE_URL',
      'https://fhict.instructure.com',
    );
  }

  // getEnrollments returns all courses the student is enrolled in, with grade data.
  // include[]=current_points adds live score data to each enrollment object.
  // courseId is optional — if provided, only returns the enrollment for that course.
  async getEnrollments(
    accessToken: string,
    courseId?: string,
  ): Promise<CanvasEnrollment[]> {
    const url = new URL(`${this.baseUrl}/api/v1/users/self/enrollments`);
    url.searchParams.append('include[]', 'current_points');
    url.searchParams.set('per_page', '100');
    if (courseId) url.searchParams.set('course_id', courseId);

    return this.get<CanvasEnrollment[]>(url.toString(), accessToken);
  }

  // getCourses returns all courses the student is actively enrolled in.
  // include[]=enrollments adds grade type and role; include[]=total_scores adds current score/grade.
  // enrollmentState defaults to 'active' — excludes past and future courses.
  async getCourses(
    accessToken: string,
    enrollmentState = 'active',
  ): Promise<CanvasCourse[]> {
    const url = new URL(`${this.baseUrl}/api/v1/courses`);
    url.searchParams.set('enrollment_state', enrollmentState);
    url.searchParams.append('include[]', 'enrollments');
    url.searchParams.append('include[]', 'total_scores');
    url.searchParams.set('per_page', '100');

    return this.get<CanvasCourse[]>(url.toString(), accessToken);
  }

  // getAssignments returns all assignments for a specific course.
  // Used by the get_assignments tool to show the student what is due.
  async getAssignments(
    accessToken: string,
    courseId: string,
  ): Promise<CanvasAssignment[]> {
    const url = new URL(
      `${this.baseUrl}/api/v1/courses/${courseId}/assignments`,
    );
    url.searchParams.set('per_page', '100');

    return this.get<CanvasAssignment[]>(url.toString(), accessToken);
  }

  // getAnnouncements fetches announcements for multiple courses in parallel.
  // Promise.all runs all course requests simultaneously instead of one by one.
  // Each course's announcements are merged with the course name (Canvas does not include it by default).
  // Results from all courses are flattened, sorted newest-first, and limited to 'count' items.
  async getAnnouncements(
    accessToken: string,
    courses: Array<{ id: string; name: string }>,
    count = 20,
  ): Promise<Array<CanvasAnnouncement & { course_name: string }>> {
    const perCourse = await Promise.all(
      courses.map(({ id, name }) => {
        const url = new URL(
          `${this.baseUrl}/api/v1/courses/${id}/discussion_topics`,
        );
        // only_announcements=true filters out regular discussion topics
        url.searchParams.set('only_announcements', 'true');
        url.searchParams.set('order_by', 'recent_activity');
        url.searchParams.set('per_page', '100');
        return (
          this.get<CanvasAnnouncement[]>(url.toString(), accessToken)
            // Attach course_name to each announcement so the LLM knows which course it belongs to
            .then((announcements) =>
              announcements.map((a) => ({ ...a, course_name: name })),
            )
            // If one course fails (e.g. 403), return empty array rather than failing everything
            .catch(() => [])
        );
      }),
    );
    return (
      perCourse
        .flat()
        // Sort all announcements newest-first across all courses
        .sort(
          (a, b) =>
            new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
        )
        // Return only the most recent 'count' announcements
        .slice(0, count)
    );
  }

  // getSubmissions returns all assignment submissions for a student in a specific course.
  // include[]=submission_comments adds teacher feedback comments.
  // include[]=rubric_assessment adds rubric scores per criterion.
  // include[]=assignment adds the full assignment details (name, rubric definition) to each submission.
  async getSubmissions(
    accessToken: string,
    courseId: string,
  ): Promise<CanvasSubmission[]> {
    const url = new URL(
      `${this.baseUrl}/api/v1/courses/${courseId}/students/submissions`,
    );
    // student_ids[]=self means "only return submissions for the authenticated student"
    url.searchParams.append('student_ids[]', 'self');
    url.searchParams.append('include[]', 'submission_comments');
    url.searchParams.append('include[]', 'rubric_assessment');
    url.searchParams.append('include[]', 'assignment');
    url.searchParams.set('per_page', '100');

    return this.get<CanvasSubmission[]>(url.toString(), accessToken);
  }

  // getCalendarEvents fetches both calendar events AND assignment deadlines for given courses.
  // Canvas splits these into two separate endpoint calls (type=event and type=assignment).
  // Both are fetched in parallel with Promise.all and merged into one sorted list.
  async getCalendarEvents(
    accessToken: string,
    courseIds: string[],
    startDate?: string,
    endDate?: string,
  ): Promise<CanvasCalendarEvent[]> {
    // buildUrl creates the calendar URL for a specific type (event or assignment)
    const buildUrl = (type: 'event' | 'assignment') => {
      const url = new URL(`${this.baseUrl}/api/v1/calendar_events`);
      url.searchParams.set('type', type);
      url.searchParams.set('per_page', '100');
      if (startDate) url.searchParams.set('start_date', startDate);
      if (endDate) url.searchParams.set('end_date', endDate);
      // context_codes[] specifies which courses to fetch events for
      for (const id of courseIds) {
        url.searchParams.append('context_codes[]', `course_${id}`);
      }
      return url.toString();
    };

    // Fetch regular events and assignment deadlines simultaneously
    const [events, assignments] = await Promise.all([
      // .catch(() => []) means if one type fails, the other can still be returned
      this.get<CanvasCalendarEvent[]>(buildUrl('event'), accessToken).catch(
        () => [],
      ),
      this.get<CanvasCalendarEvent[]>(
        buildUrl('assignment'),
        accessToken,
      ).catch(() => []),
    ]);

    // Merge and sort everything chronologically by start date
    return [...events, ...assignments].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  }

  // getConversations fetches ALL inbox messages for the student across all conversations.
  // It fetches both the inbox (received) and sent scopes in parallel,
  // then deduplicates by conversation ID using a Set.
  // Uses fetchAllPages (not fetchJson) because conversations always paginate.
  async getConversations(accessToken: string): Promise<CanvasConversation[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const buildUrl = (scope?: string) => {
      const url = new URL(`${this.baseUrl}/api/v1/conversations`);
      url.searchParams.set('per_page', '50');
      // scope=sent fetches messages the student sent; no scope fetches the inbox
      if (scope) url.searchParams.set('scope', scope);
      this.logger.log(`GET ${url.toString()}`);
      return url.toString();
    };

    // Fetch inbox and sent folders simultaneously, following all pages for each
    const [inbox, sent] = await Promise.all([
      fetchAllPages<CanvasConversation>(buildUrl(), { headers }),
      fetchAllPages<CanvasConversation>(buildUrl('sent'), { headers }),
    ]);

    // Deduplicate: a conversation in both inbox and sent should only appear once
    const seen = new Set<number>();
    const results = [...inbox, ...sent].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    this.logger.log(
      `Canvas returned ${results.length} conversations (${inbox.length} inbox, ${sent.length} sent)`,
    );
    return results;
  }

  // getConversationMessages fetches the full message thread for a single conversation.
  // Called per conversation by the get_inbox tool to get message bodies.
  async getConversationMessages(
    accessToken: string,
    conversationId: number,
  ): Promise<CanvasConversationDetail> {
    const url = `${this.baseUrl}/api/v1/conversations/${conversationId}`;
    return this.get<CanvasConversationDetail>(url, accessToken);
  }

  // private get<T> is the shared HTTP method used by all public methods above.
  // It adds the required Authorization and User-Agent headers to every Canvas request.
  // It also maps Canvas error codes to typed domain errors:
  //   429 → CanvasRateLimitError (too many requests)
  //   403 → CanvasAuthError (token invalid or access denied)
  // Without this mapping, callers would receive generic HttpError and would not know
  // whether to retry (429) or re-authenticate (403).
  private async get<T>(url: string, accessToken: string): Promise<T> {
    // Normalize double slashes in paths (except after the protocol "https://")
    // to prevent Canvas returning 404 for malformed URLs
    const normalizedUrl = url.replace(/([^:]\/)\/+/g, '$1');
    this.logger.log(`GET ${normalizedUrl}`);

    try {
      return await fetchJson<T>(normalizedUrl, {
        headers: {
          // Bearer token: Canvas requires this to identify the authenticated student
          Authorization: `Bearer ${accessToken}`,
          // Canvas requires a User-Agent header or returns 401 for anonymous-looking requests
          'User-Agent':
            'CanvasMCP/1.0.0 (https://github.com/canvas-mcp/canvas-mcp)',
          Accept: 'application/json',
        },
      });
    } catch (err) {
      // Log extra detail for 401 errors to help debug token problems
      if (err instanceof HttpError && err.status === 401) {
        const maskedToken = accessToken
          ? `${accessToken.substring(0, 4)}... (length: ${accessToken.length})`
          : 'null/empty';
        this.logger.error(
          `Canvas 401 Unauthorized. URL: ${normalizedUrl}, BaseURL: ${this.baseUrl}, Token: ${maskedToken}`,
        );
      }
      // Map HTTP 429 to a typed domain error so callers can handle rate limiting
      if (err instanceof HttpError && err.status === 429) {
        throw new CanvasRateLimitError(err);
      }
      // Map HTTP 403 to CanvasAuthError — the student's token is invalid or they lost access
      if (err instanceof HttpError && err.status === 403) {
        throw new CanvasAuthError(err);
      }
      // For any other HTTP error, wrap it with more context before re-throwing
      if (err instanceof HttpError) {
        throw new Error(`Canvas API error: ${err.status} ${err.message}`, {
          cause: err,
        });
      }
      // Non-HTTP errors (network failure, DNS, etc.) propagate unchanged
      throw err;
    }
  }
}
