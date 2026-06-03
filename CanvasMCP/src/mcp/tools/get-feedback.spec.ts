import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getFeedbackTool } from './get-feedback';

// Mocks: canvasApi (getCourses, getSubmissions), tokenService (resolveToken)
describe('getFeedbackTool', () => {
  const canvasApi = {
    getCourses: jest.fn(),
    getSubmissions: jest.fn(),
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
    canvasApi.getCourses.mockResolvedValue([{ id: 101, name: 'Math' }]);
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('queries a single course when course_id is set', async () => {
    canvasApi.getSubmissions.mockResolvedValue([]);
    await getFeedbackTool.handle(deps, {
      course_id: '101',
    });
    expect(canvasApi.getCourses).toHaveBeenCalled();
    expect(canvasApi.getSubmissions).toHaveBeenCalledWith('token', '101');
  });

  it('aggregates across all courses when course_id is omitted', async () => {
    canvasApi.getCourses.mockResolvedValue([
      { id: 1, name: 'C1' },
      { id: 2, name: 'C2' },
    ]);
    canvasApi.getSubmissions.mockResolvedValue([]);

    await getFeedbackTool.handle(deps, {});
    expect(canvasApi.getSubmissions).toHaveBeenCalledTimes(2);
  });

  it('filters by assignment_id when provided', async () => {
    canvasApi.getCourses.mockResolvedValue([{ id: 101, name: 'Math' }]);
    canvasApi.getSubmissions.mockResolvedValue([
      {
        assignment_id: 100,
        submitted_at: '2026-04-01',
        score: 8,
        grade: 'A',
      },
      {
        assignment_id: 200,
        submitted_at: '2026-04-02',
        score: 7,
        grade: 'B',
      },
    ]);

    const result = await getFeedbackTool.handle(deps, {
      course_id: '101',
      assignment_id: '100',
    });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(8);
  });

  it('drops unsubmitted submissions', async () => {
    canvasApi.getCourses.mockResolvedValue([{ id: 101, name: 'Math' }]);
    canvasApi.getSubmissions.mockResolvedValue([
      { assignment_id: 1, submitted_at: null, score: null, grade: null },
      {
        assignment_id: 2,
        submitted_at: '2026-04-01',
        score: 9,
        grade: 'A',
      },
    ]);
    const result = await getFeedbackTool.handle(deps, {
      course_id: '101',
    });
    expect(result).toHaveLength(1);
  });

  it('maps comments and rubric criteria', async () => {
    canvasApi.getCourses.mockResolvedValue([{ id: 101, name: 'Math' }]);
    canvasApi.getSubmissions.mockResolvedValue([
      {
        assignment_id: 1,
        assignment: { name: 'Essay' },
        submitted_at: '2026-04-01',
        score: 9,
        grade: 'A',
        submission_comments: [{ comment: 'Nice', author_name: 'Teacher' }],
        rubric_assessment: {
          c1: { points: 5, description: 'Clarity' },
          c2: { points: 4 },
        },
      },
    ]);
    const result = await getFeedbackTool.handle(deps, {
      course_id: '101',
    });
    expect(result[0].teacherComments).toEqual(['Teacher: Nice']);
    expect(result[0].rubric).toEqual([
      { criterion: 'Clarity', points: 5 },
      { criterion: '', points: 4 },
    ]);
  });
});
