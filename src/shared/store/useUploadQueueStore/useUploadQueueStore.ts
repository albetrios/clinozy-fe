import { create } from 'zustand';

import i18n from '@/lib/i18n/i18n.ts';
import { uploadFile } from '@/shared/api/uploads-api.ts';
import {
  UPLOAD_TRAY_KEYS,
  UPLOAD_TRAY_NS,
} from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** How many files move at once; the rest wait their turn at 0%. */
export const UPLOAD_CONCURRENCY = 3;

/** How long a finished row stays on "✓ <size>" before it leaves the tray (`_patterns.md:254`). */
export const UPLOAD_ROW_LEAVE_MS = 1400;

/** The two steps behind every row: move the bytes, then hand the confirmed key over. */
type UploadStep = 'upload' | 'attach';

/** Where a row is: waiting for a slot, moving bytes, being attached, finished, or stopped. */
type UploadRowStatus = 'queued' | 'uploading' | 'attaching' | 'done' | 'failed';

/** One file in the upload tray — view state only; the file itself never enters the store. */
export interface UploadRow {
  /** Stable for the row's life (keys the list, targets Retry and Remove). */
  id: string;
  name: string;
  /** Size in bytes, shown once the row is done ("✓ 1.2 MB"). */
  size: number;
  /** Images get the camera tile, everything else the file tile. */
  isImage: boolean;
  /** 0–99 while the bytes move; 100 only once the row is done. */
  progress: number;
  status: UploadRowStatus;
  /** The step that failed, so the row can name it and Retry resumes there. */
  failedStep: UploadStep | null;
}

/** What happens to each file once storage has confirmed it. */
export interface UploadTarget {
  /**
   * Attach the confirmed key — to a patient's photos, a report, a bill. The row reads done
   * only once this settles; a throw or rejection fails the row at the attach step, and Retry
   * calls this again with the same key instead of uploading the bytes a second time.
   */
  onUploaded: (key: string, file: File) => void | Promise<void>;
}

