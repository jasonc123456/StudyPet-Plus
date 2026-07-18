'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  CLASS_ALL,
  ClassPicker,
  type ClassOption,
} from '@/components/common/ClassPicker';

type AnalyticsClassFilterProps = {
  courses: ClassOption[];
};

/** Course filter that scopes analytics via the `?course=` query param. */
export function AnalyticsClassFilter({ courses }: AnalyticsClassFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const value = params.get('course') || CLASS_ALL;

  return (
    <ClassPicker
      courses={courses}
      value={value}
      includeUncategorized={false}
      onChange={(next) => {
        const query = new URLSearchParams(params.toString());
        if (next === CLASS_ALL) query.delete('course');
        else query.set('course', next);
        const qs = query.toString();
        router.push(`/dashboard/analytics${qs ? `?${qs}` : ''}`);
      }}
    />
  );
}
