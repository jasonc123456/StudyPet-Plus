'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CourseOption = {
  id: string;
  name: string;
};

type NoteFormProps =
  | {
      mode: 'create';
      noteId?: never;
      initialValues?: never;
      courses: CourseOption[];
      initialCourseId?: string | null;
      cancelHref: string;
      successHref: string;
    }
  | {
      mode: 'edit';
      noteId: string;
      initialValues: {
        title: string;
        content: string;
        courseId: string | null;
      };
      courses: CourseOption[];
      initialCourseId?: never;
      cancelHref: string;
      successHref: string;
    };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function NoteForm(props: NoteFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [title, setTitle] = useState(isEdit ? props.initialValues.title : '');
  const [content, setContent] = useState(
    isEdit ? props.initialValues.content : ''
  );
  const [courseId, setCourseId] = useState(
    isEdit
      ? (props.initialValues.courseId ?? '')
      : (props.initialCourseId ?? '')
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: title.trim(),
      content,
      courseId: courseId || null,
    };

    try {
      const url =
        props.mode === 'edit' ? `/api/notes/${props.noteId}` : '/api/notes';
      const method = props.mode === 'edit' ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = 'Something went wrong';

        try {
          const data = JSON.parse(raw) as { error?: string };
          message = data.error ?? message;
        } catch {
          if (raw.trim()) {
            message = raw.trim().slice(0, 200);
          }
        }

        setError(message);
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
    <form onSubmit={handleSubmit} className="card max-w-2xl p-6">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="note-title"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Title
          </label>
          <input
            id="note-title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 5 lecture notes"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="note-course"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Course{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="note-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {props.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-content"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Content
          </label>
          <textarea
            id="note-content"
            rows={12}
            maxLength={50000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or type your study notes here. This text will be used for AI flashcard and quiz generation in a future sprint."
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Saved note content is the source for future flashcard/quiz
            generation (US-3.2+).
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={props.cancelHref} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create note'}
          </button>
        </div>
      </div>
    </form>
  );
}
