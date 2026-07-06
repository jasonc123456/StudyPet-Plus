'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  type AssignmentStatus,
  type AssignmentType,
} from '@/lib/constants';
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/lib/format';
import {
  createAssignmentSchema,
  type CreateAssignmentInput,
} from '@/lib/validators';

type AssignmentFormProps = {
  mode: 'create' | 'edit';
  courseId: string;
  assignmentId?: string;
  defaultValues?: {
    title?: string;
    description?: string | null;
    dueAt?: Date | string | null;
    status?: string;
    type?: string;
  };
};

export function AssignmentForm({
  mode,
  courseId,
  assignmentId,
  defaultValues,
}: AssignmentFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [dueAtLocal, setDueAtLocal] = useState(
    toDatetimeLocalValue(defaultValues?.dueAt)
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      status: (defaultValues?.status as AssignmentStatus) ?? 'todo',
      type: (defaultValues?.type as AssignmentType) ?? 'homework',
    },
  });

  async function onSubmit(data: CreateAssignmentInput) {
    setServerError(null);
    const dueAtIso = datetimeLocalToIso(dueAtLocal);

    const payload = {
      title: data.title,
      description: data.description?.trim() ? data.description.trim() : null,
      dueAt: dueAtIso,
      status: data.status,
      type: data.type,
    };

    const url =
      mode === 'create'
        ? `/api/courses/${courseId}/assignments`
        : `/api/courses/${courseId}/assignments/${assignmentId}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? 'Failed to save assignment');
      return;
    }

    const redirectUrl =
      mode === 'create'
        ? `/dashboard/courses/${courseId}/assignments`
        : `/dashboard/courses/${courseId}/assignments/${assignmentId}`;
    router.push(redirectUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card max-w-lg space-y-5 p-6"
    >
      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Title
        </label>
        <input
          id="title"
          {...register('title')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="e.g. Problem Set 3"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Description{' '}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Notes or instructions…"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">
            {errors.description.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="dueAt"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Due date{' '}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="dueAt"
          type="datetime-local"
          value={dueAtLocal}
          onChange={(e) => setDueAtLocal(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="status"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="status"
            {...register('status')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
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
            htmlFor="type"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Type
          </label>
          <select
            id="type"
            {...register('type')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {serverError && (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Create assignment'
              : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
