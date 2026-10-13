import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';

import {
  PATIENT_FILE_ACTIONS_KEYS,
  PATIENT_FILE_ACTIONS_NS,
  type PatientAddItem,
} from '../../hooks/usePatientFileActions/index.ts';
import {
  PATIENT_ADD_MENU_KEYS,
  PATIENT_ADD_MENU_NS,
  PATIENT_ADD_MENU_TEST_ID,
} from './patient-add-menu.constants.ts';

/**
 * A row's hover from a section's "⌄": its own tone (H:732), as full literals
 * so Tailwind sees each one.
 */
const TONE_HOVER: Readonly<Partial<Record<Tone, string>>> = {
  sage: 'focus:bg-tone-sage',
  lav: 'focus:bg-tone-lav',
  butter: 'focus:bg-tone-butter',
  mint: 'focus:bg-tone-mint',
  blush: 'focus:bg-tone-blush',
  sky: 'focus:bg-tone-sky',
  stone: 'focus:bg-tone-stone',
};

/** Props of {@link PatientAddMenu}. */
export interface PatientAddMenuProps {
  /**
   * `file` — from the file bar's "+": 246px as the prototype draws it (its
   * 232px is content-box, H:711), "Add for Dharti", 26px tiles,
   * a muted hover; `section` — from a section's "⌄": 240px, "For Dharti ·
   * already selected", 24px tiles, each row hovering in its tone.
   */
  variant: 'file' | 'section';
  /** The patient's first name, for the header. */
  firstName: string;
  items: readonly PatientAddItem[];
  /** The button that opens it (it receives the menu's wiring). */
  trigger: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The Add-to-record menu (H:711, H:732, H:4865; `patient-file.md:253–267`): a
 * menu popover under its trigger, end-aligned, 6px below — a popover on a
 * phone too. Its rows are the items the member may use, each a tone tile and
 * a label; picking one closes the menu and runs it. "+" and a section's "⌄"
 * each own one, so they never open together (§7.3).
 */
export function PatientAddMenu({
  variant,
  firstName,
  items,
  trigger,
  open,
  onOpenChange,
}: PatientAddMenuProps) {
  const { t } = useTranslation([PATIENT_ADD_MENU_NS, PATIENT_FILE_ACTIONS_NS]);
  const section = variant === 'section';
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        aria-label={t(PATIENT_ADD_MENU_KEYS.label)}
        data-testid={PATIENT_ADD_MENU_TEST_ID}
        className={cn(
          'data-[state=open]:animate-dropdown-in flex max-w-[calc(100vw-1rem)] origin-top-right flex-col gap-px rounded-xl p-1.5 data-[state=closed]:animate-none',
          section ? 'w-60' : 'w-61.5',
        )}
      >
        <DropdownMenuLabel className="text-micro text-muted-foreground px-2 py-1.5 font-semibold tracking-wider uppercase">
          {t(
            section
              ? PATIENT_ADD_MENU_KEYS.headerSection
              : PATIENT_ADD_MENU_KEYS.headerFile,
            {
              name: firstName,
            },
          )}
        </DropdownMenuLabel>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.id}
              onSelect={item.run}
              data-testid={`${PATIENT_ADD_MENU_TEST_ID}-${item.id}`}
              className={cn(
                'text-body text-foreground h-9 gap-2.5 rounded-lg px-2',
                section ? TONE_HOVER[item.tone] : 'focus:bg-muted',
                section && 'font-medium',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex flex-none items-center justify-center rounded-md',
                  section ? 'size-6' : 'size-6.5',
                  TONE_CLASSES[item.tone].surface,
                )}
              >
                <Icon className="size-3.75 text-current" />
              </span>
              {t(PATIENT_FILE_ACTIONS_KEYS.items[item.id], {
                ns: PATIENT_FILE_ACTIONS_NS,
              })}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
