'use client';

import { COURSE_COLORS } from '@/lib/constants';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">Color</legend>
      <div className="flex flex-wrap gap-2">
        {COURSE_COLORS.map(({ value: color, label }) => {
          const selected = value === color;
          return (
            <label
              key={color}
              className={[
                'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition',
                selected
                  ? 'ring-2 ring-brand-600 ring-offset-2'
                  : 'ring-1 ring-slate-200 hover:ring-slate-300',
              ].join(' ')}
              title={label}
            >
              <input
                type="radio"
                name="color"
                value={color}
                checked={selected}
                onChange={() => onChange(color)}
                className="sr-only"
              />
              <span
                className="h-7 w-7 rounded-full"
                style={{ backgroundColor: color }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
