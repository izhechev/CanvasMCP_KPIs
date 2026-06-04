import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getInboxTool } from './get-inbox';

// Mocks: canvasApi (getConversations, getConversationMessages), tokenService (resolveToken)
describe('getInboxTool', () => {
  const canvasApi = {
    getConversations: jest.fn(),
    getConversationMessages: jest.fn(),
  } as unknown as CanvasService;
  const tokenService = {
    resolveToken: jest.fn().mockResolvedValue('token'),
  } as unknown as TokenService;
  const deps = { canvasApi, tokenService, studentId: 'test-student' };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CANVAS_TEST_TOKEN = 'token';
    // Default mock for getConversationMessages to avoid "not a function" errors
    (canvasApi.getConversationMessages as jest.Mock).mockResolvedValue({
      messages: [],
    });
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('returns messages from the conversation', async () => {
    (canvasApi.getConversations as jest.Mock).mockResolvedValue([
      {
        id: 1,
        subject: 'S',
        last_message: 'initial',
        last_message_at: '2026-04-01',
        message_count: 1,
        workflow_state: 'unread',
        context_name: 'Math',
        participants: [{ name: 'Alice' }],
      },
    ]);
    (canvasApi.getConversationMessages as jest.Mock).mockResolvedValue({
      messages: [{ body: 'Hello', created_at: '2026-04-01T10:00:00Z' }],
    });

    const result = await getInboxTool.handle(deps, {});
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].body).toBe('Hello');
  });

  it('marks unread conversations with unreadCount=1', async () => {
    (canvasApi.getConversations as jest.Mock).mockResolvedValue([
      {
        id: 1,
        subject: 'S',
        last_message: 'm',
        last_message_at: '2026-04-01',
        message_count: 1,
        workflow_state: 'unread',
        context_name: 'X',
        participants: [{ name: 'A' }],
      },
      {
        id: 2,
        subject: 'S2',
        last_message: 'm',
        last_message_at: '2026-04-01',
        message_count: 1,
        workflow_state: 'read',
        context_name: 'X',
        participants: [{ name: 'A' }],
      },
    ]);
    const result = await getInboxTool.handle(deps, {});
    expect(result.map((r) => r.unreadCount)).toEqual([1, 0]);
  });

  it('falls back to "Unknown" when no participants', async () => {
    (canvasApi.getConversations as jest.Mock).mockResolvedValue([
      {
        id: 1,
        subject: 'S',
        last_message: 'm',
        last_message_at: '2026-04-01',
        message_count: 1,
        workflow_state: 'read',
        context_name: 'X',
        participants: [],
      },
    ]);
    const result = await getInboxTool.handle(deps, {});
    expect(result[0].senderName).toBe('Unknown');
  });
});
