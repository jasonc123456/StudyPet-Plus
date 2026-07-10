'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { wordCount } from '@/lib/format';

type CourseOption = {
  id: string;
  name: string;
};

type NoteFormProps =
  | {
      mode: 'create';
      noteId?: never;
      initialValues?: never;
      courses: CourseOption[];
      initialCourseId?: string | null;
      cancelHref: string;
      successHref: string;
    }
  | {
      mode: 'edit';
      noteId: string;
      initialValues: {
        title: string;
        content: string;
        courseId: string | null;
        pdfName: string | null;
        pdfUrl: string | null;
      };
      courses: CourseOption[];
      initialCourseId?: never;
      cancelHref: string;
      successHref: string;
    };

const TITLE_MAX = 200;
const CONTENT_MAX = 50000;
const NOTE_PDF_SECURITY_MESSAGE =
  'PDFs are stored as attachments only and are not automatically parsed or sent to AI tools.';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function NoteForm(props: NoteFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [title, setTitle] = useState(isEdit ? props.initialValues.title : '');
  const [content, setContent] = useState(
    isEdit ? props.initialValues.content : ''
  );
  const [courseId, setCourseId] = useState(
    isEdit
      ? (props.initialValues.courseId ?? '')
      : (props.initialCourseId ?? '')
  );
  const [pdfName, setPdfName] = useState(
    isEdit ? (props.initialValues.pdfName ?? null) : null
  );
  const [pdfUrl, setPdfUrl] = useState(
    isEdit ? (props.initialValues.pdfUrl ?? null) : null
  );
  const [pdfToken, setPdfToken] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    content?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  function validateFields(): boolean {
    const nextErrors: { title?: string; content?: string } = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Title is required.';
    } else if (trimmedTitle.length > TITLE_MAX) {
      nextErrors.title = `Title must be ${TITLE_MAX} characters or fewer.`;
    }

    if (content.length > CONTENT_MAX) {
      nextErrors.content = `Content must be ${CONTENT_MAX} characters or fewer.`;
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateFields()) {
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      content,
      courseId: courseId || null,
      pdfName,
      pdfUrl,
      pdfToken,
    };

    try {
      const url =
        props.mode === 'edit' ? `/api/notes/${props.noteId}` : '/api/notes';
      const method = props.mode === 'edit' ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = 'Something went wrong';

        try {
          const data = JSON.parse(raw) as { error?: string };
          message = data.error ?? message;
        } catch {
          if (raw.trim()) {
            message = raw.trim().slice(0, 200);
          }
        }

        setError(message);
        return;
      }

      router.push(props.successHref);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.set('file', file);

      const res = await fetch('/api/notes/pdf', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = 'Failed to upload PDF';

        try {
          const data = JSON.parse(raw) as { error?: string };
          message = data.error ?? message;
        } catch {
          if (raw.trim()) {
            message = raw.trim().slice(0, 200);
          }
        }

        setError(message);
        return;
      }

      const data = (await res.json()) as {
        pdfName: string;
        pdfUrl: string;
        pdfToken: string;
      };

      setPdfName(data.pdfName);
      setPdfUrl(data.pdfUrl);
      setPdfToken(data.pdfToken);
    } catch {
      setError('Network error — please try again');
    } finally {
      e.target.value = '';
      setUploadingPdf(false);
    }
  }

  function clearPdf() {
    setPdfName(null);
    setPdfUrl(null);
    setPdfToken(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl p-6">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="note-title"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Title
          </label>
          <input
            id="note-title"
            type="text"
            required
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors((current) => ({ ...current, title: undefined }));
              }
            }}
            placeholder="e.g. Chapter 5 lecture notes"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={
              fieldErrors.title ? 'note-title-error' : undefined
            }
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
            <span>Required</span>
            <span>
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          {fieldErrors.title && (
            <p id="note-title-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="note-course"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Course{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="note-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {props.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-content"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Content
          </label>
          <textarea
            id="note-content"
            rows={12}
            maxLength={CONTENT_MAX}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (fieldErrors.content) {
                setFieldErrors((current) => ({
                  ...current,
                  content: undefined,
                }));
              }
            }}
            placeholder="Paste or type your study notes here. This text will be used for AI flashcard and quiz generation in a future sprint."
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.content)}
            aria-describedby={
              fieldErrors.content ? 'note-content-error' : undefined
            }
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {wordCount(content)} word{wordCount(content) === 1 ? '' : 's'}
            </span>
            <span>
              {content.length.toLocaleString()}/{CONTENT_MAX.toLocaleString()}{' '}
              characters
            </span>
          </div>
          {fieldErrors.content && (
            <p id="note-content-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.content}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-400">
            Saved note content is the source for future flashcard/quiz
            generation (US-3.2+).
          </p>
        </div>

        <div>
          <label
            htmlFor="note-pdf"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            PDF attachment{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            ref={fileInputRef}
            id="note-pdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfChange}
            disabled={uploadingPdf || saving}
            className={inputClass}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Attach one PDF up to 10 MB.</span>
            {uploadingPdf ? <span>Uploading…</span> : null}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {NOTE_PDF_SECURITY_MESSAGE}
          </p>
          {pdfUrl && pdfName ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <a
                href={pdfUrl}
                rel="noreferrer"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Download PDF: {pdfName}
              </a>
              <button
                type="button"
                onClick={clearPdf}
                className="text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Remove PDF
              </button>
            </div>
          ) : null}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={props.cancelHref} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create note'}
          </button>
        </div>
      </div>
    </form>
  );
}
