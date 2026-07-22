import { ASSIGNMENT_STATUS_VALUES } from '@/lib/constants';

export function getNextAssignmentStatus(current: string): string {
  const index = ASSIGNMENT_STATUS_VALUES.indexOf(
    current as (typeof ASSIGNMENT_STATUS_VALUES)[number]
  );
  if (index === -1) {
    return ASSIGNMENT_STATUS_VALUES[0];
  }
  return ASSIGNMENT_STATUS_VALUES[
    (index + 1) % ASSIGNMENT_STATUS_VALUES.length
  ];
}

/**
 * Finished work sinks to the bottom — you open a task list to see what's still
 * owed, not what's already behind you. Array#sort is stable, so the due-date
 * ordering the query produced survives inside each group.
 */
export function sortDoneLast<T extends { status: string }>(
  assignments: readonly T[]
): T[] {
  return [...assignments].sort(
    (left, right) =>
      Number(left.status === 'done') - Number(right.status === 'done')
  );
}
