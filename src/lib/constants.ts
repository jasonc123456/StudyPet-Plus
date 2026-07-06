// Planner constants — allowed values enforced in Zod validators and UI.

export const COURSE_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ef4444', label: 'Red' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ec4899', label: 'Pink' },
] as const;

export const COURSE_COLOR_VALUES = COURSE_COLORS.map((c) => c.value);
export const DEFAULT_COURSE_COLOR = '#6366f1';
