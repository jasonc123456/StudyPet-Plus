'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ColorPicker } from '@/components/courses/ColorPicker';
import { DEFAULT_COURSE_COLOR } from '@/lib/constants';

type CourseFormProps =
  | {
      mode: 'create';
      courseId?: never;
      initialValues?: never;
    }
  | {
      mode: 'edit';
      courseId: string;
      initialValues: {
        name: string;
        color: string;
        term: string | null;
        credits: number;
      };
    };

export function CourseForm(props: CourseFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [name, setName] = useState(isEdit ? props.initialValues.name : '');
  const [color, setColor] = useState(
    isEdit ? props.initialValues.color : DEFAULT_COURSE_COLOR
  );
  const [term, setTerm] = useState(
    isEdit ? (props.initialValues.term ?? '') : ''
  );
  const [credits, setCredits] = useState(
    isEdit ? props.initialValues.credits.toString() : '3'
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      color,
      term: term.trim() || null,
      credits: Number(credits),
    };

    try {
      const url =
        props.mode === 'edit'
          ? `/api/courses/${props.courseId}`
          : '/api/courses';
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

      router.push('/dashboard/courses');
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
        <div>
          <label
            htmlFor="course-name"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Course name
          </label>
          <input
            id="course-name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CSE 115A"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="course-term"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Term <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="course-term"
            type="text"
            maxLength={50}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Fall 2026"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="course-credits"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Credits
          </label>
          <input
            id="course-credits"
            type="number"
            required
            min={0}
            max={12}
            step={1}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            Used for GPA weighting — most courses are 3 to 5 credits.
          </p>
        </div>

        <ColorPicker value={color} onChange={setColor} />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
          </button>
          <Link href="/dashboard/courses" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
