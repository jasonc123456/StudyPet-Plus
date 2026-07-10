'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type GradeScaleEntry = {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  gpaPoints: number;
};

type GradeItem = {
  id: string;
  title: string;
  assignmentId: string | null;
  scoreEarned: number;
  scorePossible: number;
  notes: string | null;
  gradedAt: string | Date;
};

type GradeCategory = {
  id: string;
  name: string;
  weight: number;
  summary: {
    itemCount: number;
    earned: number;
    possible: number;
    percent: number | null;
    weightedContribution: number;
  };
  items: GradeItem[];
};

type CourseData = {
  id: string;
  name: string;
  color: string;
  credits: number;
  assignments: {
    id: string;
    title: string;
    type: string;
    dueAt: string | Date | null;
  }[];
  summary: {
    categories: GradeCategory[];
    gradedWeight: number;
    totalWeight: number;
    remainingWeight: number;
    currentPercent: number | null;
    currentGpaPoints: number | null;
    letterGrade: { label: string; gpaPoints: number } | null;
  };
};

type GradeTrackerPageProps = {
  profile: {
    currentGpa: number | null;
    completedCredits: number;
  };
  scaleEntries: GradeScaleEntry[];
  hasCustomScale: boolean;
  courses: CourseData[];
  summary: {
    currentTermCredits: number;
    termGpa: number | null;
    projectedCumulativeGpa: number | null;
  };
};

function numberInputClass() {
  return 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
}

function formatPercent(value: number | null) {
  return value === null ? 'Not enough data' : `${value.toFixed(2)}%`;
}

function formatGpa(value: number | null) {
  return value === null ? '—' : value.toFixed(2);
}

function formatGradedDate(value: string | Date) {
  return new Date(value).toLocaleDateString();
}