interface UploadQueueState {
  /** The tray's rows, oldest first. */
  rows: readonly UploadRow[];
  /** Done rows that already left since the tray opened; they still count toward the total. */
  departed: number;
  /** The tray shows only its header. */
  collapsed: boolean;
  /**
   * Queue files for the organization's storage. Files are taken as given — the size limit
   * and its "skipped" toast belong to `useUploadQueue`, which is how screens call this.
   */
  add: (
    files: readonly File[],
    target: UploadTarget,
    organizationId: string | undefined,
  ) => void;
  /** Run a failed row again from the step that failed; anything else is ignored. */
  retry: (id: string) => void;
  /** Drop a failed row the user has given up on; a moving row cannot be dropped. */
  dismiss: (id: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  /** Forget every row, job and timer — the session is over (and between tests). */
  clear: () => void;
}

interface UploadJob {
  file: File;
  target: UploadTarget;
  organizationId: string | undefined;
  /** Set once storage confirms, so a retry after a failed attach reuses it. */
  key: string | null;
}

/** The files and callbacks behind the rows, kept out of the store. */
const jobs = new Map<string, UploadJob>();
/** One leave timer per finished row. */
const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sequence = 0;

function isMoving(row: UploadRow): boolean {
  return row.status === 'uploading' || row.status === 'attaching';
}

function findRow(id: string): UploadRow | undefined {
  return useUploadQueueStore.getState().rows.find((row) => row.id === id);
}

function patchRow(id: string, patch: Partial<UploadRow>): void {
  useUploadQueueStore.setState((state) => ({
    rows: state.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  }));
}

/** Remove a row; the tray closes — and forgets its batch — once nothing is left. */
function removeRow(id: string, { departed }: { departed: boolean }): void {
  jobs.delete(id);
  useUploadQueueStore.setState((state) => {
    if (!state.rows.some((row) => row.id === id)) return state;
    const rows = state.rows.filter((row) => row.id !== id);
    if (rows.length === 0) return { rows, departed: 0, collapsed: false };
    return { rows, departed: departed ? state.departed + 1 : state.departed };
  });
}

/** Start the oldest queued rows until `UPLOAD_CONCURRENCY` are moving. */
function pump(): void {
  const { rows } = useUploadQueueStore.getState();
  let free = UPLOAD_CONCURRENCY - rows.filter(isMoving).length;
  for (const row of rows) {
    if (free <= 0) return;
    if (row.status !== 'queued') continue;
    free -= 1;
    // `runRow` marks the row moving before its first await, so it counts from here on.
    void runRow(row.id);
  }
}

/** Record how a row ended and let the next queued row take its slot. */
function settle(id: string, patch: Partial<UploadRow>): void {
  patchRow(id, patch);
  pump();
}

function reportProgress(id: string, fraction: number): void {
  const progress = Math.min(99, Math.floor(fraction * 100));
  const row = findRow(id);
  if (row?.status !== 'uploading' || row.progress === progress) return;
  patchRow(id, { progress });
}

function scheduleLeave(id: string): void {
  clearTimeout(leaveTimers.get(id));
  leaveTimers.set(
    id,
    setTimeout(() => {
      leaveTimers.delete(id);
      removeRow(id, { departed: true });
    }, UPLOAD_ROW_LEAVE_MS),
  );
}

/** The upload step: storage write plus confirm. Resolves to the key, or `null` once failed. */
async function storeBytes(id: string, job: UploadJob): Promise<string | null> {
  patchRow(id, { status: 'uploading', progress: 0, failedStep: null });
  try {
    const { key } = await uploadFile({
      file: job.file,
      purpose: 'organization-file',
      organizationId: job.organizationId,
      onProgress: (fraction) => reportProgress(id, fraction),
    });
    job.key = key;
    return key;
  } catch {
    settle(id, { status: 'failed', failedStep: 'upload' });
    return null;
  }
}

/**
 * One row, start to finish.
 *
 * @remarks
 * Each step owns its own failure (house rule 9): once storage has confirmed the bytes, a
 * failing attach reports itself as the attach and keeps the key, so a retry never stores the
 * same file twice. The row reads done only after the attach settles (rule 3).
 */
async function runRow(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  const key = job.key ?? (await storeBytes(id, job));
  // Failed (and said so), or cleared while the bytes moved — nothing to hand over.
  if (key === null || jobs.get(id) !== job) return;
  patchRow(id, { status: 'attaching', progress: 99, failedStep: null });
  try {
    await job.target.onUploaded(key, job.file);
  } catch {
    settle(id, { status: 'failed', failedStep: 'attach' });
    return;
  }
  settle(id, { status: 'done', progress: 100 });
  scheduleLeave(id);
}

/**
 * The shared upload tray's queue (KICKOFF §3.5, L-23).
 *
 * @remarks
 * A store rather than a mutation because uploads outlive the screen that started them: a
 * photo picked in a drawer keeps uploading after the drawer closes, and the tray that shows
 * it is mounted once by the app shell. That is also why the writes do not go through
 * `useAppMutation` — a component-scoped mutation dies with its component (house rule 10).
 * Rows hold view state only; the `File` and the caller's callback stay in a module map.
 * Uploads use clinozy-be's generic `organization-file` flow (`uploadFile`), at most
 * {@link UPLOAD_CONCURRENCY} at a time. Screens call it through `useUploadQueue`, which
 * applies the size limit.
 */
export const useUploadQueueStore = create<UploadQueueState>((set, get) => ({
  rows: [],
  departed: 0,
  collapsed: false,
  add: (files, target, organizationId) => {
    if (files.length === 0) return;
    const added = files.map((file): UploadRow => {
      sequence += 1;
      const id = `upload-${sequence}`;
      jobs.set(id, { file, target, organizationId, key: null });
      return {
        id,
        name: file.name,
        size: file.size,
        isImage: file.type.startsWith('image/'),
        progress: 0,
        status: 'queued',
        failedStep: null,
      };
    });
    set((state) => ({ rows: [...state.rows, ...added] }));
    pump();
  },
  retry: (id) => {
    const row = get().rows.find((candidate) => candidate.id === id);
    const job = jobs.get(id);
    // A retry while the row is already queued or moving is the same press twice: ignore it.
    if (row?.status !== 'failed' || !job) return;
    patchRow(id, {
      status: 'queued',
      progress: job.key === null ? 0 : 99,
      failedStep: null,
    });
    pump();
  },
  dismiss: (id) => {
    if (get().rows.find((row) => row.id === id)?.status !== 'failed') return;
    removeRow(id, { departed: false });
  },
  setCollapsed: (collapsed) => set({ collapsed }),
  clear: () => {
    for (const timer of leaveTimers.values()) clearTimeout(timer);
    leaveTimers.clear();
    jobs.clear();
    set({ rows: [], departed: 0, collapsed: false });
  },
}));

/**
 * Drop every row queued for another organization and say so when unfinished work went
 * with them. A workspace switch ends the uploads of the workspace being left: their attach
 * would run under the new workspace's token (the API scopes by its `org` claim) against a
 * record of the old one. A dropped job is never attached — `runRow` checks its job first.
 */
function dropOtherOrganizations(organizationId: string | null): void {
  const { rows } = useUploadQueueStore.getState();
  const dropped = rows.filter(
    (row) => jobs.get(row.id)?.organizationId !== (organizationId ?? undefined),
  );
  if (dropped.length === 0) return;
  for (const row of dropped) {
    clearTimeout(leaveTimers.get(row.id));
    leaveTimers.delete(row.id);
    jobs.delete(row.id);
  }
  const kept = rows.filter((row) => !dropped.includes(row));
  useUploadQueueStore.setState(
    kept.length === 0 ? { rows: kept, departed: 0, collapsed: false } : { rows: kept },
  );
  if (dropped.some((row) => row.status !== 'done')) {
    notify.info(i18n.t(UPLOAD_TRAY_KEYS.stoppedBySwitch, { ns: UPLOAD_TRAY_NS }));
  }
}

// A real switch or a sign-out — never the boot's first organization.
useOrganizationStore.subscribe((state, previous) => {
  if (previous.organizationId === null) return;
  if (state.organizationId === previous.organizationId) return;
  dropOtherOrganizations(state.organizationId);
});

/** The tray header's numbers: files still to go, the batch total, and how many failed. */
export function uploadQueueSummary(state: Pick<UploadQueueState, 'rows' | 'departed'>): {
  left: number;
  total: number;
  failed: number;
} {
  let left = 0;
  let failed = 0;
  for (const row of state.rows) {
    if (row.status === 'failed') failed += 1;
    else if (row.status !== 'done') left += 1;
  }
  return { left, total: state.rows.length + state.departed, failed };
}
