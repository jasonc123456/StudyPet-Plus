'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

type PlannedCourse = {
  id: string;
  title: string;
  courseNumber: string | null;
  units: number | null;
  professor: string | null;
  lectureDays: string | null;
  lectureTime: string | null;
  lectureLocation: string | null;
  isAlternate: boolean;
  notes: string | null;
};

type PlannerSection = {
  id: string;
  label: string;
  sortOrder: number;
  courses: PlannedCourse[];
};

type Planner = {
  id: string;
  title: string;
  system: 'SEMESTER' | 'QUARTER';
  sections: PlannerSection[];
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CoursePlannerPageClientProps = {
  planners: Planner[];
  migrationRequired?: boolean;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function CoursePlannerPageClient({
  planners,
  migrationRequired = false,
}: CoursePlannerPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPlannerId, setSelectedPlannerId] = useState(
    planners[0]?.id ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const [plannerForm, setPlannerForm] = useState({
    title: '',
    system: 'SEMESTER',
  });
  const [sectionLabels, setSectionLabels] = useState<Record<string, string>>(
    {}
  );
  const [sectionComposerOpen, setSectionComposerOpen] = useState<
    Record<string, boolean>
  >({});
  const [courseForms, setCourseForms] = useState<
    Record<
      string,
      {
        title: string;
        courseNumber: string;
        units: string;
        professor: string;
        lectureDays: string;
        lectureTime: string;
        lectureLocation: string;
        isAlternate: boolean;
        notes: string;
      }
    >
  >({});

  const selectedPlanner =
    planners.find((planner) => planner.id === selectedPlannerId) ?? null;

  const plannerSummary = useMemo(
    () =>
      planners.map((planner) => ({
        ...planner,
        sectionCount: planner.sections.length,
        classCount: planner.sections.reduce(
          (total, section) =>
            total + section.courses.filter((c) => !c.isAlternate).length,
          0
        ),
        alternateCount: planner.sections.reduce(
          (total, section) =>
            total + section.courses.filter((c) => c.isAlternate).length,
          0
        ),
      })),
    [planners]
  );

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

  function getCourseForm(sectionId: string) {
    return (
      courseForms[sectionId] ?? {
        title: '',
        courseNumber: '',
        units: '',
        professor: '',
        lectureDays: '',
        lectureTime: '',
        lectureLocation: '',
        isAlternate: false,
        notes: '',
      }
    );
  }

  function updateCourseForm(
    sectionId: string,
    updates: Partial<ReturnType<typeof getCourseForm>>
  ) {
    setCourseForms((current) => ({
      ...current,
      [sectionId]: {
        ...getCourseForm(sectionId),
        ...updates,
      },
    }));
  }

  function setComposerOpen(sectionId: string, open: boolean) {
    setSectionComposerOpen((current) => ({
      ...current,
      [sectionId]: open,
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      {migrationRequired ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Course planner tables are not available in your local database yet.
          Run{' '}
          <code className="mx-1 rounded bg-white/70 px-1 py-0.5">
            npx prisma migrate dev
          </code>
          and then refresh this page.
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="card p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Create a planner
          </h2>
          <p className="text-sm text-slate-500">
            Choose semester or quarter first. We will create a starter plan with
            the most common term sections for that system.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            type="text"
            value={plannerForm.title}
            onChange={(e) =>
              setPlannerForm((current) => ({
                ...current,
                title: e.target.value,
              }))
            }
            placeholder="e.g. UCSC Degree Plan"
            className={inputClass}
          />
          <select
            value={plannerForm.system}
            onChange={(e) =>
              setPlannerForm((current) => ({
                ...current,
                system: e.target.value as 'SEMESTER' | 'QUARTER',
              }))
            }
            className={inputClass}
          >
            <option value="SEMESTER">Semester system</option>
            <option value="QUARTER">Quarter system</option>
          </select>
          <button
            type="button"
            disabled={isPending || migrationRequired}
            onClick={() =>
              runAction(async () => {
                await submitJson('/api/course-planners', 'POST', plannerForm);
                setPlannerForm({ title: '', system: 'SEMESTER' });
              })
            }
            className="btn-primary"
          >
            Create planner
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Planners</h2>
            <span className="text-xs uppercase tracking-widest text-slate-400">
              {plannerSummary.length}
            </span>
          </div>

          {plannerSummary.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No planners yet. Create one above to start mapping out future
              terms and backup classes.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {plannerSummary.map((planner) => {
                const active = planner.id === selectedPlannerId;
                return (
                  <button
                    key={planner.id}
                    type="button"
                    onClick={() => setSelectedPlannerId(planner.id)}
                    className={[
                      'w-full rounded-2xl border p-4 text-left transition',
                      active
                        ? 'border-brand-200 bg-brand-50/60'
                        : 'border-slate-100 bg-white hover:border-slate-200',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {planner.title}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
                          {planner.system === 'SEMESTER'
                            ? 'Semester'
                            : 'Quarter'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          runAction(async () => {
                            await submitJson(
                              `/api/course-planners/${planner.id}`,
                              'DELETE'
                            );
                            if (planner.id === selectedPlannerId) {
                              setSelectedPlannerId(
                                planners.find((item) => item.id !== planner.id)
                                  ?.id ?? ''
                              );
                            }
                          });
                        }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {planner.sectionCount} section
                        {planner.sectionCount === 1 ? '' : 's'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {planner.classCount} planned
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                        {planner.alternateCount} backup
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-6">
          {selectedPlanner ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {selectedPlanner.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPlanner.system === 'SEMESTER'
                      ? 'Semester planner'
                      : 'Quarter planner'}
                    {' · '}
                    Add sections for each term and place primary or backup
                    classes inside them.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,220px)_auto]">
                  <input
                    type="text"
                    value={sectionLabels[selectedPlanner.id] ?? ''}
                    onChange={(e) =>
                      setSectionLabels((current) => ({
                        ...current,
                        [selectedPlanner.id]: e.target.value,
                      }))
                    }
                    placeholder={
                      selectedPlanner.system === 'SEMESTER'
                        ? 'e.g. Fall 2027'
                        : 'e.g. Winter 2028'
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      runAction(async () => {
                        await submitJson(
                          `/api/course-planners/${selectedPlanner.id}/sections`,
                          'POST',
                          { label: sectionLabels[selectedPlanner.id] ?? '' }
                        );
                        setSectionLabels((current) => ({
                          ...current,
                          [selectedPlanner.id]: '',
                        }));
                      })
                    }
                    className="btn-primary"
                  >
                    + Add section
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                {selectedPlanner.sections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No sections yet. Add your first term like Fall 2026 or
                    Winter 2027.
                  </div>
                ) : (
                  selectedPlanner.sections.map((section) => {
                    const courseForm = getCourseForm(section.id);
                    const composerOpen =
                      sectionComposerOpen[section.id] ?? false;
                    const primaryCourses = section.courses.filter(
                      (course) => !course.isAlternate
                    );
                    const backupCourses = section.courses.filter(
                      (course) => course.isAlternate
                    );

                    return (
                      <div
                        key={section.id}
                        className="rounded-3xl border border-slate-100 p-5"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900">
                              {section.label}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {primaryCourses.length} planned class
                              {primaryCourses.length === 1 ? '' : 'es'}
                              {' · '}
                              {backupCourses.length} backup option
                              {backupCourses.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(() =>
                                submitJson(
                                  `/api/course-planner-sections/${section.id}`,
                                  'DELETE'
                                )
                              )
                            }
                            className="text-sm font-semibold text-red-600 hover:text-red-700"
                          >
                            Delete section
                          </button>
                        </div>

                        <div className="mt-5">
                          <button
                            type="button"
                            disabled={isPending || composerOpen}
                            onClick={() => setComposerOpen(section.id, true)}
                            className="btn-primary"
                          >
                            Add class
                          </button>
                        </div>

                        {composerOpen ? (
                          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <input
                                type="text"
                                value={courseForm.title}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    title: e.target.value,
                                  })
                                }
                                placeholder="Class name (e.g. Data Structures)"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={courseForm.courseNumber}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    courseNumber: e.target.value,
                                  })
                                }
                                placeholder="Course number (e.g. CSE115A)"
                                className={inputClass}
                              />
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.5"
                                value={courseForm.units}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    units: e.target.value,
                                  })
                                }
                                placeholder="Units"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={courseForm.professor}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    professor: e.target.value,
                                  })
                                }
                                placeholder="Professor"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={courseForm.lectureDays}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    lectureDays: e.target.value,
                                  })
                                }
                                placeholder="Lecture days (e.g. Mon/Wed)"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={courseForm.lectureTime}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    lectureTime: e.target.value,
                                  })
                                }
                                placeholder="Lecture time (e.g. 2:00 PM - 3:15 PM)"
                                className={inputClass}
                              />
                              <input
                                type="text"
                                value={courseForm.lectureLocation}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    lectureLocation: e.target.value,
                                  })
                                }
                                placeholder="Lecture location or Online"
                                className={`lg:col-span-2 ${inputClass}`}
                              />
                              <input
                                type="text"
                                value={courseForm.notes}
                                onChange={(e) =>
                                  updateCourseForm(section.id, {
                                    notes: e.target.value,
                                  })
                                }
                                placeholder="Optional notes"
                                className={inputClass}
                              />
                              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={courseForm.isAlternate}
                                  onChange={(e) =>
                                    updateCourseForm(section.id, {
                                      isAlternate: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                                Add as backup / alternate class
                              </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(async () => {
                                    await submitJson(
                                      `/api/course-planner-sections/${section.id}/courses`,
                                      'POST',
                                      courseForm
                                    );
                                    setCourseForms((current) => ({
                                      ...current,
                                      [section.id]: {
                                        title: '',
                                        courseNumber: '',
                                        units: '',
                                        professor: '',
                                        lectureDays: '',
                                        lectureTime: '',
                                        lectureLocation: '',
                                        isAlternate: false,
                                        notes: '',
                                      },
                                    }));
                                    setComposerOpen(section.id, false);
                                  })
                                }
                                className="btn-primary"
                              >
                                Add class to {section.label}
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  setComposerOpen(section.id, false)
                                }
                                className="btn-secondary"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div
                          className={[
                            'mt-6 grid grid-cols-1 gap-4',
                            backupCourses.length > 0 ? 'xl:grid-cols-2' : '',
                          ].join(' ')}
                        >
                          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                                Planned classes
                              </h4>
                              <span className="text-xs text-slate-400">
                                {primaryCourses.length}
                              </span>
                            </div>
                            <div className="mt-3 space-y-3">
                              {primaryCourses.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No primary classes added yet.
                                </p>
                              ) : (
                                primaryCourses.map((course) => (
                                  <PlannerCourseCard
                                    key={course.id}
                                    course={course}
                                    onDelete={() =>
                                      runAction(() =>
                                        submitJson(
                                          `/api/course-planner-courses/${course.id}`,
                                          'DELETE'
                                        )
                                      )
                                    }
                                    isPending={isPending}
                                  />
                                ))
                              )}
                            </div>
                          </div>

                          {backupCourses.length > 0 ? (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold uppercase tracking-widest text-amber-700">
                                  Backup classes
                                </h4>
                                <span className="text-xs text-amber-600">
                                  {backupCourses.length}
                                </span>
                              </div>
                              <div className="mt-3 space-y-3">
                                {backupCourses.map((course) => (
                                  <PlannerCourseCard
                                    key={course.id}
                                    course={course}
                                    onDelete={() =>
                                      runAction(() =>
                                        submitJson(
                                          `/api/course-planner-courses/${course.id}`,
                                          'DELETE'
                                        )
                                      )
                                    }
                                    isPending={isPending}
                                    tone="backup"
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Pick a planner from the left, or create a new one above.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PlannerCourseCard({
  course,
  onDelete,
  isPending,
  tone = 'primary',
}: {
  course: PlannedCourse;
  onDelete: () => void;
  isPending: boolean;
  tone?: 'primary' | 'backup';
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-4',
        tone === 'backup'
          ? 'border-amber-200 bg-white/90'
          : 'border-slate-200 bg-white/90',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{course.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {course.courseNumber ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {course.courseNumber}
              </span>
            ) : null}
            {course.units !== null ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {course.units} unit{course.units === 1 ? '' : 's'}
              </span>
            ) : null}
            {course.professor ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {course.professor}
              </span>
            ) : null}
          </div>
        </div>
        {course.isAlternate ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Backup
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <span className="font-medium text-slate-700">Days:</span>{' '}
          {course.lectureDays || 'TBD'}
        </div>
        <div>
          <span className="font-medium text-slate-700">Time:</span>{' '}
          {course.lectureTime || 'TBD'}
        </div>
        <div className="sm:col-span-2">
          <span className="font-medium text-slate-700">Location:</span>{' '}
          {course.lectureLocation || 'TBD'}
        </div>
        {course.notes ? (
          <div className="sm:col-span-2">
            <span className="font-medium text-slate-700">Notes:</span>{' '}
            {course.notes}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={isPending}
          onClick={onDelete}
          className="text-xs font-semibold text-red-600 hover:text-red-700"
        >
          Delete class
        </button>
      </div>
    </div>
  );
}
