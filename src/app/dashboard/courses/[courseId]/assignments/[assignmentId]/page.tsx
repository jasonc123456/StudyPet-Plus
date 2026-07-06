import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { DeleteAssignmentButton } from '@/components/planner/DeleteAssignmentButton';
import { ColorSwatch } from '@/components/planner/ColorSwatch';
import { StatusBadge } from '@/components/planner/StatusBadge';
import { TypeBadge } from '@/components/planner/TypeBadge';
import { getOwnedAssignment } from '@/lib/planner';
import { formatDateTime } from '@/lib/format';

type PageProps = {
  params: { courseId: string; assignmentId: string };
};

export default async function AssignmentDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const assignment = await getOwnedAssignment(
    params.courseId,
    params.assignmentId,
    session.user.id
  );
  if (!assignment) notFound();

  const listUrl = `/dashboard/courses/${params.courseId}/assignments`;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={listUrl}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to assignments
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {assignment.title}
            </h1>
            <Link
              href={listUrl}
              className="mt-2 inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700"
            >
              <ColorSwatch color={assignment.course.color} />
              {assignment.course.name}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={assignment.status} />
            <TypeBadge type={assignment.type} />
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Due date
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDateTime(assignment.dueAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Created
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDateTime(assignment.createdAt)}
            </dd>
          </div>
        </dl>

        {assignment.description && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {assignment.description}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
          <Link
            href={`/dashboard/courses/${params.courseId}/assignments/${params.assignmentId}/edit`}
            className="btn-primary"
          >
            Edit
          </Link>
          <DeleteAssignmentButton
            courseId={params.courseId}
            assignmentId={params.assignmentId}
            redirectTo={listUrl}
          />
        </div>
      </div>
    </div>
  );
}
