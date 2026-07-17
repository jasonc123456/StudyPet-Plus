/**
 * Characterization tests for CreateFlashcardsPanel.
 * Locks current observable behavior before any complexity refactor.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

vi.mock('@/app/actions/flashcard-actions', () => ({
  createFlashcardsFromPasteAction: vi.fn(),
  generateFlashcardsAction: vi.fn(),
}));

import {
  createFlashcardsFromPasteAction,
  generateFlashcardsAction,
} from '@/app/actions/flashcard-actions';
import {
  CreateFlashcardsPanel,
  type NoteOption,
} from '@/components/flashcards/CreateFlashcardsPanel';

const createFromPasteMock = vi.mocked(createFlashcardsFromPasteAction);
const generateFromNoteMock = vi.mocked(generateFlashcardsAction);

const NOTES_WITH_CARDS: NoteOption[] = [
  { id: 'note_1', title: 'Biology midterm', cardCount: 5 },
  { id: 'note_2', title: 'Empty set note', cardCount: 0 },
  { id: 'note_3', title: 'Untitled count' },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPanel(
  props: Partial<ComponentProps<typeof CreateFlashcardsPanel>> = {}
) {
  const onGenerated = props.onGenerated ?? vi.fn();
  const result = render(
    <CreateFlashcardsPanel
      notes={props.notes ?? NOTES_WITH_CARDS}
      defaultExpanded={props.defaultExpanded ?? true}
      onGenerated={onGenerated}
    />
  );
  return { ...result, onGenerated };
}

describe('CreateFlashcardsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    refreshMock.mockReset();
    createFromPasteMock.mockReset();
    generateFromNoteMock.mockReset();
  });

  describe('collapsed default (defaultExpanded=false)', () => {
    it('renders the collapsed prompt and New set button without the form', () => {
      renderPanel({ defaultExpanded: false });

      expect(
        screen.getByText(
          'Study your sets below, or create another set from notes.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'New set' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Create flashcards' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Generate flashcards' })
      ).not.toBeInTheDocument();
    });

    it('expands into the create form when New set is clicked', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: false });

      await user.click(screen.getByRole('button', { name: 'New set' }));

      expect(
        screen.getByRole('heading', { name: 'Create flashcards' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Collapse' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Paste notes below to create a new note and generate cards.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('expanded default (defaultExpanded=true)', () => {
    it('renders headings, helper text, controls, and enabled generate button', () => {
      renderPanel({ defaultExpanded: true });

      expect(
        screen.getByRole('heading', { name: 'Create flashcards' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Paste notes below to create a new note and generate cards.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Generate from existing saved note (optional)')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Title (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Paste notes')).toBeInTheDocument();
      expect(screen.getByLabelText('Number of cards')).toHaveValue(10);
      expect(
        screen.getByRole('button', { name: 'Generate flashcards' })
      ).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: 'Collapse' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      ).not.toBeInTheDocument();
    });

    it('lists note options including card counts when notes are present', () => {
      renderPanel({ defaultExpanded: true });

      const select = screen.getByLabelText(
        'Generate from existing saved note (optional)'
      );
      expect(
        within(select).getByRole('option', { name: '— Paste notes instead —' })
      ).toBeInTheDocument();
      expect(
        within(select).getByRole('option', {
          name: 'Biology midterm (5 cards)',
        })
      ).toBeInTheDocument();
      expect(
        within(select).getByRole('option', { name: 'Empty set note' })
      ).toBeInTheDocument();
      expect(
        within(select).getByRole('option', { name: 'Untitled count' })
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          'No saved notes yet. Paste text below or create a note first.'
        )
      ).not.toBeInTheDocument();
    });

    it('shows empty-notes guidance when notes array is empty', () => {
      renderPanel({ defaultExpanded: true, notes: [] });

      const select = screen.getByLabelText(
        'Generate from existing saved note (optional)'
      );
      expect(within(select).getByText('No saved notes yet')).toBeDisabled();
      expect(
        screen.getByText(
          'No saved notes yet. Paste text below or create a note first.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('collapse / expand interactions', () => {
    it('collapses the form when Collapse is clicked (defaultExpanded=false)', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: false });

      await user.click(screen.getByRole('button', { name: 'New set' }));
      await user.click(screen.getByRole('button', { name: 'Collapse' }));

      expect(
        screen.queryByRole('heading', { name: 'Create flashcards' })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'New set' })
      ).toBeInTheDocument();
    });
  });

  describe('conditional UI for existing note selection', () => {
    it('hides paste fields and updates helper text when a note is selected', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_2'
      );

      expect(
        screen.getByText('Generating from the selected saved note content.')
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText('Title (optional)')
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Paste notes')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      ).not.toBeInTheDocument();
    });

    it('shows replace checkbox only when selected note already has cards', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_1'
      );

      expect(
        screen.getByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      ).not.toBeChecked();
    });

    it('restores paste fields when selection returns to paste mode', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      const select = screen.getByLabelText(
        'Generate from existing saved note (optional)'
      );
      await user.selectOptions(select, 'note_1');
      await user.selectOptions(select, '');

      expect(screen.getByLabelText('Title (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Paste notes')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Paste notes below to create a new note and generate cards.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows an alert when submitting paste mode with empty content', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Paste some notes before generating flashcards.'
      );
      expect(createFromPasteMock).not.toHaveBeenCalled();
      expect(generateFromNoteMock).not.toHaveBeenCalled();
    });

    it('shows an alert when content is only whitespace', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), '   \n\t  ');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Paste some notes before generating flashcards.'
      );
      expect(createFromPasteMock).not.toHaveBeenCalled();
    });

    it('clears the validation error when the user edits paste content', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Paste notes'), 'Some notes');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears an error when switching to an existing note', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_2'
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('user input updates', () => {
    it('updates title, paste content, and clamps card count into 1–20', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      const title = screen.getByLabelText('Title (optional)');
      const paste = screen.getByLabelText('Paste notes');
      const countInput = screen.getByLabelText('Number of cards');

      await user.clear(title);
      await user.type(title, 'My set');
      await user.clear(paste);
      await user.type(paste, 'Cell biology');
      expect(title).toHaveValue('My set');
      expect(paste).toHaveValue('Cell biology');

      // fireEvent.change matches the input's onChange contract (avoids
      // userEvent clear/type appending digits onto the clamped controlled value).
      fireEvent.change(countInput, { target: { value: '25' } });
      expect(countInput).toHaveValue(20);

      fireEvent.change(countInput, { target: { value: '0' } });
      expect(countInput).toHaveValue(1);

      fireEvent.change(countInput, { target: { value: 'not-a-number' } });
      expect(countInput).toHaveValue(1);
    });

    it('toggles the replace checkbox for a note that already has cards', async () => {
      const user = userEvent.setup();
      renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_1'
      );
      const checkbox = screen.getByRole('checkbox', {
        name: /Replace generated cards for this note/,
      });
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('successful paste generation', () => {
    it('calls createFlashcardsFromPasteAction, shows Gemini status, collapses, refreshes, and invokes onGenerated', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 3,
        provider: 'gemini',
        noteId: 'new_note',
      });

      const { onGenerated } = renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Title (optional)'), 'Chem');
      await user.type(
        screen.getByLabelText('Paste notes'),
        '  Atoms and bonds  '
      );
      fireEvent.change(screen.getByLabelText('Number of cards'), {
        target: { value: '5' },
      });
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(createFromPasteMock).toHaveBeenCalledWith({
          content: 'Atoms and bonds',
          title: 'Chem',
          count: 5,
        });
      });
      expect(generateFromNoteMock).not.toHaveBeenCalled();

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 3 flashcards with Gemini.'
      );
      expect(
        screen.getByRole('button', { name: 'New set' })
      ).toBeInTheDocument();
      expect(onGenerated).toHaveBeenCalledTimes(1);
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('omits empty title (passes undefined) and uses singular flashcard label for count 1', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 1,
        provider: 'deepseek',
      });

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'One idea');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(createFromPasteMock).toHaveBeenCalledWith({
          content: 'One idea',
          title: undefined,
          count: 10,
        });
      });

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 1 flashcard with DeepSeek.'
      );
    });

    it('shows the demo-mode success copy for provider demo', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 2,
        provider: 'demo',
      });

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Demo notes');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Saved 2 flashcards in demo mode (not AI). Set AI_DEMO_MODE=false and GEMINI_API_KEY for real cards.'
      );
    });

    it('shows a generic success message for unknown providers', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 4,
        provider: 'other-provider',
      });

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Notes');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 4 flashcards.'
      );
    });

    it('clears the collapsed status when expanding via New set after success', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 2,
        provider: 'gemini',
      });

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Notes');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );
      expect(await screen.findByRole('status')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'New set' }));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Create flashcards' })
      ).toBeInTheDocument();
    });
  });

  describe('successful note generation', () => {
    it('calls generateFlashcardsAction with replaceGenerated false when note has no cards', async () => {
      const user = userEvent.setup();
      generateFromNoteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 8,
        provider: 'gemini',
      });

      const { onGenerated } = renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_2'
      );
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(generateFromNoteMock).toHaveBeenCalledWith('note_2', 10, false);
      });
      expect(createFromPasteMock).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 8 flashcards with Gemini.'
      );
      expect(onGenerated).toHaveBeenCalledTimes(1);
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('passes replaceGenerated true when the checkbox is checked for a note with cards', async () => {
      const user = userEvent.setup();
      generateFromNoteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 5,
        provider: 'gemini',
      });

      renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_1'
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      );
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(generateFromNoteMock).toHaveBeenCalledWith('note_1', 10, true);
      });
    });

    it('forces replaceGenerated false even if somehow checked when note has no cards', async () => {
      const user = userEvent.setup();
      generateFromNoteMock.mockResolvedValue({
        ok: true,
        flashcards: [],
        generatedCount: 1,
        provider: 'gemini',
      });

      renderPanel({ defaultExpanded: true });

      // Select a note with cards, check replace, then switch to a note without cards.
      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_1'
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      );
      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_2'
      );
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(generateFromNoteMock).toHaveBeenCalledWith('note_2', 10, false);
      });
    });
  });

  describe('loading / submitting state', () => {
    it('keeps the form open without a success status while the paste action is pending', async () => {
      const user = userEvent.setup();
      const pending = deferred<{
        ok: true;
        flashcards: [];
        generatedCount: number;
        provider: string;
      }>();
      createFromPasteMock.mockReturnValue(pending.promise);

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Pending notes');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      await waitFor(() => {
        expect(createFromPasteMock).toHaveBeenCalledTimes(1);
      });

      // React 18 useTransition does not keep isPending true across awaits in
      // startTransition(async () => ...), so "Generating…" is not reliably shown.
      expect(
        screen.getByRole('heading', { name: 'Create flashcards' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      pending.resolve({
        ok: true,
        flashcards: [],
        generatedCount: 2,
        provider: 'gemini',
      });

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 2 flashcards with Gemini.'
      );
    });

    it('invokes the paste action once per submit click while a request is in flight (isPending may already be false)', async () => {
      const user = userEvent.setup();
      const pending = deferred<{
        ok: true;
        flashcards: [];
        generatedCount: number;
        provider: string;
      }>();
      createFromPasteMock.mockReturnValue(pending.promise);

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Pending notes');
      const submit = screen.getByRole('button', {
        name: 'Generate flashcards',
      });
      await user.click(submit);

      await waitFor(() => {
        expect(createFromPasteMock).toHaveBeenCalledTimes(1);
      });

      // Characterizes current React 18 transition behavior: after the async
      // boundary, isPending is typically false, so a second click can fire again.
      await user.click(submit);
      expect(createFromPasteMock).toHaveBeenCalledTimes(2);

      pending.resolve({
        ok: true,
        flashcards: [],
        generatedCount: 2,
        provider: 'gemini',
      });
      await screen.findByRole('status');
    });
  });

  describe('error and retry', () => {
    it('shows the action error, keeps the form open, and does not refresh or call onGenerated', async () => {
      const user = userEvent.setup();
      createFromPasteMock.mockResolvedValue({
        ok: false,
        error:
          'AI generation is not configured. Set GEMINI_API_KEY on the server.',
        code: 'AI_ERROR',
      });

      const { onGenerated } = renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Paste notes'), 'Notes');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'AI generation is not configured. Set GEMINI_API_KEY on the server.'
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Create flashcards' })
      ).toBeInTheDocument();
      expect(onGenerated).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('retries the last paste payload without re-entering the form', async () => {
      const user = userEvent.setup();
      createFromPasteMock
        .mockResolvedValueOnce({
          ok: false,
          error: 'Flashcard generation failed. Please try again.',
        })
        .mockResolvedValueOnce({
          ok: true,
          flashcards: [],
          generatedCount: 2,
          provider: 'gemini',
        });

      renderPanel({ defaultExpanded: true });

      await user.type(screen.getByLabelText('Title (optional)'), 'Retry set');
      await user.type(screen.getByLabelText('Paste notes'), 'Retry content');
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(createFromPasteMock).toHaveBeenCalledTimes(2);
      });
      expect(createFromPasteMock).toHaveBeenLastCalledWith({
        content: 'Retry content',
        title: 'Retry set',
        count: 10,
      });
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 2 flashcards with Gemini.'
      );
    });

    it('retries the last note payload including replaceGenerated', async () => {
      const user = userEvent.setup();
      generateFromNoteMock
        .mockResolvedValueOnce({
          ok: false,
          error: 'Failed to generate flashcards. Please try again.',
        })
        .mockResolvedValueOnce({
          ok: true,
          flashcards: [],
          generatedCount: 3,
          provider: 'deepseek',
        });

      renderPanel({ defaultExpanded: true });

      await user.selectOptions(
        screen.getByLabelText('Generate from existing saved note (optional)'),
        'note_1'
      );
      await user.click(
        screen.getByRole('checkbox', {
          name: /Replace generated cards for this note/,
        })
      );
      await user.click(
        screen.getByRole('button', { name: 'Generate flashcards' })
      );

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => {
        expect(generateFromNoteMock).toHaveBeenCalledTimes(2);
      });
      expect(generateFromNoteMock).toHaveBeenLastCalledWith('note_1', 10, true);
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Generated 3 flashcards with DeepSeek.'
      );
    });
  });
});
