import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { CLINIC_ACTIONS } from '@/shared/api/clinic/access-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { CLINIC_SECTION_ICONS } from '@/shared/clinic/clinic-section-icons.ts';
import { SECTION_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Check } from '@/shared/icons/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { MATRIX_CELL_KEYS, MATRIX_HEAD_KEYS } from './roles-access.ts';
import { MATRIX_ROWS, type MatrixRow, rowState } from './roles-matrix.ts';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/*
 * The matrix is an ARIA table on grid `div`s: every row is a CSS grid, and
 * native `<table>` parts lose their table semantics once their `display` is
 * changed — so the `NOSONAR(S6819)` marks on `role="table"`, `row`,
 * `columnheader`, `rowheader` and `cell` below are deliberate. Each box is a
 * styled-button checkbox: a native checkbox input cannot hold the whole 64 × 47
 * cell as its target around the drawn 22px box.
 */

/** The matrix's grid: the row's name, four 64px boxes, the 72px Row pill (H:1133). */
const MATRIX_GRID = 'grid grid-cols-[minmax(200px,1fr)_repeat(4,64px)_72px] items-center';

/** The Row pill's words by the row's state (H:5182–5183). */
const ROW_KEYS = {
  full: USERS_KEYS.roles.matrix.full,
  some: USERS_KEYS.roles.matrix.some,
  none: USERS_KEYS.roles.matrix.none,
} as const;

