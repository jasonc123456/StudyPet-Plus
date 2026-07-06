'use client';

import { COURSE_COLORS } from '@/lib/constants';

import { ColorSwatch } from './ColorSwatch';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  name?: string;
};

export function ColorPicker({
  value,
  onChange,
  name = 'color',
}: ColorPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">Color</legend>
      <div className="flex flex-wrap gap-2">
        {COURSE_COLORS.map((c) => (
          <label
            key={c.value}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              value === c.value
                ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-400'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={value === c.value}
              onChange={() => onChange(c.value)}
              className="sr-only"
            />
            <ColorSwatch color={c.value} size="lg" />
            <span className="text-slate-700">{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
