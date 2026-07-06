import Link from 'next/link';

import { ColorSwatch } from '@/components/planner/ColorSwatch';
import { StatusBadge } from '@/components/planner/StatusBadge';
import { TypeBadge } from '@/components/planner/TypeBadge';
import { formatDateTime } from '@/lib/format';

type AssignmentRowProps = {
  courseId: string;
  assignment: {
    id: string;
    title: string;
    dueAt: Date | string | null;
    status: string;
    type: string;
    course?: { name: string; color: string };
  };
};

export function AssignmentRow({ courseId, assignment }: AssignmentRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/courses/${courseId}/assignments/${assignment.id}`}
          className="font-medium text-slate-900 hover:text-brand-600"
        >
          {assignment.title}
        </Link>
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-600 sm:table-cell">
        {assignment.course ? (
          <span className="inline-flex items-center gap-2">
            <ColorSwatch color={assignment.course.color} />
            {assignment.course.name}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatDateTime(assignment.dueAt)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={assignment.status} />
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={assignment.type} />
      </td>
    </tr>
  );
}
