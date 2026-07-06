'use client';

import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/planner/ConfirmDialog';

export function DeleteAssignmentButton({
  courseId,
  assignmentId,
  redirectTo,
}: {
  courseId: string;
  assignmentId: string;
  redirectTo: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    const res = await fetch(
      `/api/courses/${courseId}/assignments/${assignmentId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Failed to delete assignment');
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <ConfirmDialog
      title="Delete assignment?"
      message="This action cannot be undone."
      onConfirm={handleDelete}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
      )}
    />
  );
}
