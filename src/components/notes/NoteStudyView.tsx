'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

type HighlightRange = {
  start: number;
  end: number;
  color: HighlightColor;
};

type NoteStudyViewProps = {
  noteId: string;
  content: string;
};

const STORAGE_KEY_PREFIX = 'study-note-highlights:';

const HIGHLIGHT_STYLES: Record<
  HighlightColor,
  { label: string; swatch: string; textClass: string }
> = {
  yellow: {
    label: 'Yellow',
    swatch: 'bg-amber-200 border-amber-300',
    textClass: 'bg-amber-200/80',
  },
  green: {
    label: 'Green',
    swatch: 'bg-emerald-200 border-emerald-300',
    textClass: 'bg-emerald-200/80',
  },
  blue: {
    label: 'Blue',
    swatch: 'bg-sky-200 border-sky-300',
    textClass: 'bg-sky-200/80',
  },
  pink: {
    label: 'Pink',
    swatch: 'bg-rose-200 border-rose-300',
    textClass: 'bg-rose-200/80',
  },
};

function storageKey(noteId: string) {
  return `${STORAGE_KEY_PREFIX}${noteId}`;
}

function normalizeRanges(ranges: HighlightRange[]): HighlightRange[] {
  return ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function textOffsetForNode(
  root: HTMLElement,
  targetNode: Node,
  nodeOffset: number
): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let total = 0;

  while (current) {
    const textLength = current.textContent?.length ?? 0;
    if (current === targetNode) {
      return total + nodeOffset;
    }
    total += textLength;
    current = walker.nextNode();
  }

  return null;
}

function applyHighlightRange(
  ranges: HighlightRange[],
  start: number,
  end: number,
  color: HighlightColor
): HighlightRange[] {
  const next: HighlightRange[] = [];

  for (const range of ranges) {
    if (range.end <= start || range.start >= end) {
      next.push(range);
      continue;
    }

    if (range.start < start) {
      next.push({ ...range, end: start });
    }

    if (range.end > end) {
      next.push({ ...range, start: end });
    }
  }

  next.push({ start, end, color });
  return normalizeRanges(next);
}

function buildSegments(content: string, ranges: HighlightRange[]) {
  if (!content) return [];

  const boundaries = new Set<number>([0, content.length]);
  for (const range of ranges) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const segments: Array<{
    key: string;
    text: string;
    color: HighlightColor | null;
  }> = [];

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const start = sortedBoundaries[index];
    const end = sortedBoundaries[index + 1];
    if (start === end) continue;

    const text = content.slice(start, end);
    const color =
      [...ranges]
        .reverse()
        .find((range) => range.start <= start && range.end >= end)?.color ??
      null;

    segments.push({
      key: `${start}-${end}-${color ?? 'plain'}`,
      text,
      color,
    });
  }

  return segments;
}

