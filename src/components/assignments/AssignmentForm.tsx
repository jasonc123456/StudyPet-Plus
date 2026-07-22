'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  DEFAULT_ASSIGNMENT_STATUS,
  DEFAULT_ASSIGNMENT_TYPE,
} from '@/lib/constants';
import { toDatetimeLocalValue } from '@/lib/format';

type CourseOption = { id: string; name: string };

type EditInitialValues = {
  title: string;
  description: string | null;
  dueAt: Date | string | null;
  status: string;
  type: string;
};

type AssignmentFormProps =
  | {
      mode: 'create';
      courseId: string;
      courses?: never;
      assignmentId?: never;
      initialValues?: never;
      cancelHref: string;
      successHref: string;
    }
  | {
      mode: 'create';
      courseId?: never;
      courses: CourseOption[];
      assignmentId?: never;
      initialValues?: never;
      cancelHref: string;
      successHref: string;
    }
  | {
      mode: 'edit';
      courseId: string;
      courses?: never;
      assignmentId: string;
      initialValues: EditInitialValues;
      cancelHref: string;
      successHref: string;
    };

type FormFields = {
  selectedCourseId: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  type: string;
};

type AssignmentPayload = {
  title: string;
  description: string | null;
  dueAt: string | null;
  status: string;
  type: string;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const MISSING_COURSE_ERROR = 'Please select a course';
const GENERIC_ERROR = 'Something went wrong';
const NETWORK_ERROR = 'Network error — please try again';

function hasCourseSelector(
  props: AssignmentFormProps
): props is Extract<AssignmentFormProps, { courses: CourseOption[] }> {
  return props.mode === 'create' && Array.isArray(props.courses);
}

/** Default field values for create vs edit mode. */
function getInitialFormState(props: AssignmentFormProps): FormFields {
  if (props.mode === 'edit') {
    return {
      selectedCourseId: props.courseId,
      title: props.initialValues.title,
      description: props.initialValues.description ?? '',
      dueAt: toDatetimeLocalValue(props.initialValues.dueAt),
      status: props.initialValues.status,
      type: props.initialValues.type,
    };
  }

  if (hasCourseSelector(props)) {
    return {
      selectedCourseId: props.courses[0]?.id ?? '',
      title: '',
      description: '',
      dueAt: '',
      status: DEFAULT_ASSIGNMENT_STATUS,
      type: DEFAULT_ASSIGNMENT_TYPE,
    };
  }

  return {
    selectedCourseId: props.courseId ?? '',
    title: '',
    description: '',
    dueAt: '',
    status: DEFAULT_ASSIGNMENT_STATUS,
    type: DEFAULT_ASSIGNMENT_TYPE,
  };
}

function resolveCourseId(
  props: AssignmentFormProps,
  selectedCourseId: string
): string | undefined {
  if (hasCourseSelector(props)) {
    return selectedCourseId;
  }
  return props.courseId;
}

/** Transform controlled form inputs into the API request body. */
function buildAssignmentPayload(fields: {
  title: string;
  description: string;
  dueAt: string;
  status: string;
  type: string;
}): AssignmentPayload {
  return {
    title: fields.title.trim(),
    description: fields.description.trim() || null,
    dueAt: fields.dueAt ? new Date(fields.dueAt).toISOString() : null,
    status: fields.status,
    type: fields.type,
  };
}

function buildRequest(
  props: AssignmentFormProps,
  courseId: string
): { url: string; method: 'POST' | 'PUT' } {
  if (props.mode === 'edit') {
    return {
      url: `/api/courses/${props.courseId}/assignments/${props.assignmentId}`,
      method: 'PUT',
    };
  }

  return {
    url: `/api/courses/${courseId}/assignments`,
    method: 'POST',
  };
}

async function readErrorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? GENERIC_ERROR;
}

function CourseSelectField({
  courses,
  value,
  onChange,
}: {
  courses: CourseOption[];
  value: string;
  onChange: (courseId: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="assignment-course"
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        Course
      </label>
      <select
        id="assignment-course"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AssignmentForm(props: AssignmentFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';
  const showCourseSelector = hasCourseSelector(props);
  const initial = getInitialFormState(props);

  const [selectedCourseId, setSelectedCourseId] = useState(
    initial.selectedCourseId
  );
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [status, setStatus] = useState(initial.status);
  const [type, setType] = useState(initial.type);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const courseId = resolveCourseId(props, selectedCourseId);
  const submitLabel = isEdit ? 'Save changes' : 'Create task';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!courseId) {
      setError(MISSING_COURSE_ERROR);
      return;
    }

    setSaving(true);

    const payload = buildAssignmentPayload({
      title,
      description,
      dueAt,
      status,
      type,
    });
    const { url, method } = buildRequest(props, courseId);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
      }

      router.push(props.successHref);
      router.refresh();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-lg p-6">
      <div className="space-y-5">
        {showCourseSelector && (
          <CourseSelectField
            courses={props.courses}
            value={selectedCourseId}
            onChange={setSelectedCourseId}
          />
        )}

        <div>
          <label
            htmlFor="assignment-title"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Title
          </label>
          <input
            id="assignment-title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Midterm exam"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="assignment-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Details{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="assignment-description"
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes, instructions, or links…"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="assignment-due"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Due date{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="assignment-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="assignment-status"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="assignment-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="assignment-type"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Type
            </label>
            <select
              id="assignment-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : submitLabel}
          </button>
          <Link href={props.cancelHref} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
