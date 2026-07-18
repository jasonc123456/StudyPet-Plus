/**
 * Tests for CreateFlashcardsPanel (multi-note + paste deck creation).
 * The panel posts to /api/flashcards/generate via consumeGenerationStream.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/lib/generation-stream', () => ({
  consumeGenerationStream: vi.fn(),
}));

import {
  CreateFlashcardsPanel,
  type FlashcardNoteOption,
} from '@/components/flashcards/CreateFlashcardsPanel';
import { consumeGenerationStream } from '@/lib/generation-stream';

const streamMock = vi.mocked(consumeGenerationStream);

const NOTES: FlashcardNoteOption[] = [
  {
    id: 'note_1',
    title: 'Biology midterm',
    hasContent: true,
    course: { id: 'course_1', name: 'Biology', color: '#16a34a' },
  },
  {
    id: 'note_2',
    title: 'Chemistry notes',
    hasContent: true,
    course: null,
  },
  {
    id: 'note_3',
    title: 'Empty note',
    hasContent: false,
    course: null,
  },
];

function renderPanel(
  props: Partial<ComponentProps<typeof CreateFlashcardsPanel>> = {}
) {
  return render(
    <CreateFlashcardsPanel
      notes={props.notes ?? NOTES}
      defaultExpanded={props.defaultExpanded ?? true}
      onGenerated={props.onGenerated ?? vi.fn()}
    />
  );
}

describe('CreateFlashcardsPanel', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    refreshMock.mockReset();
    streamMock.mockReset();
    streamMock.mockResolvedValue({ provider: 'local', generatedCount: 5 });
  });

  it('shows a collapsed prompt with a New deck button', () => {
    renderPanel({ defaultExpanded: false });

    expect(
      screen.getByRole('button', { name: 'New deck' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Create a deck' })
    ).not.toBeInTheDocument();
  });

  it('expands into the form when New deck is clicked', async () => {
    const user = userEvent.setup();
    renderPanel({ defaultExpanded: false });

    await user.click(screen.getByRole('button', { name: 'New deck' }));

    expect(
      screen.getByRole('heading', { name: 'Create a deck' })
    ).toBeInTheDocument();
  });

  it('only lists notes that have content', () => {
    renderPanel();

    expect(screen.getByText('Biology midterm')).toBeInTheDocument();
    expect(screen.getByText('Chemistry notes')).toBeInTheDocument();
    expect(screen.queryByText('Empty note')).not.toBeInTheDocument();
  });

  it('generates a deck from the selected notes', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText('Biology midterm'));
    await user.click(
      screen.getByRole('button', { name: 'Generate flashcards' })
    );

    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledWith(
        '/api/flashcards/generate',
        expect.objectContaining({ noteIds: ['note_1'] }),
        expect.anything()
      );
    });
  });

  it('blocks generation when no note is selected', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Generate flashcards' })
    );

    expect(streamMock).not.toHaveBeenCalled();
    expect(screen.getByText('Select at least one note.')).toBeInTheDocument();
  });

  it('generates from pasted text on the Paste tab', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Paste text' }));
    await user.type(
      screen.getByLabelText('Paste notes'),
      'Mitochondria is the powerhouse of the cell.'
    );
    await user.click(
      screen.getByRole('button', { name: 'Generate flashcards' })
    );

    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledWith(
        '/api/flashcards/generate',
        expect.objectContaining({
          content: 'Mitochondria is the powerhouse of the cell.',
        }),
        expect.anything()
      );
    });
  });

  it('refreshes after a successful generation', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    renderPanel({ onGenerated });

    await user.click(screen.getByText('Chemistry notes'));
    await user.click(
      screen.getByRole('button', { name: 'Generate flashcards' })
    );

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
      expect(onGenerated).toHaveBeenCalled();
    });
  });
});
