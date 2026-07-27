import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GRADE_SCALE,
  resolveLetterGrade,
  summarizeCourseGrades,
  summarizeGradeCategory,
  summarizeGradeTracker,
} from '@/lib/grades';

describe('resolveLetterGrade', () => {
  it('falls back to the default scale when no custom entries exist', () => {
    expect(resolveLetterGrade(95, [])).toMatchObject({
      label: 'A+',
      gpaPoints: 4.0,
    });
    expect(resolveLetterGrade(82, [])).toMatchObject({
      label: 'B',
      gpaPoints: 3.0,
    });
    expect(resolveLetterGrade(59.5, [])).toMatchObject({
      label: 'F',
      gpaPoints: 0,
    });
  });

  it('returns null for missing or invalid percentages', () => {
    expect(resolveLetterGrade(null, DEFAULT_GRADE_SCALE.slice())).toBeNull();
    expect(
      resolveLetterGrade(Number.NaN, DEFAULT_GRADE_SCALE.slice())
    ).toBeNull();
  });
});

describe('summarizeGradeCategory', () => {
  it('computes earned points, percent, and weighted contribution', () => {
    const summary = summarizeGradeCategory({
      id: 'cat_hw',
      name: 'Homework',
      weight: 25,
      items: [
        {
          id: 'item_1',
          title: 'HW 1',
          scoreEarned: 18,
          scorePossible: 20,
          assignmentId: null,
          gradedAt: '2026-07-25T10:00:00.000Z',
          notes: null,
        },
        {
          id: 'item_2',
          title: 'HW 2',
          scoreEarned: 45,
          scorePossible: 50,
          assignmentId: null,
          gradedAt: '2026-07-25T10:00:00.000Z',
          notes: null,
        },
      ],
    });

    expect(summary).toMatchObject({
      itemCount: 2,
      earned: 63,
      possible: 70,
      percent: 90,
      weightedContribution: 22.5,
    });
  });

  it('returns null percent and zero contribution when nothing is graded yet', () => {
    expect(
      summarizeGradeCategory({
        id: 'cat_empty',
        name: 'Quizzes',
        weight: 40,
        items: [],
      })
    ).toMatchObject({
      itemCount: 0,
      earned: 0,
      possible: 0,
      percent: null,
      weightedContribution: 0,
    });
  });
});

describe('summarizeCourseGrades', () => {
  it('computes the weighted current percent from graded categories only', () => {
    const summary = summarizeCourseGrades(
      {
        id: 'course_1',
        name: 'CSE 115A',
        credits: 5,
        gradeCategories: [
          {
            id: 'cat_hw',
            name: 'Homework',
            weight: 40,
            items: [
              {
                id: 'hw_1',
                title: 'HW 1',
                scoreEarned: 18,
                scorePossible: 20,
                assignmentId: null,
                gradedAt: '2026-07-25T10:00:00.000Z',
                notes: null,
              },
            ],
          },
          {
            id: 'cat_quiz',
            name: 'Quizzes',
            weight: 60,
            items: [
              {
                id: 'quiz_1',
                title: 'Quiz 1',
                scoreEarned: 45,
                scorePossible: 50,
                assignmentId: null,
                gradedAt: '2026-07-25T10:00:00.000Z',
                notes: null,
              },
            ],
          },
        ],
      },
      DEFAULT_GRADE_SCALE.slice()
    );

    expect(summary.gradedWeight).toBe(100);
    expect(summary.weightedPoints).toBeCloseTo(90, 5);
    expect(summary.currentPercent).toBeCloseTo(90, 5);
    expect(summary.remainingWeight).toBe(0);
    expect(summary.letterGrade).toMatchObject({
      label: 'A',
      gpaPoints: 4.0,
    });
    expect(summary.currentGpaPoints).toBe(4.0);
  });

  it('ignores ungraded categories until they have scores', () => {
    const summary = summarizeCourseGrades(
      {
        id: 'course_2',
        name: 'MATH 19B',
        credits: 5,
        gradeCategories: [
          {
            id: 'cat_midterm',
            name: 'Midterm',
            weight: 30,
            items: [],
          },
          {
            id: 'cat_final',
            name: 'Final',
            weight: 70,
            items: [
              {
                id: 'final_1',
                title: 'Final',
                scoreEarned: 64,
                scorePossible: 80,
                assignmentId: null,
                gradedAt: '2026-07-25T10:00:00.000Z',
                notes: null,
              },
            ],
          },
        ],
      },
      DEFAULT_GRADE_SCALE.slice()
    );

    expect(summary.gradedWeight).toBe(70);
    expect(summary.weightedPoints).toBeCloseTo(56, 5);
    expect(summary.currentPercent).toBeCloseTo(80, 5);
    expect(summary.remainingWeight).toBe(0);
    expect(summary.letterGrade?.label).toBe('B');
  });
});

describe('summarizeGradeTracker', () => {
  it('projects cumulative GPA from the baseline GPA and current term quality points', () => {
    const tracker = summarizeGradeTracker({
      currentGpa: 3.5,
      completedCredits: 40,
      scaleEntries: DEFAULT_GRADE_SCALE.slice(),
      courses: [
        {
          id: 'course_1',
          name: 'CSE 115A',
          credits: 5,
          gradeCategories: [
            {
              id: 'cat_project',
              name: 'Project',
              weight: 100,
              items: [
                {
                  id: 'project_1',
                  title: 'Sprint Project',
                  scoreEarned: 94,
                  scorePossible: 100,
                  assignmentId: null,
                  gradedAt: '2026-07-25T10:00:00.000Z',
                  notes: null,
                },
              ],
            },
          ],
        },
        {
          id: 'course_2',
          name: 'CSE 120',
          credits: 5,
          gradeCategories: [
            {
              id: 'cat_exam',
              name: 'Exam',
              weight: 100,
              items: [
                {
                  id: 'exam_1',
                  title: 'Midterm',
                  scoreEarned: 84,
                  scorePossible: 100,
                  assignmentId: null,
                  gradedAt: '2026-07-25T10:00:00.000Z',
                  notes: null,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(tracker.summary.currentTermCredits).toBe(10);
    expect(tracker.summary.termGpa).toBeCloseTo(3.65, 2);
    expect(tracker.summary.projectedCumulativeGpa).toBeCloseTo(3.53, 2);
  });

  it('uses the term GPA directly when there is no baseline GPA yet', () => {
    const tracker = summarizeGradeTracker({
      currentGpa: null,
      completedCredits: 0,
      scaleEntries: DEFAULT_GRADE_SCALE.slice(),
      courses: [
        {
          id: 'course_1',
          name: 'Writing',
          credits: 4,
          gradeCategories: [
            {
              id: 'cat_essays',
              name: 'Essays',
              weight: 100,
              items: [
                {
                  id: 'essay_1',
                  title: 'Essay',
                  scoreEarned: 72,
                  scorePossible: 100,
                  assignmentId: null,
                  gradedAt: '2026-07-25T10:00:00.000Z',
                  notes: null,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(tracker.summary.termGpa).toBeCloseTo(2.0, 5);
    expect(tracker.summary.projectedCumulativeGpa).toBeCloseTo(2.0, 5);
  });
});
