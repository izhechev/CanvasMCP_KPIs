import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getAnnouncementsTool } from './get-announcements';

// Mocks: canvasApi (getCourses, getAnnouncements), tokenService (resolveToken)
describe('getAnnouncementsTool', () => {
  const canvasApi = {
    getCourses: jest.fn(),
    getAnnouncements: jest.fn(),
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
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('uses provided course_id without listing courses', async () => {
    canvasApi.getAnnouncements.mockResolvedValue([]);
    await getAnnouncementsTool.handle(deps, {
      course_id: '101',
    });
    expect(canvasApi.getCourses).not.toHaveBeenCalled();
    expect(canvasApi.getAnnouncements).toHaveBeenCalledWith(
      'token',
      [{ id: '101', name: 'Course 101' }],
      20,
    );
  });

  it('lists courses when course_id is absent', async () => {
    canvasApi.getCourses.mockResolvedValue([
      { id: 1, name: 'Course 1' },
      { id: 2, name: 'Course 2' },
    ]);
    canvasApi.getAnnouncements.mockResolvedValue([]);

    await getAnnouncementsTool.handle(deps, {});
    expect(canvasApi.getAnnouncements).toHaveBeenCalledWith(
      'token',
      [
        { id: '1', name: 'Course 1' },
        { id: '2', name: 'Course 2' },
      ],
      20,
    );
  });

  it('honours count override', async () => {
    canvasApi.getCourses.mockResolvedValue([{ id: 1, name: 'Course 1' }]);
    canvasApi.getAnnouncements.mockResolvedValue([]);
    await getAnnouncementsTool.handle(deps, { count: 10 });
    expect(canvasApi.getAnnouncements).toHaveBeenCalledWith(
      'token',
      [{ id: '1', name: 'Course 1' }],
      10,
    );
  });

  it('maps announcements with stripped content preview', async () => {
    canvasApi.getAnnouncements.mockResolvedValue([
      {
        id: 1,
        title: 'Hi',
        posted_at: '2026-04-01',
        author: { display_name: 'Alice' },
        message: '<p>Hello <b>world</b></p>',
        html_url: 'http://x',
        course_name: 'Math',
      },
    ]);

    const result = await getAnnouncementsTool.handle(deps, {
      course_id: '101',
    });
    expect(result[0]).toEqual({
      title: 'Hi',
      postedAt: '2026-04-01',
      authorName: 'Alice',
      contentPreview: 'Hello world',
      url: 'http://x',
      courseName: 'Math',
    });
  });

  it('falls back to "Unknown" when author is null', async () => {
    canvasApi.getAnnouncements.mockResolvedValue([
      {
        id: 1,
        title: 'Hi',
        posted_at: '2026-04-01',
        author: null,
        message: '',
        html_url: '',
        course_name: 'Math',
      },
    ]);
    const result = await getAnnouncementsTool.handle(deps, {
      course_id: '101',
    });
    expect(result[0].authorName).toBe('Unknown');
  });
});
