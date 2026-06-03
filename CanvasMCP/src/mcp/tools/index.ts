import { Tool } from '../tool';
import { getAnnouncementsTool } from './get-announcements';
import { getAssignmentsTool } from './get-assignments';
import { getCalendarTool } from './get-calendar';
import { getCoursesTool } from './get-courses';
import { getFeedbackTool } from './get-feedback';
import { getGradesTool } from './get-grades';
import { getInboxTool } from './get-inbox';
import { getSubmissionHistoryTool } from './get-submission-history';

export const TOOLS: readonly Tool[] = [
  getGradesTool,
  getCoursesTool,
  getAssignmentsTool,
  getAnnouncementsTool,
  getFeedbackTool,
  getSubmissionHistoryTool,
  getCalendarTool,
  getInboxTool,
];
