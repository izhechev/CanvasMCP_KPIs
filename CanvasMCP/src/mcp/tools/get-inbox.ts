import { z } from 'zod';
import { Tool, ToolDeps } from '../tool';
import { stripHtml } from '../../common/strip-html';

// InboxMessage represents a single message within a conversation thread.
export interface InboxMessage {
  // Message body with HTML stripped — plain text only, safe for the LLM to read
  body: string;
  createdAt: string;
}

// InboxResult represents one conversation (which may contain multiple messages).
// Deliberately limited fields: student inbox may contain personal content.
// The LLM only needs enough to answer "do I have unread messages?" — not the full thread.
export interface InboxResult {
  conversationId: string;
  subject: string;
  messages: InboxMessage[];
  lastMessageAt: string;
  // 1 if the conversation is unread, 0 if read — simple flag for the LLM
  unreadCount: number;
  // First participant name — typically the teacher or sender
  senderName: string;
  // Which course this conversation belongs to, if any (Canvas inbox can be course-scoped)
  courseName: string | null;
}

const parameters = z.object({});

async function handle(deps: ToolDeps): Promise<InboxResult[]> {
  // Step 1: Get the student's Canvas access token
  const token = await deps.tokenService.resolveToken(deps.studentId);

  // Step 2: Get all conversations (inbox + sent, deduplicated, all pages)
  const conversations = await deps.canvasApi.getConversations(token);

  // Step 3: For each conversation, fetch the full message thread in parallel.
  // .catch(() => null) means if one conversation's detail fetch fails,
  // we fall back to the preview from the conversation list (step 4 handles this).
  const details = await Promise.all(
    conversations.map((c) =>
      deps.canvasApi.getConversationMessages(token, c.id).catch(() => null),
    ),
  );

  // Step 4: Map each conversation + its detail into an InboxResult
  return conversations.map((c, i) => {
    const detail = details[i];

    // Build the message list from the full thread if available,
    // otherwise fall back to the last_message preview from the conversation list
    const messages: InboxMessage[] = detail?.messages.length
      ? [...detail.messages]
          // Sort messages oldest-first so the conversation reads chronologically
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          )
          // stripHtml removes HTML markup from Canvas message bodies before giving them to the LLM
          .map((m) => ({ body: stripHtml(m.body), createdAt: m.created_at }))
      : [{ body: stripHtml(c.last_message), createdAt: c.last_message_at }];

    return {
      conversationId: String(c.id),
      subject: c.subject,
      messages,
      lastMessageAt: c.last_message_at,
      // Canvas workflow_state is 'unread' for unread conversations, 'read' for seen ones
      unreadCount: c.workflow_state === 'unread' ? 1 : 0,
      // participants[0] is typically the other party in the conversation
      senderName: c.participants[0]?.name ?? 'Unknown',
      // context_name is the course name if the conversation is course-scoped, null otherwise
      courseName: c.context_name ?? null,
    };
  });
}

export const getInboxTool: Tool<typeof parameters> = {
  name: 'get_inbox',
  description:
    'Retrieve Canvas inbox conversations and messages. Call when a student asks about messages, inbox, or whether a teacher has replied. Returns subjects, sender names, and the full history of messages in each conversation.',
  parameters,
  handle,
};
