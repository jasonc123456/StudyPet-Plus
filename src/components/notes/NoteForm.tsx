'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { wordCount } from '@/lib/format';
import {
  hasVisibleRichText,
  richTextToPlainText,
  sanitizeRichTextHtml,
} from '@/lib/note-rich-text';

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
  'PDFs stay private attachments and are never sent to AI on their own — the file is only shared with the AI if you pick this note to generate flashcards or a quiz.';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const editorClass =
  'min-h-[32rem] w-full rounded-b-2xl border border-t-0 border-slate-300 bg-white px-5 py-4 text-[15px] leading-7 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const fontSizeCommandByLabel: Record<string, string> = {
  '12': '2',
  '14': '3',
  '16': '4',
  '18': '5',
  '24': '6',
};

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
};

function ToolbarButton({ label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
    >
      {label}
    </button>
  );
}

export function NoteForm(props: NoteFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';
  const editorRef = useRef<HTMLDivElement | null>(null);

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

  const plainTextContent = useMemo(
    () => richTextToPlainText(content),
    [content]
  );

  useEffect(() => {
    if (!editorRef.current) return;

    document.execCommand('styleWithCSS', false, 'true');
    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  function syncEditorContent(nextHtml?: string) {
    const resolvedHtml =
      nextHtml ?? sanitizeRichTextHtml(editorRef.current?.innerHTML ?? '');
    setContent(resolvedHtml);
    if (fieldErrors.content) {
      setFieldErrors((current) => ({
        ...current,
        content: undefined,
      }));
    }
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    syncEditorContent(editorRef.current?.innerHTML ?? '');
  }

  function handleFontSizeChange(size: string) {
    const commandValue = fontSizeCommandByLabel[size];
    if (!commandValue) return;
    runEditorCommand('fontSize', commandValue);
  }

  function validateFields(): boolean {
    const nextErrors: { title?: string; content?: string } = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      nextErrors.title = 'Title is required.';
    } else if (trimmedTitle.length > TITLE_MAX) {
      nextErrors.title = `Title must be ${TITLE_MAX} characters or fewer.`;
    }

    if (plainTextContent.length > CONTENT_MAX) {
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

    const sanitizedContent = sanitizeRichTextHtml(content);
    setContent(sanitizedContent);

    const payload = {
      title: title.trim(),
      content: sanitizedContent,
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
    <form onSubmit={handleSubmit} className="card w-full max-w-none p-6">
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Content
          </label>
          <div className="rounded-2xl border border-slate-300 bg-slate-50">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-3">
              <ToolbarButton
                label="Bold"
                onClick={() => runEditorCommand('bold')}
              />
              <ToolbarButton
                label="Italic"
                onClick={() => runEditorCommand('italic')}
              />
              <ToolbarButton
                label="Underline"
                onClick={() => runEditorCommand('underline')}
              />
              <ToolbarButton
                label="Bullets"
                onClick={() => runEditorCommand('insertUnorderedList')}
              />

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <span>Color</span>
                <input
                  type="color"
                  defaultValue="#1e293b"
                  onChange={(e) =>
                    runEditorCommand('foreColor', e.target.value)
                  }
                  className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <span>Size</span>
                <select
                  defaultValue="16"
                  onChange={(e) => handleFontSizeChange(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value="12">12</option>
                  <option value="14">14</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                </select>
              </label>
            </div>

            <div className="relative">
              {!hasVisibleRichText(content) ? (
                <p className="pointer-events-none absolute left-5 top-4 text-sm text-slate-400">
                  Paste or type your study notes here. Use the toolbar to add
                  bold, italics, underline, bullets, color, and font size.
                </p>
              ) : null}
              <div
                id="note-content"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() =>
                  syncEditorContent(editorRef.current?.innerHTML ?? '')
                }
                onBlur={() => syncEditorContent()}
                className={editorClass}
                aria-invalid={Boolean(fieldErrors.content)}
                aria-describedby={
                  fieldErrors.content ? 'note-content-error' : undefined
                }
              />
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {wordCount(content)} word{wordCount(content) === 1 ? '' : 's'}
            </span>
            <span>
              {plainTextContent.length.toLocaleString()}/
              {CONTENT_MAX.toLocaleString()} characters
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
