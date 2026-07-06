'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ColorPicker } from '@/components/planner/ColorPicker';
import { COURSE_COLORS } from '@/lib/constants';
import { createCourseSchema, type CreateCourseInput } from '@/lib/validators';

type CourseFormProps = {
  mode: 'create' | 'edit';
  courseId?: string;
  defaultValues?: Partial<CreateCourseInput>;
};

export function CourseForm({ mode, courseId, defaultValues }: CourseFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      color: defaultValues?.color ?? COURSE_COLORS[0].value,
      term: defaultValues?.term ?? '',
    },
  });

  const color = watch('color');

  async function onSubmit(data: CreateCourseInput) {
    setServerError(null);
    const payload = {
      name: data.name,
      color: data.color,
      term: data.term?.trim() ? data.term.trim() : null,
    };

    const url = mode === 'create' ? '/api/courses' : `/api/courses/${courseId}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? 'Failed to save course');
      return;
    }

    router.push('/dashboard/courses');
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card max-w-lg space-y-5 p-6"
    >
      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Course name
        </label>
        <input
          id="name"
          {...register('name')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="e.g. CS 101"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="term"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Term <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="term"
          {...register('term')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="e.g. Fall 2026"
        />
        {errors.term && (
          <p className="mt-1 text-sm text-red-600">{errors.term.message}</p>
        )}
      </div>

      <ColorPicker
        value={color}
        onChange={(c) => setValue('color', c, { shouldValidate: true })}
      />
      {errors.color && (
        <p className="text-sm text-red-600">{errors.color.message}</p>
      )}

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
              ? 'Create course'
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