/** A row's name and line: a section's own row in the room's words, a row under it in its own. */
function useRowWords() {
  const { t } = useTranslation(USERS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (row: MatrixRow) => {
    if (row.sub) {
      const keys = USERS_KEYS.roles.matrix.resources[row.id];
      return { label: t(keys.label), description: t(keys.description) };
    }
    const keys = CLINIC_KEYS.sections[row.section];
    return { label: tClinic(keys.label), description: tClinic(keys.description) };
  };
}

/** One row: its tile and words, its four boxes ("—" where clinozy-be has no code) and Row pill. */
function MatrixRowView({
  row,
  role,
  held,
  writes,
}: {
  row: MatrixRow;
  /** The role's name, for each box's accessible name ("Front desk can view · Leads"). */
  role: string;
  held: ReadonlySet<string>;
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const words = useRowWords()(row);
  const state = rowState(row, held);
  const tone = TONE_CLASSES[SECTION_TONES[row.section]];
  const Icon = CLINIC_SECTION_ICONS[row.section];
  const locked = writes.lock !== null;
  return (
    <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
      role="row"
      tabIndex={-1}
      data-testid={`users-role-matrix-${row.id}`}
      className={cn(
        MATRIX_GRID,
        'border-b-muted hover:bg-canvas min-h-12 border-b px-3 transition-colors duration-150 last:border-b-0',
      )}
    >
      <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
        role="rowheader"
        tabIndex={-1}
        className={cn(
          'flex min-w-0 items-center gap-2.5 py-1.5',
          row.sub && 'ps-4',
          state === 'none' && 'opacity-60',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md',
            row.sub ? 'size-5' : 'size-6.5',
            tone.surface,
          )}
        >
          <Icon className={row.sub ? 'size-3' : 'size-3.5'} />
        </span>
        <span className="flex min-w-0 flex-col leading-[1.3]">
          <span className="text-body leading-[1.3] font-semibold">{words.label}</span>
          <span className="text-caption text-muted-foreground truncate">
            {words.description}
          </span>
        </span>
      </span>
      {CLINIC_ACTIONS.map((action) => {
        const code = row.codes[action];
        if (!code) {
          return (
            <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
              key={action}
              role="cell"
              title={t(USERS_KEYS.roles.matrix.notApplicable)}
              className="text-muted-foreground text-center"
            >
              —
            </span>
          );
        }
        const on = held.has(code);
        const boxLocked = locked || !(on || writes.canGive(code));
        const name = t(MATRIX_CELL_KEYS[action], { role, section: words.label });
        return (
          <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
            key={action}
            role="cell"
            className="flex justify-center"
          >
            <button // NOSONAR(S6819): styled-button checkbox, see the note above MATRIX_GRID
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={name}
              aria-disabled={boxLocked || undefined}
              title={code}
              onClick={() => writes.toggleBox(row, action)}
              data-testid={`users-role-matrix-${row.id}-${action}`}
              className={cn(
                // The whole cell above the row's 1px rule (§7.2): 64 × 47.
                'group flex h-11.75 w-16 items-center justify-center',
                boxLocked ? 'cursor-not-allowed' : 'cursor-pointer',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5.5 items-center justify-center rounded-md border-[1.5px] transition-colors duration-150',
                  on
                    ? cn(tone.fill, 'border-transparent')
                    : 'bg-background border-border-strong group-hover:border-muted-foreground',
                )}
              >
                {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
            </button>
          </span>
        );
      })}
      <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
        role="cell"
        className="flex justify-center"
      >
        <button
          type="button"
          aria-disabled={locked || undefined}
          title={t(USERS_KEYS.roles.matrix.rowHint)}
          onClick={() => writes.toggleRow(row)}
          data-testid={`users-role-matrix-${row.id}-row`}
          data-slot="pill"
          className={cn(
            'text-caption h-6 rounded-full border px-2.5 font-medium whitespace-nowrap',
            state === 'full'
              ? cn(tone.surface, 'border-current')
              : 'bg-background text-muted-foreground-strong',
            locked ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {t(ROW_KEYS[state])}
        </button>
      </span>
    </div>
  );
}

/**
 * "What it can see and do" (`users.md:59–69`; H:1131–1136; Q-U-B): one row per
 * clinozy-be resource — each section's own, then the ones under it (Contacts and
 * Messages under Leads; Prescriptions, Treatments and Reviews under Patients;
 * Roles and Branches under Users) — each with its tile in the section's tone,
 * its name and line (dropped to 60% with nothing on), then View, Create, Edit
 * and Delete: each box one code (`<resource>:read|create|update|delete`, "—"
 * where clinozy-be has none), on as the section's ink with a white check, its
 * whole cell the target (§7.2), and the Row pill ("Full" / "Some" / "None").
 * It keeps its 560px and scrolls sideways inside its bordered box. Locked boxes
 * stay pressable: they say why (`aria-disabled`).
 */
export function RoleMatrix({
  label,
  codes,
  writes,
}: {
  /** The role's name, for each box's accessible name. */
  label: string;
  codes: readonly string[];
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const held = new Set(codes);
  return (
    <div
      data-testid="users-role-matrix"
      className="[scrollbar-width:thin] overflow-x-auto rounded-xl border"
    >
      <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
        role="table"
        aria-label={t(USERS_KEYS.roles.matrix.title)}
        className="min-w-140"
      >
        <div // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
          role="row"
          tabIndex={-1}
          className={cn(
            MATRIX_GRID,
            'bg-canvas text-tiny text-muted-foreground h-9 border-b px-3 font-semibold tracking-[0.04em] uppercase',
          )}
        >
          <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
            role="columnheader"
            tabIndex={-1}
          >
            {t(USERS_KEYS.roles.matrix.section)}
          </span>
          {CLINIC_ACTIONS.map((action) => (
            <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
              key={action}
              role="columnheader"
              tabIndex={-1}
              className="text-center"
            >
              {t(MATRIX_HEAD_KEYS[action])}
            </span>
          ))}
          <span // NOSONAR(S6819): grid ARIA table, see the note above MATRIX_GRID
            role="columnheader"
            tabIndex={-1}
            className="text-center"
          >
            {t(USERS_KEYS.roles.matrix.row)}
          </span>
        </div>
        {MATRIX_ROWS.map((row) => (
          <MatrixRowView
            key={row.id}
            row={row}
            role={label}
            held={held}
            writes={writes}
          />
        ))}
      </div>
    </div>
  );
}
