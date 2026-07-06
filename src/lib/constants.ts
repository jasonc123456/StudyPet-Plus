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

export const ASSIGNMENT_STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
] as const;

export const ASSIGNMENT_STATUS_VALUES = ASSIGNMENT_STATUSES.map((s) => s.value);

export const ASSIGNMENT_TYPES = [
  { value: 'homework', label: 'Homework' },
  { value: 'exam', label: 'Exam' },
  { value: 'project', label: 'Project' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
] as const;

export const ASSIGNMENT_TYPE_VALUES = ASSIGNMENT_TYPES.map((t) => t.value);

export const DEFAULT_ASSIGNMENT_STATUS = 'todo';
export const DEFAULT_ASSIGNMENT_TYPE = 'homework';
