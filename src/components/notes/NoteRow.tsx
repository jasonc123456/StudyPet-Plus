'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { formatUpdatedAt, notePreview } from '@/lib/format';

export type NoteRowData = {
  id: string;
  title: string;
  content: string;
  updatedAt: Date | string;
  course: { id: string; name: string; color: string } | null;
};

type NoteRowProps = {
  note: NoteRowData;
};

export function NoteRow({ note }: NoteRowProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editHref = `/dashboard/notes/${note.id}/edit`;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Failed to delete note');
        return;
      }

      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Link
              href={editHref}
              className="font-semibold text-slate-900 hover:text-brand-600"
            >
              {note.title}
            </Link>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {notePreview(note.content)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Updated {formatUpdatedAt(note.updatedAt)}</span>
              {note.course ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  <ColorSwatch color={note.course.color} size="sm" />
                  {note.course.name}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  Uncategorized
                </span>
              )}
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={editHref} className="btn-secondary text-xs px-3 py-1.5">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={`Delete note: ${note.title}`}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete note?"
        message={`"${note.title}" will be permanently removed.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
