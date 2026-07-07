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
