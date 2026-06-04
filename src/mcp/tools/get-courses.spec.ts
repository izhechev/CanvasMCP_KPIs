import { CanvasService } from '../../canvas/canvas.service';
import { TokenService } from '../../token/token.service';
import { getCoursesTool } from './get-courses';

// Mocks: canvasApi (getCourses), tokenService (resolveToken)
describe('getCoursesTool', () => {
  const canvasApi = { getCourses: jest.fn() };
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

  it('accepts empty parameters', () => {
    expect(() => getCoursesTool.parameters.parse({})).not.toThrow();
  });

  it('maps Canvas courses to course results with default enrollment type', async () => {
    canvasApi.getCourses.mockResolvedValue([
      {
        id: 101,
        name: 'Algebra',
        course_code: 'M101',
        start_at: '2026-01-01',
        end_at: null,
      },
    ]);

    const result = await getCoursesTool.handle(deps, {});
    expect(result).toEqual([
      {
        courseId: '101',
        name: 'Algebra',
        courseCode: 'M101',
        enrollmentType: 'student',
        startAt: '2026-01-01',
        endAt: null,
      },
    ]);
  });

  it('uses first enrollment type when present', async () => {
    canvasApi.getCourses.mockResolvedValue([
      {
        id: 1,
        name: 'X',
        course_code: 'X1',
        enrollments: [{ type: 'teacher' }],
        start_at: null,
        end_at: null,
      },
    ]);
    const result = await getCoursesTool.handle(deps, {});
    expect(result[0].enrollmentType).toBe('teacher');
  });

  it('forwards enrollment_state to Canvas API', async () => {
    canvasApi.getCourses.mockResolvedValue([]);
    await getCoursesTool.handle(deps, {
      enrollment_state: 'completed',
    });
    expect(canvasApi.getCourses).toHaveBeenCalledWith('token', 'completed');
  });

  it('propagates Canvas API errors', async () => {
    canvasApi.getCourses.mockRejectedValue(new Error('Canvas auth error'));
    await expect(getCoursesTool.handle(deps, {})).rejects.toThrow(
      'Canvas auth error',
    );
  });
});
