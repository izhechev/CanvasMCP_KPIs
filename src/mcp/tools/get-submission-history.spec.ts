import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getSubmissionHistoryTool } from './get-submission-history';

// Mocks: canvasApi (getCourses, getSubmissions), tokenService (resolveToken)
describe('getSubmissionHistoryTool', () => {
  const canvasApi = {
    getCourses: jest.fn(),
    getSubmissions: jest.fn(),
  } as unknown as CanvasService;
  const tokenService = {
    resolveToken: jest.fn().mockResolvedValue('token'),
  } as unknown as TokenService;
  const deps = { canvasApi, tokenService, studentId: 'test-student' };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CANVAS_TEST_TOKEN = 'token';
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('aggregates submissions across all courses', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Math' },
      { id: 2, name: 'Science' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockImplementation(
      (_t: string, courseId: string) =>
        Promise.resolve([
          {
            assignment_id: Number(courseId) * 10,
            assignment: { name: 'A' },
            submitted_at: '2026-04-01',
            score: 8,
            grade: 'B',
            workflow_state: 'submitted',
          },
        ]),
    );

    const result = await getSubmissionHistoryTool.handle(deps, {});
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.courseName).sort()).toEqual(['Math', 'Science']);
  });

  it('filters by since when provided', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Math' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([
      {
        assignment_id: 1,
        submitted_at: '2026-01-01',
        score: 1,
        grade: 'F',
      },
      {
        assignment_id: 2,
        submitted_at: '2026-06-01',
        score: 9,
        grade: 'A',
      },
    ]);

    const result = await getSubmissionHistoryTool.handle(deps, {
      since: '2026-03-01',
    });
    expect(result).toHaveLength(1);
    expect(result[0].assignmentId).toBe('2');
  });

  it('drops unsubmitted entries', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Math' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([
      { assignment_id: 1, submitted_at: null, score: null, grade: null },
    ]);

    const result = await getSubmissionHistoryTool.handle(deps, {});
    expect(result).toHaveLength(0);
  });

  it('defaults workflow_state to "submitted" when missing', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Math' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([
      {
        assignment_id: 1,
        submitted_at: '2026-04-01',
        score: 9,
        grade: 'A',
      },
    ]);
    const result = await getSubmissionHistoryTool.handle(deps, {});
    expect(result[0].workflowState).toBe('submitted');
  });
});
