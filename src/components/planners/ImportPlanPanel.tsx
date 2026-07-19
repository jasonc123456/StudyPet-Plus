'use client';

import { useRef, useState } from 'react';

import {
  GenerationProgress,
  useGenerationProgress,
} from '@/components/common/GenerationProgress';
import { consumeGenerationStream } from '@/lib/generation-stream';
import type { PlannerImportDraft } from '@/lib/validators';
import {
  isSupportedPlanImportFile,
  readPlanImportFileAsText,
  sanitizePlanImportText,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from '@/lib/planner-import-file';

export type ImportPlanResult = {
  coursesCreated: number;
  sectionsCreated: number;
};

type ImportPlannerOption = {
  id: string;
  title: string;
};

type ImportPlanPanelProps = {
  plannerId: string | null;
  plannerTitle?: string;
  planners?: ImportPlannerOption[];
  onSelectPlanner?: (plannerId: string) => void;
  disabled?: boolean;
  onImported: (result: ImportPlanResult) => void;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function providerLabel(provider: string) {
  if (provider === 'local') return 'StudyPet+ AI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'deepseek') return 'DeepSeek';
  if (provider === 'demo') return 'demo mode';
  if (provider === 'local-parser') return 'local text parser';
  return provider;
}

export function ImportPlanPanel({
  plannerId,
  plannerTitle,
  planners = [],
  onSelectPlanner,
  disabled = false,
  onImported,
}: ImportPlanPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlannerImportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const progress = useGenerationProgress();

  const hasPlanner = Boolean(plannerId);
  const canParse =
    hasPlanner &&
    text.trim().length > 0 &&
    !parsing &&
    !confirming &&
    !disabled;

  function resetImport() {
    setDraft(null);
    setError(null);
    setStatus(null);
    setParsing(false);
    setConfirming(false);
  }

  function closePanel() {
    setOpen(false);
    setText('');
    setFileName(null);
    resetImport();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleFileChange(file: File | null) {
    setError(null);
    setDraft(null);
    setStatus(null);

    if (!file) {
      setFileName(null);
      return;
    }

    if (!isSupportedPlanImportFile(file.name)) {
      setError(UNSUPPORTED_FILE_TYPE_MESSAGE);
      setFileName(null);
      setText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const content = await readPlanImportFileAsText(file);
      setText(content);
      setFileName(file.name);
      setStatus(
        file.name.toLowerCase().endsWith('.xlsx')
          ? 'Spreadsheet converted to plain text (no macros or formulas run). Review below, then parse with AI.'
          : 'File loaded as plain text. Review below, then parse with AI.'
      );
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : 'Could not read that file. Try pasting the text instead.'
      );
      setFileName(null);
      setText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleParse() {
    if (!plannerId) {
      setError('Create or select a planner before importing.');
      return;
    }

    const trimmed = sanitizePlanImportText(text);
    if (!trimmed) {
      setError('Paste or upload plan text before parsing.');
      return;
    }
    setText(trimmed);

    setError(null);
    setStatus(null);
    setDraft(null);
    setParsing(true);
    progress.begin();

    try {
      const data = await consumeGenerationStream<{
        draft?: PlannerImportDraft;
        provider?: string;
        stats?: { keptCourses?: number; ignoredRows?: number };
      }>(
        '/api/course-planners/import',
        { text: trimmed, plannerId },
        progress.update
      );

      if (!data?.draft || data.draft.sections.length === 0) {
        setError('No courses detected.');
        return;
      }

      const parsedWith = data.provider ? providerLabel(data.provider) : null;
      const kept = data.stats?.keptCourses;
      const ignored = data.stats?.ignoredRows;
      const filterNote =
        typeof kept === 'number' && typeof ignored === 'number' && ignored > 0
          ? ` Filtered out non-course form text and only included likely planned courses. Imported ${kept} possible course${kept === 1 ? '' : 's'}. Ignored ${ignored} non-course row${ignored === 1 ? '' : 's'}.`
          : ' Filtered out non-course form text and only included likely planned courses.';
      setDraft(data.draft);
      setStatus(
        (parsedWith ? `Parsed with ${parsedWith}.` : 'Parsed successfully.') +
          filterNote +
          ' Review below, then save to planner.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse course plan. Please try again.'
      );
    } finally {
      progress.end();
      setParsing(false);
    }
  }

  function removeSection(index: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        sections: current.sections.filter((_, i) => i !== index),
      };
    });
  }

  function removeCourse(sectionIndex: number, courseIndex: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        sections: current.sections
          .map((section, i) => {
            if (i !== sectionIndex) return section;
            return {
              ...section,
              courses: section.courses.filter((_, j) => j !== courseIndex),
            };
          })
          .filter((section) => section.courses.length > 0),
      };
    });
  }

  async function handleConfirm() {
    if (!plannerId || !draft || draft.sections.length === 0) {
      setError('Nothing to import. Parse a plan first.');
      return;
    }

    setError(null);
    setStatus(null);
    setConfirming(true);

    try {
      const res = await fetch('/api/course-planners/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plannerId,
          sections: draft.sections,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        coursesCreated?: number;
        sectionsCreated?: number;
      } | null;

      if (!res.ok) {
        setError(data?.error ?? 'Failed to save imported courses');
        return;
      }

      const coursesCreated = data?.coursesCreated ?? 0;
      const sectionsCreated = data?.sectionsCreated ?? 0;
      closePanel();
      onImported({ coursesCreated, sectionsCreated });
    } catch {
      setError('Network error — please try again');
    } finally {
      setConfirming(false);
    }
  }

  const courseCount =
    draft?.sections.reduce(
      (total, section) => total + section.courses.length,
      0
    ) ?? 0;

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Import plan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paste an education plan or upload a supported export. Files are
            converted to plain text before AI parsing — nothing is executed, and
            nothing is saved until you confirm.
            {plannerTitle
              ? ` Imports into “${plannerTitle}”.`
              : planners.length === 0
                ? ' Create a planner first, then come back here.'
                : ' Choose which planner to import into below.'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Supported: .txt, .csv, .xlsx (max 2 MB). Not supported: PDFs,
            screenshots, macro-enabled spreadsheets (.xlsm), or legacy .xls.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (open) {
              closePanel();
            } else {
              setOpen(true);
              setError(null);
            }
          }}
          className="btn-secondary shrink-0"
        >
          {open ? 'Close import' : 'Import plan'}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          {planners.length > 0 ? (
            <div>
              <label
                htmlFor="planner-import-target"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Import into planner
              </label>
              <select
                id="planner-import-target"
                className={inputClass}
                value={plannerId ?? ''}
                disabled={parsing || confirming || disabled || !onSelectPlanner}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (nextId && onSelectPlanner) {
                    onSelectPlanner(nextId);
                    setDraft(null);
                    setError(null);
                  }
                }}
              >
                {!plannerId ? (
                  <option value="">Select a planner…</option>
                ) : null}
                {planners.map((planner) => (
                  <option key={planner.id} value={planner.id}>
                    {planner.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Create a planner above before parsing. Import needs a target
              planner to save into.
            </p>
          )}

          {!hasPlanner && planners.length > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Select a planner above (or in the Planners list) to enable Parse
              with AI.
            </p>
          ) : null}

          <div>
            <label
              htmlFor="planner-import-text"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Plan text
            </label>
            <textarea
              id="planner-import-text"
              rows={draft ? 4 : 10}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (draft) {
                  setDraft(null);
                  setStatus(null);
                }
              }}
              placeholder={`Fall 2026\nCSE 102 Introduction to Algorithms, 5 units\nCSE 16 Discrete Math, 5 units\n\nSpring 2027\nCSE 130 Principles of Computer Systems, 5 units`}
              className={inputClass}
              disabled={parsing || confirming || disabled}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Tip: upload a .xlsx / .csv / .txt export, or paste rows directly.
              Spreadsheet cells are read as plain text only (formulas and macros
              are not run).
            </p>
          </div>

          {!draft ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.xlsx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) =>
                    void handleFileChange(e.target.files?.[0] ?? null)
                  }
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={parsing || confirming || disabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload .txt / .csv / .xlsx
                </button>
                {fileName ? (
                  <span className="text-sm text-slate-500">
                    Loaded: {fileName}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canParse}
                  title={
                    !hasPlanner
                      ? 'Select a planner first'
                      : text.trim().length === 0
                        ? 'Paste or upload plan text first'
                        : undefined
                  }
                  onClick={() => void handleParse()}
                >
                  {parsing ? 'Parsing…' : 'Parse with AI'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={parsing || confirming}
                  onClick={closePanel}
                >
                  Cancel
                </button>
                {!canParse && !parsing ? (
                  <span className="text-xs text-slate-500">
                    {!hasPlanner
                      ? 'Select a planner to enable parsing.'
                      : text.trim().length === 0
                        ? 'Add plan text to enable parsing.'
                        : null}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="space-y-4 border-t border-slate-200 pt-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Preview: {draft.sections.length} term
                {draft.sections.length === 1 ? '' : 's'}, {courseCount} course
                {courseCount === 1 ? '' : 's'}
                {plannerTitle ? ` → “${plannerTitle}”` : ''}. Existing planner
                classes stay; matching term names reuse the current section.
              </div>

              <div className="space-y-4">
                {draft.sections.map((section, sectionIndex) => (
                  <div
                    key={`${section.label}-${sectionIndex}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">
                        {section.label}
                      </h3>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                        onClick={() => removeSection(sectionIndex)}
                        disabled={confirming}
                      >
                        Remove term
                      </button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {section.courses.map((course, courseIndex) => (
                        <li
                          key={`${course.title}-${courseIndex}`}
                          className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                              {course.courseNumber
                                ? `${course.courseNumber} · `
                                : ''}
                              {course.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {[
                                course.units !== null &&
                                course.units !== undefined
                                  ? `${course.units} units`
                                  : null,
                                course.professor,
                                course.lectureDays,
                                course.lectureTime,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'No extra details'}
                            </p>
                            {course.notes ? (
                              <p className="mt-1 text-xs text-slate-500">
                                {course.notes}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                            onClick={() =>
                              removeCourse(sectionIndex, courseIndex)
                            }
                            disabled={confirming}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {courseCount === 0 ? (
                <p className="text-sm text-slate-500">
                  No courses left in the draft. Parse again or cancel.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={confirming || courseCount === 0 || !plannerId}
                  onClick={() => void handleConfirm()}
                >
                  {confirming ? 'Saving…' : 'Save to planner'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={confirming}
                  onClick={() => {
                    resetImport();
                  }}
                >
                  Edit source
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={confirming}
                  onClick={closePanel}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {status ? (
            <p className="rounded-lg bg-mint-50 px-3 py-2 text-sm text-mint-800">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <GenerationProgress
            state={progress.state}
            noun="course plan"
            source="your course plan"
            sourcePlural="plans"
          />
        </div>
      ) : null}
    </section>
  );
}
