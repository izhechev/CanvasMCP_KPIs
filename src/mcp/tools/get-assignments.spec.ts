import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getAssignmentsTool } from './get-assignments';

// Mocks: canvasApi (getCourses, getAssignments), tokenService (resolveToken)
describe('getAssignmentsTool', () => {
  const canvasApi = {
    getCourses: jest.fn(),
    getAssignments: jest.fn(),
  } as unknown as CanvasService;
  const tokenService = {
    resolveToken: jest.fn().mockResolvedValue('token'),
  } as unknown as TokenService;
  const deps = { canvasApi, tokenService, studentId: 'test-student' };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CANVAS_TEST_TOKEN = 'token';
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Math' },
    ]);
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('accepts empty parameters', () => {
    expect(() => getAssignmentsTool.parameters.parse({})).not.toThrow();
  });

  it('strips HTML and truncates description preview to 200 chars', async () => {
    const longHtml = '<p>' + 'word '.repeat(60) + '</p>';
    (canvasApi.getAssignments as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'A',
        due_at: null,
        points_possible: 10,
        submission_types: ['online_text_entry'],
        description: longHtml,
      },
    ]);

    const result = await getAssignmentsTool.handle(deps, {
      course_id: '101',
    });
    expect(result[0].descriptionPreview.length).toBeLessThanOrEqual(200);
    expect(result[0].descriptionPreview).not.toContain('<p>');
    expect(result[0].courseName).toBe('Math');
  });

  it('filters by due_after when provided', async () => {
    (canvasApi.getAssignments as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'old',
        due_at: '2026-01-01T00:00:00Z',
        points_possible: 10,
        submission_types: [],
        description: '',
      },
      {
        id: 2,
        name: 'new',
        due_at: '2026-06-01T00:00:00Z',
        points_possible: 10,
        submission_types: [],
        description: '',
      },
    ]);

    const result = await getAssignmentsTool.handle(deps, {
      course_id: '101',
      due_after: '2026-03-01T00:00:00Z',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('new');
  });

  it('drops assignments with null due_at when filtering by due_after', async () => {
    (canvasApi.getAssignments as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'no-due',
        due_at: null,
        points_possible: 10,
        submission_types: [],
        description: '',
      },
    ]);

    const result = await getAssignmentsTool.handle(deps, {
      course_id: '101',
      due_after: '2026-01-01T00:00:00Z',
    });
    expect(result).toHaveLength(0);
  });

  it('fetches across all courses if course_id is omitted', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Math' },
      { id: 102, name: 'Science' },
    ]);
    (canvasApi.getAssignments as jest.Mock).mockImplementation((_token, id) => {
      if (id === '101') return Promise.resolve([{ id: 1, name: 'M1' }]);
      if (id === '102') return Promise.resolve([{ id: 2, name: 'S1' }]);
      return Promise.resolve([]);
    });

    const result = await getAssignmentsTool.handle(deps, {});
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.courseName)).toContain('Math');
    expect(result.map((r) => r.courseName)).toContain('Science');
  });

  it('propagates Canvas API errors', async () => {
    (canvasApi.getAssignments as jest.Mock).mockRejectedValue(
      new Error('Canvas auth error (HTTP 403)'),
    );
    await expect(
      getAssignmentsTool.handle(deps, {
        course_id: '101',
      }),
    ).rejects.toThrow('Canvas auth error');
  });
});
