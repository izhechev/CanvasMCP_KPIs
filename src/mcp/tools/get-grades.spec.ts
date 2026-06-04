import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getGradesTool } from './get-grades';

// Mocks: canvasApi (getCourses, getSubmissions), tokenService (resolveToken)
describe('getGradesTool', () => {
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
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.CANVAS_TEST_TOKEN;
  });

  it('accepts empty parameters', () => {
    expect(() => getGradesTool.parameters.parse({})).not.toThrow();
  });

  it('maps Canvas enrollments to grade results', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      {
        id: 101,
        name: 'Math',
        course_code: 'M101',
        enrollments: [
          {
            computed_current_score: 85,
            computed_current_grade: 'B',
          },
        ],
      },
    ]);

    const result = await getGradesTool.handle(deps, {});

    expect(result).toEqual([
      {
        courseName: 'Math',
        courseCode: 'M101',
        currentScore: 85,
        currentGrade: 'B',
        assignments: [],
      },
    ]);
  });

  it('falls back to course id when course metadata is missing', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 42, name: 'Course 42', course_code: '42' },
    ]);

    const result = await getGradesTool.handle(deps, {});
    expect(result[0]).toMatchObject({
      courseName: 'Course 42',
      courseCode: '42',
    });
  });

  it('result is JSON-serializable', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([]);
    const result = await getGradesTool.handle(deps, {});
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('filters to the specified course_id', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Math', course_code: 'M101' },
      { id: 102, name: 'Science', course_code: 'S102' },
    ]);
    const result = await getGradesTool.handle(deps, { course_id: '101' });
    expect(result).toHaveLength(1);
    expect(result[0].courseName).toBe('Math');
  });

  it('maps assignment submissions with rubric scores', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Math', course_code: 'M101' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([
      {
        assignment_id: 1,
        submitted_at: '2026-04-01',
        score: 9,
        grade: 'A',
        workflow_state: 'graded',
        assignment: {
          name: 'Essay',
          rubric: [
            {
              id: 'c1',
              description: 'Clarity',
              ratings: [{ points: 5, description: 'Excellent' }],
            },
          ],
        },
        rubric_assessment: { c1: { points: 5 } },
      },
    ]);

    const result = await getGradesTool.handle(deps, {});
    expect(result[0].assignments).toHaveLength(1);
    expect(result[0].assignments[0]).toMatchObject({
      name: 'Essay',
      score: 9,
      grade: 'A',
      status: 'graded',
    });
    expect(result[0].assignments[0].rubric).toEqual([
      { criterion: 'Clarity', rating: 'Excellent', points: 5 },
    ]);
  });

  it('sets rubric to null when no rubric_assessment', async () => {
    (canvasApi.getCourses as jest.Mock).mockResolvedValue([
      { id: 101, name: 'Math', course_code: 'M101' },
    ]);
    (canvasApi.getSubmissions as jest.Mock).mockResolvedValue([
      {
        assignment_id: 1,
        submitted_at: '2026-04-01',
        score: 7,
        grade: 'B',
        assignment: { name: 'Quiz', rubric: [] },
        rubric_assessment: null,
      },
    ]);

    const result = await getGradesTool.handle(deps, {});
    expect(result[0].assignments[0].rubric).toBeNull();
  });

  it('propagates Canvas API errors', async () => {
    (canvasApi.getCourses as jest.Mock).mockRejectedValue(
      new Error('Canvas rate limit (HTTP 429)'),
    );
    await expect(getGradesTool.handle(deps, {})).rejects.toThrow(
      'Canvas rate limit',
    );
  });
});
