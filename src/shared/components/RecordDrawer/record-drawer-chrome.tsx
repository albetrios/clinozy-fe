import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { X } from '@/shared/icons/index.ts';

/**
 * The drawer's motion (H:1754, `czdrawer` / `czbd`): the panel slides in over
 * 340ms on cubic-bezier(.32,.72,0,1) — `animate-drawer-in`, mirrored under RTL
 * through `--drawer-enter-from` — while the backdrop rises to 45%; neither has
 * an exit motion. They REPLACE the sheet's stock `animate-in` / `animate-out`:
 * `cn()` knows the theme's animations.
 */
export const RECORD_DRAWER_OVERLAY_CLASS =
  'bg-overlay/45 data-[state=open]:animate-backdrop-in data-[state=closed]:animate-none';

/**
 * Full width below `md` with no shadow there, no start border, and the motion.
 * The panel takes focus itself when the focused control leaves (a picked
 * search hit): it draws no ring for that.
 */
export const RECORD_DRAWER_PANEL_CLASS =
  'w-full gap-0 border-s-0 outline-none max-md:shadow-none sm:max-w-none data-[state=open]:animate-drawer-in data-[state=closed]:animate-none';

/**
 * Where the floating × sits and how it is drawn, per `closeStyle`: the record
 * drawers' 14px outside the edge, `rounded-xl`, no border (`_patterns.md:30`);
 * the form drawers' 10px outside, `rounded-lg` with a hairline (H:2742).
 */
const FLOATING_CLOSE_CLASS: Record<'record' | 'form', string> = {
  record: '-start-[3.125rem] rounded-xl text-foreground',
  form: '-start-[2.875rem] rounded-lg border text-foreground-soft',
};

/**
 * A drawer's × — the record drawer's, and any drawer frame of the same family
 * (the task drawer). From `md` up it floats outside the drawer's inline-start
 * edge (36×36, the close elevation, popping in after 200ms) in the record
 * drawers' or the form drawers' style (`closeStyle`); on a phone it sits
 * inside the header's inline-end corner (44×44, transparent).
 */
export function RecordDrawerClose({
  placement,
  closeStyle = 'record',
  onClose,
  testId,
  closeTestId = `${testId}-close`,
}: {
  placement: 'floating' | 'inside';
  closeStyle?: 'record' | 'form';
  onClose: () => void;
  /** The drawer's root test id; the × is `<testId>-close`… */
  testId: string;
  /** …unless the specs already name it. */
  closeTestId?: string;
}) {
  // The shared "Close" name every dismiss button carries.
  const { t } = useTranslation(LOCALE_NS);
  const label = t(LOCALE_KEYS.closeAria);
  if (placement === 'inside') {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label={label}
        data-testid={closeTestId}
        data-slot="button"
        className="text-foreground hover:bg-muted absolute end-2 top-2 flex size-11 items-center justify-center rounded-lg transition-colors"
      >
        <X aria-hidden="true" className="size-5.5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      data-testid={closeTestId}
      data-slot="floating-edge"
      className={cn(
        'bg-background hover:bg-muted animate-pop-in absolute top-[0.875rem] flex size-9 items-center justify-center transition-colors',
        FLOATING_CLOSE_CLASS[closeStyle],
      )}
    >
      <X aria-hidden="true" className="size-4.5" />
    </button>
  );
}
