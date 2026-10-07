import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const { uploadFileMock } = vi.hoisted(() => ({ uploadFileMock: vi.fn() }));
vi.mock('@/shared/api/uploads-api.ts', () => ({ uploadFile: uploadFileMock }));

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet.tsx';
import {
  UPLOAD_ROW_LEAVE_MS,
  useUploadQueueStore,
} from '@/shared/store/useUploadQueueStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { UploadTray } from './UploadTray.tsx';

/** One storage write the test settles by hand. */
interface PendingUpload {
  onProgress: (fraction: number) => void;
  succeed: (key: string) => void;
  fail: (error: unknown) => void;
}

let uploads: PendingUpload[] = [];

function upload(index: number): PendingUpload {
  const pending = uploads[index];
  if (!pending) throw new Error(`upload ${index} was never started`);
  return pending;
}

/** Let the promise chains behind a settled write run, inside act. */
async function flush() {
  await act(async () => {
    for (let hop = 0; hop < 20; hop += 1) await Promise.resolve();
  });
}

function file(name: string, type: string, size: number) {
  const made = new File(['x'], name, { type });
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

const MEGABYTE = 1024 * 1024;

function queue(files: File[], onUploaded: () => unknown = vi.fn()) {
  act(() => {
    useUploadQueueStore
      .getState()
      .add(files, { onUploaded: onUploaded as () => void }, 'org_a');
  });
}

async function renderTray() {
  const view = renderWithProviders(<UploadTray />);
  await screen.findByTestId('upload-tray-status');
  return view;
}

function tray() {
  return screen.getByTestId('upload-tray');
}

function rowFor(name: string) {
  const found = screen
    .getAllByTestId('upload-tray-row')
    .find((row) => within(row).queryByText(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
}

beforeEach(() => {
  vi.resetAllMocks();
  useUploadQueueStore.getState().clear();
  uploads = [];
  uploadFileMock.mockImplementation(
    (input: { onProgress: (fraction: number) => void }) =>
      new Promise<{ key: string }>((resolve, reject) => {
        uploads.push({
          onProgress: input.onProgress,
          succeed: (key) => resolve({ key }),
          fail: reject,
        });
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UploadTray', () => {
  it('is closed while nothing is queued, keeping only its empty status region', async () => {
    const { container } = await renderTray();

    expect(screen.queryByTestId('upload-tray')).toBeNull();
    expect(screen.getByTestId('upload-tray-status')).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens on "Uploading <left> of <total>…" with a row per file', async () => {
    const { container } = await renderTray();
    queue([
      file('scalp.jpg', 'image/jpeg', 2 * MEGABYTE),
      file('report.pdf', 'application/pdf', 4096),
    ]);

    expect(tray()).toHaveAccessibleName('Uploads');
    expect(within(tray()).getByText('Uploading 2 of 2…')).toBeInTheDocument();
    // The status region carries the announcement; the visible header stays plain text.
    expect(screen.getByTestId('upload-tray-status')).toHaveTextContent(
      'Uploading 2 of 2…',
    );
    expect(screen.getAllByTestId('upload-tray-row')).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: 'scalp.jpg' })).toBeInTheDocument();
    expect(within(rowFor('scalp.jpg')).getByText('0%')).toBeInTheDocument();
    // A photo gets the camera on blush; anything else the file icon on stone.
    expect(rowFor('scalp.jpg').querySelector('.bg-tone-blush')).not.toBeNull();
    expect(rowFor('report.pdf').querySelector('.bg-tone-stone')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('turns "<n>%" into "✓ <size>" and the bar green when a file is done', async () => {
    await renderTray();
    queue([
      file('scalp.jpg', 'image/jpeg', Math.ceil(1.2 * MEGABYTE)),
      file('note.pdf', 'application/pdf', 84 * 1024),
    ]);

    act(() => upload(0).onProgress(0.42));
    expect(within(rowFor('scalp.jpg')).getByText('42%')).toBeInTheDocument();

    upload(0).succeed('organization-files/org_a/scalp.jpg');
    await flush();
    const done = rowFor('scalp.jpg');
    expect(done).toHaveAttribute('data-status', 'done');
    expect(within(done).getByText('1.2 MB')).toBeInTheDocument();
    expect(within(done).getByRole('progressbar').className).toContain('bg-success');
    expect(within(tray()).getByText('Uploading 1 of 2…')).toBeInTheDocument();

    upload(1).succeed('organization-files/org_a/note.pdf');
    await flush();
    expect(within(rowFor('note.pdf')).getByText('84 KB')).toBeInTheDocument();
    expect(within(tray()).getByText('All uploads complete')).toBeInTheDocument();
    expect(screen.getByTestId('upload-tray-status')).toHaveTextContent(
      'All uploads complete',
    );
  });

  it('lets a finished row leave after 1,400ms and closes when nothing is left', async () => {
    await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);
    vi.useFakeTimers();
    upload(0).succeed('organization-files/org_a/scalp.jpg');
    await flush();

    act(() => vi.advanceTimersByTime(UPLOAD_ROW_LEAVE_MS - 1));
    expect(tray()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('upload-tray')).toBeNull();
    expect(screen.getByTestId('upload-tray-status')).toBeEmptyDOMElement();
  });

  it('names a failed upload and offers Retry, which runs it again', async () => {
    const { container } = await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);

    upload(0).fail(new TypeError('Network request failed'));
    await flush();

    const failed = rowFor('scalp.jpg');
    expect(failed).toHaveAttribute('data-status', 'failed');
    expect(within(failed).getByText('Couldn’t upload')).toBeInTheDocument();
    // Never "All uploads complete" over a failure (house rule 3).
    expect(within(tray()).getByText('1 upload failed')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(within(failed).getByRole('button', { name: 'Retry scalp.jpg' }));

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    expect(rowFor('scalp.jpg')).toHaveAttribute('data-status', 'uploading');
    expect(within(tray()).getByText('Uploading 1 of 1…')).toBeInTheDocument();
  });

  it('says so when the upload landed but attaching it failed', async () => {
    await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)], () =>
      Promise.reject(new Error('409')),
    );

    upload(0).succeed('organization-files/org_a/scalp.jpg');
    await flush();

    expect(within(rowFor('scalp.jpg')).getByText('Couldn’t attach')).toBeInTheDocument();
  });

  it('drops a failed row on Remove and closes when it was the last', async () => {
    await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);
    upload(0).fail(new Error('boom'));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Remove scalp.jpg' }));

    expect(screen.queryByTestId('upload-tray')).toBeNull();
  });

  it('collapses to its header and expands again', async () => {
    await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);

    const toggle = screen.getByTestId('upload-tray-toggle');
    const list = within(tray()).getByRole('list');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', list.id);
    expect(toggle).toHaveAccessibleName('Hide uploads');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Show uploads');
    expect(list).not.toBeVisible();
    // The header keeps reporting while the list is folded away.
    expect(within(tray()).getByText('Uploading 1 of 1…')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(list).toBeVisible();
  });

  // jsdom evaluates neither `calc()` nor `:has()`, so this pins the contract the stylesheet
  // fills in (`bottom-stack-css.test.ts` pins the publishing side): the tray adds the tab bar,
  // a showing notice pill and a mounted floating "New", plus the safe area, on a phone.
  it('rides the phone bottom stack at the inline-end corner, under the toasts', async () => {
    await renderTray();
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);

    const classes = tray().className.split(/\s+/);
    expect(classes).toContain(
      'bottom-[calc(var(--floating-bottom-offset,0rem)+env(safe-area-inset-bottom,0px)+var(--floating-notice-height,0px)+var(--floating-fab-height,0px)+1.25rem)]',
    );
    expect(classes).toEqual(expect.arrayContaining(['fixed', 'end-5', 'z-[95]']));
    // 320px, but never wider than the screen minus both 20px gutters.
    expect(classes).toContain('w-[min(20rem,calc(100vw-2.5rem))]');
    expect(tray()).toHaveAttribute('data-slot', 'upload-tray');
  });

  it('is usable over an open modal: a press on it is never the modal’s outside press', async () => {
    const onOpenChange = vi.fn();
    // The record drawer's own primitive, open as the drawer holding the draft.
    renderWithProviders(
      <>
        <Sheet open onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>New patient</SheetTitle>
            <SheetDescription>Drawer stand-in</SheetDescription>
          </SheetContent>
        </Sheet>
        <UploadTray />
      </>,
    );
    await screen.findByTestId('upload-tray-status');
    queue([file('scalp.jpg', 'image/jpeg', 2048)]);
    expect(tray()).toHaveClass('pointer-events-auto');

    // jsdom applies no stylesheet, so it cannot see `pointer-events-auto` win over the
    // modal's inline `pointer-events: none` on the body; the class is asserted above.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(screen.getByTestId('upload-tray-toggle'));
    expect(screen.getByTestId('upload-tray-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
