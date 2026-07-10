import type { Prisma } from '@prisma/client';

export const NOTE_SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created-desc', label: 'Newest created' },
  { value: 'created-asc', label: 'Oldest created' },
] as const;

export type NoteSortValue = (typeof NOTE_SORT_OPTIONS)[number]['value'];

export const DEFAULT_NOTE_SORT: NoteSortValue = 'updated';

export function parseNoteSort(value: string | undefined): NoteSortValue {
  if (value === 'created-desc' || value === 'created-asc') return value;
  return DEFAULT_NOTE_SORT;
}

type NoteListParams = {
  courseId?: string;
  q?: string;
};

export function buildNoteListWhere(
  userId: string,
  params: NoteListParams
): Prisma.NoteWhereInput {
  const courseFilter = params.courseId;
  const searchQuery = params.q?.trim();

  return {
    userId,
    ...(courseFilter === 'none'
      ? { courseId: null }
      : courseFilter
        ? { courseId: courseFilter }
        : {}),
    ...(searchQuery
      ? {
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { content: { contains: searchQuery, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export function noteListOrderBy(
  sort: NoteSortValue
): Prisma.NoteOrderByWithRelationInput {
  switch (sort) {
    case 'created-desc':
      return { createdAt: 'desc' };
    case 'created-asc':
      return { createdAt: 'asc' };
    default:
      return { updatedAt: 'desc' };
  }
}

export function hasNoteListFilters(params: NoteListParams): boolean {
  return Boolean(params.courseId || params.q?.trim());
}