export function NoteStudyView({ noteId, content }: NoteStudyViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlights, setHighlights] = useState<HighlightRange[]>([]);
  const [history, setHistory] = useState<HighlightRange[][]>([]);
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow');
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(storageKey(noteId));
      if (!saved) {
        setHighlights([]);
        return;
      }

      const parsed = JSON.parse(saved) as HighlightRange[];
      setHighlights(normalizeRanges(parsed));
    } catch {
      setHighlights([]);
    }
  }, [noteId]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(storageKey(noteId), JSON.stringify(highlights));
  }, [highlights, mounted, noteId]);

  const segments = useMemo(
    () => buildSegments(content, highlights),
    [content, highlights]
  );

  const hasSelectedRange = selectionRange !== null;
  const canUndo = history.length > 0;

  function saveHistorySnapshot(nextHighlights: HighlightRange[]) {
    setHistory((current) => [...current.slice(-19), highlights]);
    setHighlights(nextHighlights);
  }

  function clearSelection() {
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  }

  function syncSelection() {
    const root = containerRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) {
      setSelectionRange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      setSelectionRange(null);
      return;
    }

    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      setSelectionRange(null);
      return;
    }

    const startOffset = textOffsetForNode(
      root,
      range.startContainer,
      range.startOffset
    );
    const endOffset = textOffsetForNode(
      root,
      range.endContainer,
      range.endOffset
    );

    if (
      startOffset === null ||
      endOffset === null ||
      startOffset === endOffset
    ) {
      setSelectionRange(null);
      return;
    }

    setSelectionRange({
      start: Math.min(startOffset, endOffset),
      end: Math.max(startOffset, endOffset),
    });
  }

  function handleApplyHighlight() {
    if (!selectionRange) return;

    saveHistorySnapshot(
      applyHighlightRange(
        highlights,
        selectionRange.start,
        selectionRange.end,
        activeColor
      )
    );
    clearSelection();
  }

  function handleRemoveSelectedHighlight() {
    if (!selectionRange) return;

    const nextHighlights = normalizeRanges(
      highlights.flatMap((range) => {
        if (
          range.end <= selectionRange.start ||
          range.start >= selectionRange.end
        ) {
          return [range];
        }

        const trimmed: HighlightRange[] = [];

        if (range.start < selectionRange.start) {
          trimmed.push({ ...range, end: selectionRange.start });
        }

        if (range.end > selectionRange.end) {
          trimmed.push({ ...range, start: selectionRange.end });
        }

        return trimmed;
      })
    );

    saveHistorySnapshot(nextHighlights);
    clearSelection();
  }

  const handleUndo = useCallback(() => {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) {
        return current;
      }

      setHighlights(previous);
      return current.slice(0, -1);
    });
    clearSelection();
  }, []);

  function handleClearHighlights() {
    saveHistorySnapshot([]);
    clearSelection();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z';

      if (!isUndoShortcut || history.length === 0) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      handleUndo();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, history.length]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Study mode</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select any part of the note, choose a highlighter color, then
              apply it. Highlights are saved locally on this device for this
              note.
            </p>
          </div>

          <div
            ref={containerRef}
            className="min-h-[20rem] rounded-3xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-[15px] leading-8 text-slate-800 whitespace-pre-wrap"
            onMouseUp={syncSelection}
            onKeyUp={syncSelection}
          >
            {segments.length === 0 ? (
              <p className="text-sm italic text-slate-500">
                No note content yet.
              </p>
            ) : (
              segments.map((segment) =>
                segment.color ? (
                  <mark
                    key={segment.key}
                    className={`${HIGHLIGHT_STYLES[segment.color].textClass} rounded px-0.5 text-inherit`}
                  >
                    {segment.text}
                  </mark>
                ) : (
                  <span key={segment.key}>{segment.text}</span>
                )
              )
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Highlighter
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(HIGHLIGHT_STYLES) as HighlightColor[]).map(
                (color) => {
                  const isActive = activeColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setActiveColor(color)}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'border-slate-900 text-slate-900 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border ${HIGHLIGHT_STYLES[color].swatch}`}
                        aria-hidden
                      />
                      {HIGHLIGHT_STYLES[color].label}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleApplyHighlight}
                disabled={!hasSelectedRange}
                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply highlight
              </button>
              <button
                type="button"
                onClick={handleRemoveSelectedHighlight}
                disabled={!hasSelectedRange}
                className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Unhighlight selected
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Undo highlight
              </button>
              <button
                type="button"
                onClick={handleClearHighlights}
                disabled={highlights.length === 0}
                className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-500">
              <p>
                {selectionRange
                  ? `Selected ${selectionRange.end - selectionRange.start} character${
                      selectionRange.end - selectionRange.start === 1 ? '' : 's'
                    }.`
                  : 'Select some text in the note to highlight or unhighlight it.'}
              </p>
              <p>
                Press{' '}
                <span className="font-semibold text-slate-700">Cmd+Z</span> or{' '}
                <span className="font-semibold text-slate-700">Ctrl+Z</span> to
                undo the last highlight change.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
