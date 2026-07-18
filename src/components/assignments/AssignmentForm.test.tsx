/**
 * Characterization tests for AssignmentForm.
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
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AssignmentForm } from '@/components/assignments/AssignmentForm';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

function errorResponse(body: unknown) {
  return {
    ok: false,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COURSES = [
  { id: 'course_1', name: 'Biology' },
  { id: 'course_2', name: 'Chemistry' },
];

describe('AssignmentForm', () => {
  describe('initial render — create mode with a fixed courseId', () => {
    it('renders title/details/due/status/type fields with defaults and no course selector', () => {
      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      // No course selector in fixed-courseId create mode.
      expect(screen.queryByLabelText('Course')).not.toBeInTheDocument();

      const title = screen.getByLabelText('Title') as HTMLInputElement;
      expect(title).toBeRequired();
      expect(title).toHaveValue('');
      expect(title).toHaveAttribute('maxLength', '200');

      expect(screen.getByLabelText(/Details/)).toHaveValue('');
      const due = screen.getByLabelText(/Due date/) as HTMLInputElement;
      expect(due).toHaveValue('');
      expect(due).toHaveAttribute('type', 'datetime-local');

      expect(screen.getByLabelText('Status')).toHaveValue('todo');
      expect(screen.getByLabelText('Type')).toHaveValue('homework');

      const submit = screen.getByRole('button', { name: 'Create assignment' });
      expect(submit).toBeEnabled();
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
        'href',
        '/cancel'
      );
    });
  });

  describe('initial render — create mode with a course selector', () => {
    it('renders the course select defaulting to the first course and lists all options', () => {
      render(
        <AssignmentForm
          mode="create"
          courses={COURSES}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      const select = screen.getByLabelText('Course') as HTMLSelectElement;
      expect(select).toHaveValue('course_1');
      expect(select).toBeRequired();
      expect(
        screen.getByRole('option', { name: 'Biology' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'Chemistry' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Create assignment' })
      ).toBeInTheDocument();
    });

    it('renders an option-less course selector when the courses list is empty', () => {
      render(
        <AssignmentForm
          mode="create"
          courses={[]}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      const select = screen.getByLabelText('Course');
      expect(select).toBeInTheDocument();
      expect(within(select).queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('initial render — edit mode', () => {
    it('prefills every field from initialValues and shows a Save changes button', () => {
      render(
        <AssignmentForm
          mode="edit"
          courseId="course_1"
          assignmentId="assignment_1"
          initialValues={{
            title: 'Existing paper',
            description: 'Write it up',
            dueAt: '2025-03-01T09:30',
            status: 'in_progress',
            type: 'project',
          }}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      expect(screen.getByLabelText('Title')).toHaveValue('Existing paper');
      expect(screen.getByLabelText(/Details/)).toHaveValue('Write it up');
      expect(screen.getByLabelText(/Due date/)).toHaveValue('2025-03-01T09:30');
      expect(screen.getByLabelText('Status')).toHaveValue('in_progress');
      expect(screen.getByLabelText('Type')).toHaveValue('project');
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Course')).not.toBeInTheDocument();
    });

    it('renders empty description and empty due date when initial values are null', () => {
      render(
        <AssignmentForm
          mode="edit"
          courseId="course_1"
          assignmentId="assignment_1"
          initialValues={{
            title: 'No extras',
            description: null,
            dueAt: null,
            status: 'todo',
            type: 'homework',
          }}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      expect(screen.getByLabelText(/Details/)).toHaveValue('');
      expect(screen.getByLabelText(/Due date/)).toHaveValue('');
    });
  });

  describe('field editing', () => {
    it('updates controlled inputs as the user edits them', async () => {
      const user = userEvent.setup();
      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Lab report');
      await user.type(screen.getByLabelText(/Details/), 'Due soon');
      await user.selectOptions(screen.getByLabelText('Status'), 'done');
      await user.selectOptions(screen.getByLabelText('Type'), 'exam');

      expect(screen.getByLabelText('Title')).toHaveValue('Lab report');
      expect(screen.getByLabelText(/Details/)).toHaveValue('Due soon');
      expect(screen.getByLabelText('Status')).toHaveValue('done');
      expect(screen.getByLabelText('Type')).toHaveValue('exam');
    });
  });

  describe('successful submission — create with fixed courseId', () => {
    it('POSTs the trimmed payload and navigates on success', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(okResponse());

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), '  Midterm  ');
      await user.type(screen.getByLabelText(/Details/), '  chapters 1-4  ');
      fireEvent.change(screen.getByLabelText(/Due date/), {
        target: { value: '2025-05-10T14:00' },
      });
      await user.selectOptions(screen.getByLabelText('Status'), 'in_progress');
      await user.selectOptions(screen.getByLabelText('Type'), 'exam');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/courses/course_1/assignments');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options.body)).toEqual({
        title: 'Midterm',
        description: 'chapters 1-4',
        dueAt: new Date('2025-05-10T14:00').toISOString(),
        status: 'in_progress',
        type: 'exam',
      });

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/success');
      });
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('sends null description and null dueAt when those fields are empty', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(okResponse());

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Reading');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        title: 'Reading',
        description: null,
        dueAt: null,
        status: 'todo',
        type: 'homework',
      });
    });
  });

  describe('successful submission — create with course selector', () => {
    it('POSTs to the selected course endpoint', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(okResponse());

      render(
        <AssignmentForm
          mode="create"
          courses={COURSES}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.selectOptions(screen.getByLabelText('Course'), 'course_2');
      await user.type(screen.getByLabelText('Title'), 'Quiz');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        '/api/courses/course_2/assignments'
      );
    });
  });

  describe('successful submission — edit mode', () => {
    it('PUTs to the assignment endpoint with the current values', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(okResponse());

      render(
        <AssignmentForm
          mode="edit"
          courseId="course_1"
          assignmentId="assignment_9"
          initialValues={{
            title: 'Original',
            description: 'Original details',
            dueAt: null,
            status: 'todo',
            type: 'homework',
          }}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Updated title');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/courses/course_1/assignments/assignment_9');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({
        title: 'Updated title',
        description: 'Original details',
        dueAt: null,
        status: 'todo',
        type: 'homework',
      });
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/success');
      });
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading / submitting state', () => {
    it('disables the submit button and shows Saving… while the request is in flight', async () => {
      const user = userEvent.setup();
      const pending = deferred<Response>();
      fetchMock.mockReturnValue(pending.promise);

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Pending');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      const savingButton = await screen.findByRole('button', {
        name: 'Saving…',
      });
      expect(savingButton).toBeDisabled();

      pending.resolve(okResponse());

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/success');
      });
    });
  });

  describe('failed submission', () => {
    it('shows the server-provided error and does not navigate', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(
        errorResponse({ error: 'Title already exists' })
      );

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Dupe');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      expect(
        await screen.findByText('Title already exists')
      ).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
      // saving is reset so the button becomes usable again.
      expect(
        screen.getByRole('button', { name: 'Create assignment' })
      ).toBeEnabled();
    });

    it('falls back to a generic error when the error body has no error field', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(errorResponse({}));

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Whatever');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      expect(
        await screen.findByText('Something went wrong')
      ).toBeInTheDocument();
    });

    it('falls back to a generic error when the error body cannot be parsed', async () => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('bad json')),
      } as unknown as Response);

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Whatever');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      expect(
        await screen.findByText('Something went wrong')
      ).toBeInTheDocument();
    });

    it('shows a network error message when the request rejects', async () => {
      const user = userEvent.setup();
      fetchMock.mockRejectedValue(new Error('offline'));

      render(
        <AssignmentForm
          mode="create"
          courseId="course_1"
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      await user.type(screen.getByLabelText('Title'), 'Whatever');
      await user.click(
        screen.getByRole('button', { name: 'Create assignment' })
      );

      expect(
        await screen.findByText('Network error — please try again')
      ).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  describe('course guard', () => {
    it('shows "Please select a course" and skips fetch when no course is resolved', () => {
      render(
        <AssignmentForm
          mode="create"
          courses={[]}
          cancelHref="/cancel"
          successHref="/success"
        />
      );

      fireEvent.submit(
        screen
          .getByRole('button', { name: 'Create assignment' })
          .closest('form')!
      );

      expect(screen.getByText('Please select a course')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