export function GradeTrackerPage(props: GradeTrackerPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCourseId, setSelectedCourseId] = useState(
    props.courses[0]?.id ?? ''
  );
  const [error, setError] = useState<string | null>(null);

  const [currentGpa, setCurrentGpa] = useState(
    props.profile.currentGpa?.toString() ?? ''
  );
  const [completedCredits, setCompletedCredits] = useState(
    props.profile.completedCredits.toString()
  );
  const [scaleForm, setScaleForm] = useState({
    label: '',
    minPercent: '',
    maxPercent: '',
    gpaPoints: '',
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    weight: '',
  });
  const [creditsDraft, setCreditsDraft] = useState(
    props.courses[0]?.credits.toString() ?? '3'
  );
  const [itemForms, setItemForms] = useState<
    Record<
      string,
      {
        title: string;
        assignmentId: string;
        scoreEarned: string;
        scorePossible: string;
        gradedAt: string;
        notes: string;
      }
    >
  >({});

  const selectedCourse =
    props.courses.find((course) => course.id === selectedCourseId) ?? null;

  async function submitJson(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? 'Something went wrong');
    }
  }

  function runAction(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Something went wrong'
        );
      }
    });
  }

  function getItemForm(categoryId: string) {
    return (
      itemForms[categoryId] ?? {
        title: '',
        assignmentId: '',
        scoreEarned: '',
        scorePossible: '',
        gradedAt: '',
        notes: '',
      }
    );
  }

  function setItemForm(
    categoryId: string,
    updates: Partial<ReturnType<typeof getItemForm>>
  ) {
    setItemForms((current) => ({
      ...current,
      [categoryId]: {
        ...getItemForm(categoryId),
        ...updates,
      },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Current term GPA
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-brand-600">
            {formatGpa(props.summary.termGpa)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Projected total GPA
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-mint-600">
            {formatGpa(props.summary.projectedCumulativeGpa)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Term credits tracked
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            {props.summary.currentTermCredits.toFixed(0)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                GPA Baseline
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your current GPA and completed credits so we can project
                your cumulative GPA.
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  submitJson('/api/grade-profile', 'PATCH', {
                    currentGpa: currentGpa || null,
                    completedCredits,
                  })
                )
              }
              className="btn-primary"
            >
              Save GPA settings
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Current GPA
              </label>
              <input
                type="number"
                min="0"
                max="4.3"
                step="0.01"
                value={currentGpa}
                onChange={(e) => setCurrentGpa(e.target.value)}
                className={numberInputClass()}
                placeholder="e.g. 3.65"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Completed credits
              </label>
              <input
                type="number"
                min="0"
                max="400"
                step="0.5"
                value={completedCredits}
                onChange={(e) => setCompletedCredits(e.target.value)}
                className={numberInputClass()}
                placeholder="e.g. 60"
              />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              Letter Grade Scale
            </h2>
            <p className="text-sm text-slate-500">
              {props.hasCustomScale
                ? 'Your saved scale drives course letters and GPA points.'
                : 'You are currently using the starter scale. Add your own ranges below to replace it over time.'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="text"
              value={scaleForm.label}
              onChange={(e) =>
                setScaleForm((current) => ({
                  ...current,
                  label: e.target.value,
                }))
              }
              placeholder="A+"
              className={numberInputClass()}
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={scaleForm.minPercent}
              onChange={(e) =>
                setScaleForm((current) => ({
                  ...current,
                  minPercent: e.target.value,
                }))
              }
              placeholder="Min %"
              className={numberInputClass()}
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={scaleForm.maxPercent}
              onChange={(e) =>
                setScaleForm((current) => ({
                  ...current,
                  maxPercent: e.target.value,
                }))
              }
              placeholder="Max %"
              className={numberInputClass()}
            />
            <div className="flex gap-3">
              <input
                type="number"
                min="0"
                max="4.3"
                step="0.1"
                value={scaleForm.gpaPoints}
                onChange={(e) =>
                  setScaleForm((current) => ({
                    ...current,
                    gpaPoints: e.target.value,
                  }))
                }
                placeholder="GPA"
                className={numberInputClass()}
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await submitJson('/api/grade-scale', 'POST', scaleForm);
                    setScaleForm({
                      label: '',
                      minPercent: '',
                      maxPercent: '',
                      gpaPoints: '',
                    });
                  })
                }
                className="btn-primary whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-widest text-slate-400">
                  <th className="pb-2">Letter</th>
                  <th className="pb-2">Range</th>
                  <th className="pb-2">GPA</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.scaleEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50">
                    <td className="py-2 font-semibold text-slate-900">
                      {entry.label}
                    </td>
                    <td className="py-2 text-slate-500">
                      {entry.minPercent.toFixed(2)}% -{' '}
                      {entry.maxPercent.toFixed(2)}%
                    </td>
                    <td className="py-2 text-slate-500">
                      {entry.gpaPoints.toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      {entry.id.startsWith('default-') ? (
                        <span className="text-xs text-slate-400">Starter</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(() =>
                              submitJson(
                                `/api/grade-scale/${entry.id}`,
                                'DELETE'
                              )
                            )
                          }
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Course Grade Tracker
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set category weights first, then add graded items inside each
              category.
            </p>
          </div>
          {props.courses.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,140px)_auto]">
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  const nextCourse = props.courses.find(
                    (course) => course.id === e.target.value
                  );
                  setCreditsDraft(nextCourse?.credits.toString() ?? '3');
                }}
                className={numberInputClass()}
              >
                {props.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="12"
                step="1"
                value={creditsDraft}
                onChange={(e) => setCreditsDraft(e.target.value)}
                className={numberInputClass()}
                placeholder="Credits"
              />
              <button
                type="button"
                disabled={isPending || !selectedCourse}
                onClick={() =>
                  selectedCourse
                    ? runAction(() =>
                        submitJson(`/api/courses/${selectedCourse.id}`, 'PUT', {
                          credits: creditsDraft,
                        })
                      )
                    : undefined
                }
                className="btn-secondary"
              >
                Save credits
              </button>
            </div>
          ) : null}
        </div>

        {selectedCourse ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Current grade
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {formatPercent(selectedCourse.summary.currentPercent)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Letter
                </p>
                <p className="mt-2 text-2xl font-semibold text-brand-600">
                  {selectedCourse.summary.letterGrade?.label ?? '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Course GPA
                </p>
                <p className="mt-2 text-2xl font-semibold text-mint-600">
                  {formatGpa(selectedCourse.summary.currentGpaPoints)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Weight covered
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedCourse.summary.gradedWeight.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    New category
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Homework"
                    className={numberInputClass()}
                  />
                </div>
                <div className="w-full lg:w-52">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Weight %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={categoryForm.weight}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        weight: e.target.value,
                      }))
                    }
                    placeholder="e.g. 10"
                    className={numberInputClass()}
                  />
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(async () => {
                      await submitJson(
                        `/api/courses/${selectedCourse.id}/grade-categories`,
                        'POST',
                        categoryForm
                      );
                      setCategoryForm({ name: '', weight: '' });
                    })
                  }
                  className="btn-primary"
                >
                  Add category
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Total configured weight:{' '}
                {selectedCourse.summary.totalWeight.toFixed(1)}%{' · '}
                Remaining: {selectedCourse.summary.remainingWeight.toFixed(1)}%
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {selectedCourse.summary.categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No grade categories yet. Add Homework, Quiz, Exam, Project, or
                  any custom weight group to get started.
                </div>
              ) : (
                selectedCourse.summary.categories.map((category) => {
                  const itemForm = getItemForm(category.id);

                  return (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {category.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Weight {category.weight.toFixed(2)}% ·{' '}
                            {category.summary.itemCount} item
                            {category.summary.itemCount === 1 ? '' : 's'} ·{' '}
                            Current {formatPercent(category.summary.percent)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(() =>
                              submitJson(
                                `/api/grades/categories/${category.id}`,
                                'DELETE'
                              )
                            )
                          }
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          Delete category
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
                        <input
                          type="text"
                          value={itemForm.title}
                          onChange={(e) =>
                            setItemForm(category.id, { title: e.target.value })
                          }
                          placeholder="HW 1"
                          className={`lg:col-span-2 ${numberInputClass()}`}
                        />
                        <select
                          value={itemForm.assignmentId}
                          onChange={(e) => {
                            const assignmentId = e.target.value;
                            const assignment = selectedCourse.assignments.find(
                              (item) => item.id === assignmentId
                            );
                            setItemForm(category.id, {
                              assignmentId,
                              title: itemForm.title || assignment?.title || '',
                            });
                          }}
                          className={numberInputClass()}
                        >
                          <option value="">No linked assignment</option>
                          {selectedCourse.assignments.map((assignment) => (
                            <option key={assignment.id} value={assignment.id}>
                              {assignment.title}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.scoreEarned}
                          onChange={(e) =>
                            setItemForm(category.id, {
                              scoreEarned: e.target.value,
                            })
                          }
                          placeholder="Earned"
                          className={numberInputClass()}
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={itemForm.scorePossible}
                          onChange={(e) =>
                            setItemForm(category.id, {
                              scorePossible: e.target.value,
                            })
                          }
                          placeholder="Possible"
                          className={numberInputClass()}
                        />
                        <input
                          type="date"
                          value={itemForm.gradedAt}
                          onChange={(e) =>
                            setItemForm(category.id, {
                              gradedAt: e.target.value,
                            })
                          }
                          className={numberInputClass()}
                        />
                      </div>

                      <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                        <input
                          type="text"
                          value={itemForm.notes}
                          onChange={(e) =>
                            setItemForm(category.id, { notes: e.target.value })
                          }
                          placeholder="Optional notes"
                          className={`min-w-0 flex-1 ${numberInputClass()}`}
                        />
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(async () => {
                              await submitJson(
                                `/api/grades/categories/${category.id}/items`,
                                'POST',
                                itemForm
                              );
                              setItemForms((current) => ({
                                ...current,
                                [category.id]: {
                                  title: '',
                                  assignmentId: '',
                                  scoreEarned: '',
                                  scorePossible: '',
                                  gradedAt: '',
                                  notes: '',
                                },
                              }));
                            })
                          }
                          className="btn-primary"
                        >
                          Add graded item
                        </button>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-widest text-slate-400">
                              <th className="pb-2">Item</th>
                              <th className="pb-2">Score</th>
                              <th className="pb-2">Percent</th>
                              <th className="pb-2">Date</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.items.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="py-4 text-sm text-slate-500"
                                >
                                  No graded items in this category yet.
                                </td>
                              </tr>
                            ) : (
                              category.items.map((item) => (
                                <tr
                                  key={item.id}
                                  className="border-b border-slate-50"
                                >
                                  <td className="py-3">
                                    <div className="font-medium text-slate-900">
                                      {item.title}
                                    </div>
                                    {item.notes ? (
                                      <div className="mt-0.5 text-xs text-slate-500">
                                        {item.notes}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="py-3 text-slate-600">
                                    {item.scoreEarned.toFixed(2)} /{' '}
                                    {item.scorePossible.toFixed(2)}
                                  </td>
                                  <td className="py-3 text-slate-600">
                                    {(
                                      (item.scoreEarned / item.scorePossible) *
                                      100
                                    ).toFixed(2)}
                                    %
                                  </td>
                                  <td className="py-3 text-slate-500">
                                    {formatGradedDate(item.gradedAt)}
                                  </td>
                                  <td className="py-3 text-right">
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() =>
                                        runAction(() =>
                                          submitJson(
                                            `/api/grades/items/${item.id}`,
                                            'DELETE'
                                          )
                                        )
                                      }
                                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Add a course first, then come back to set up your weighted grade
            categories and GPA tracking.
          </div>
        )}
      </section>
    </div>
  );
}
