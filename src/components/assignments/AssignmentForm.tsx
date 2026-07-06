'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  DEFAULT_ASSIGNMENT_STATUS,
  DEFAULT_ASSIGNMENT_TYPE,
} from '@/lib/constants';
import { toDatetimeLocalValue } from '@/lib/format';

type CourseOption = { id: string; name: string };

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
      initialValues: {
        title: string;
        description: string | null;
        dueAt: Date | string | null;
        status: string;
        type: string;
      };
      cancelHref: string;
      successHref: string;
    };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function AssignmentForm(props: AssignmentFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [selectedCourseId, setSelectedCourseId] = useState(
    props.mode === 'create' && props.courses
      ? (props.courses[0]?.id ?? '')
      : (props.courseId ?? '')
  );
  const [title, setTitle] = useState(isEdit ? props.initialValues.title : '');
  const [description, setDescription] = useState(
    isEdit ? (props.initialValues.description ?? '') : ''
  );
  const [dueAt, setDueAt] = useState(
    isEdit ? toDatetimeLocalValue(props.initialValues.dueAt) : ''
  );
  const [status, setStatus] = useState(
    isEdit ? props.initialValues.status : DEFAULT_ASSIGNMENT_STATUS
  );
  const [type, setType] = useState(
    isEdit ? props.initialValues.type : DEFAULT_ASSIGNMENT_TYPE
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const courseId =
    props.mode === 'create' && props.courses
      ? selectedCourseId
      : props.courseId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!courseId) {
      setError('Please select a course');
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      status,
      type,
    };

    try {
      const url =
        props.mode === 'edit'
          ? `/api/courses/${props.courseId}/assignments/${props.assignmentId}`
          : `/api/courses/${courseId}/assignments`;
      const method = props.mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Something went wrong');
        return;
      }

      router.push(props.successHref);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-lg p-6">
      <div className="space-y-5">
        {props.mode === 'create' && props.courses && (
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
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className={inputClass}
            >
              {props.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
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
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create assignment'}
          </button>
          <Link href={props.cancelHref} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
