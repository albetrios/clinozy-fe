import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { sectionRowState } from '@/shared/api/clinic/access-api.ts';
import {
  CLINIC_ACTIONS,
  type ClinicRoleView,
  MATRIX_SECTIONS,
} from '@/shared/api/clinic/access-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { CLINIC_SECTION_ICONS } from '@/shared/clinic/clinic-section-icons.ts';
import { SECTION_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Check } from '@/shared/icons/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { MATRIX_CELL_KEYS, MATRIX_HEAD_KEYS } from './roles-access.ts';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/** The matrix's grid: the section, four 64px boxes, the 72px Row pill (H:1133). */
const MATRIX_GRID = 'grid grid-cols-[minmax(200px,1fr)_repeat(4,64px)_72px] items-center';

/** The Row pill's words by the row's state (H:5182–5183). */
const ROW_KEYS = {
  full: USERS_KEYS.roles.matrix.full,
  some: USERS_KEYS.roles.matrix.some,
  none: USERS_KEYS.roles.matrix.none,
} as const;

/**
 * "What it can see and do" (`users.md:59–69`; H:1131–1136): the nine sections
 * in their fixed order, each a 26px tile in the section's tone with its name
 * and description — dropped to 60% without View — then View, Create, Edit and
 * Delete as 22px boxes (on: the section's ink with a white check) whose whole
 * cell is the target (§7.2), and the Row pill ("Full" / "Some" /
 * "None"). It keeps its 560px and scrolls sideways inside its bordered box.
 * Locked boxes stay pressable: they say why (`aria-disabled`).
 */
export function RoleMatrix({
  role,
  label,
  writes,
}: {
  role: ClinicRoleView;
  /** The role's name, for each box's accessible name ("Front desk can view · Leads"). */
  label: string;
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const locked = writes.lock !== null;
  return (
    <div
      data-testid="users-role-matrix"
      className="[scrollbar-width:thin] overflow-x-auto rounded-xl border"
    >
      <div
        role="table"
        aria-label={t(USERS_KEYS.roles.matrix.title)}
        className="min-w-140"
      >
        <div
          role="row"
          tabIndex={-1}
          className={cn(
            MATRIX_GRID,
            'bg-canvas text-tiny text-muted-foreground h-9 border-b px-3 font-semibold tracking-[0.04em] uppercase',
          )}
        >
          <span role="columnheader" tabIndex={-1}>
            {t(USERS_KEYS.roles.matrix.section)}
          </span>
          {CLINIC_ACTIONS.map((action) => (
            <span key={action} role="columnheader" tabIndex={-1} className="text-center">
              {t(MATRIX_HEAD_KEYS[action])}
            </span>
          ))}
          <span role="columnheader" tabIndex={-1} className="text-center">
            {t(USERS_KEYS.roles.matrix.row)}
          </span>
        </div>
        {MATRIX_SECTIONS.map((section) => {
          const grants = role.grants[section];
          const state = sectionRowState(grants);
          const tone = TONE_CLASSES[SECTION_TONES[section]];
          const Icon = CLINIC_SECTION_ICONS[section];
          const sectionLabel = tClinic(CLINIC_KEYS.sections[section].label);
          // The Users row of a role clinozy-be keeps as a system role is the platform's (D47).
          const cellLocked = locked || (section === 'users' && writes.platformLocked);
          return (
            <div
              key={section}
              role="row"
              tabIndex={-1}
              data-testid={`users-role-matrix-${section}`}
              className={cn(
                MATRIX_GRID,
                'border-b-muted hover:bg-canvas min-h-12 border-b px-3 transition-colors duration-150 last:border-b-0',
              )}
            >
              <span
                role="rowheader"
                tabIndex={-1}
                className={cn(
                  'flex min-w-0 items-center gap-2.5 py-1.5',
                  state === 'none' && 'opacity-60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6.5 shrink-0 items-center justify-center rounded-md',
                    tone.surface,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col leading-[1.3]">
                  <span className="text-body leading-[1.3] font-semibold">
                    {sectionLabel}
                  </span>
                  <span className="text-caption text-muted-foreground truncate">
                    {tClinic(CLINIC_KEYS.sections[section].description)}
                  </span>
                </span>
              </span>
              {CLINIC_ACTIONS.map((action) => {
                const on = grants[action];
                const name = t(MATRIX_CELL_KEYS[action], {
                  role: label,
                  section: sectionLabel,
                });
                return (
                  <span key={action} role="cell" className="flex justify-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={name}
                      aria-disabled={cellLocked || undefined}
                      title={name}
                      onClick={() => writes.toggleCell(section, action)}
                      data-testid={`users-role-matrix-${section}-${action}`}
                      className={cn(
                        // The whole cell above the row's 1px rule (§7.2): 64 × 47.
                        'group flex h-11.75 w-16 items-center justify-center',
                        cellLocked ? 'cursor-not-allowed' : 'cursor-pointer',
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
              <span role="cell" className="flex justify-center">
                <button
                  type="button"
                  aria-disabled={cellLocked || undefined}
                  title={t(USERS_KEYS.roles.matrix.rowHint)}
                  onClick={() => writes.toggleRow(section)}
                  data-testid={`users-role-matrix-${section}-row`}
                  data-slot="pill"
                  className={cn(
                    'text-caption h-6 rounded-full border px-2.5 font-medium whitespace-nowrap',
                    state === 'full'
                      ? cn(tone.surface, 'border-current')
                      : 'bg-background text-muted-foreground-strong',
                    cellLocked ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  {t(ROW_KEYS[state])}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
