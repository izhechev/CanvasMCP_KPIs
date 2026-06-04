import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getCalendarTool } from './get-calendar';

// Mocks: canvasApi (getCalendarEvents, getCourses), tokenService (resolveToken)
describe('getCalendarTool', () => {
  const canvasApi = {
    getCalendarEvents: jest.fn(),
    getCourses: jest.fn(),
  };
  const tokenService = {
    resolveToken: jest.fn().mockResolvedValue('token'),
  } as unknown as TokenService;
  const deps = {
    canvasApi: canvasApi as unknown as CanvasService,
    tokenService,
    studentId: 'test-student',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CANVAS_TEST_TOKEN = 'token';
    canvasApi.getCourses.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('forwards date range params', async () => {
    canvasApi.getCourses.mockResolvedValue([{ id: 101 }]);
    canvasApi.getCalendarEvents.mockResolvedValue([]);
    await getCalendarTool.handle(deps, {
      start_date: '2026-04-01',
      end_date: '2026-05-01',
    });
    expect(canvasApi.getCalendarEvents).toHaveBeenCalledWith(
      'token',
      ['101'],
      '2026-04-01',
      '2026-05-01',
    );
  });

  it('extracts course id from context_code', async () => {
    canvasApi.getCalendarEvents.mockResolvedValue([
      {
        id: 1,
        title: 'Lecture',
        start_at: '2026-04-01',
        end_at: '2026-04-01',
        description: '<p>x</p>',
        html_url: 'http://x',
        context_code: 'course_42',
        type: 'event',
      },
    ]);
    const result = await getCalendarTool.handle(deps, {});
    expect(result[0].courseId).toBe('42');
    expect(result[0].descriptionPreview).toBe('x');
  });

  it('returns null courseId when context is not a course', async () => {
    canvasApi.getCalendarEvents.mockResolvedValue([
      {
        id: 1,
        title: 'X',
        start_at: '2026-04-01',
        end_at: null,
        description: null,
        html_url: '',
        context_code: 'user_99',
        type: 'event',
      },
    ]);
    const result = await getCalendarTool.handle(deps, {});
    expect(result[0].courseId).toBeNull();
  });
});
