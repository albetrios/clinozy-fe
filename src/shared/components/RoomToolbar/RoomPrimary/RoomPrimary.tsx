import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import {
  ROOM_TOOLBAR_KEYS,
  ROOM_TOOLBAR_NS,
  roomToolbarTestIds,
} from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { type AppIcon, ChevronDown, Plus } from '@/shared/icons/index.ts';

/** One create action of a room ("New patient", "Pay", "Receive"). */
export interface RoomAction {
  /** Stable id — the test id (`<prefix>-<id>`), e.g. `new-patient`. */
  id: string;
  label: string;
  /** Its 16px icon (default `Plus`). */
  icon?: AppIcon;
  onSelect: () => void;
}

/** Props for {@link RoomPrimary}. */
export interface RoomPrimaryProps {
  /** The primary create action. */
  action: RoomAction;
  /**
   * Other create actions behind a "⌄" segment joined to the primary (the
   * split button); `label` names it (default "More create actions").
   */
  menu?: { label?: string; actions: readonly RoomAction[] };
  /** An outline action paired before the primary (Payments "Pay" + "Receive"). */
  secondary?: RoomAction;
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
}

/**
 * A button's 16px icon, wrapped: the shadcn `Button` re-pads a button whose
 * direct child is an `svg`, and these keep the design's own padding. A
 * `turned` chevron points up while its list is open.
 */
function ActionIcon({ icon: Icon, turned = false }: { icon: AppIcon; turned?: boolean }) {
  return (
    <span aria-hidden="true" className="flex">
      <Icon
        className={cn('size-4 transition-transform duration-150', turned && 'rotate-180')}
      />
    </span>
  );
}

/** The "⌄" segment's list: the Picker as an action menu (popover; a sheet on a phone). */
function CreateMenu({
  menu,
  testId,
  side,
  trigger,
}: {
  menu: NonNullable<RoomPrimaryProps['menu']>;
  testId: string;
  side: 'toolbar' | 'fab';
  trigger: (open: boolean, label: string) => ReactElement;
}) {
  const { t } = useTranslation(ROOM_TOOLBAR_NS);
  const label = menu.label ?? t(ROOM_TOOLBAR_KEYS.moreCreate);
  return (
    <Picker
      menu
      label={label}
      value={null}
      options={menu.actions.map((action) => ({
        key: action.id,
        label: action.label,
        leading: { kind: 'icon', icon: action.icon ?? Plus },
      }))}
      onChange={(id) => menu.actions.find((action) => action.id === id)?.onSelect()}
      align="end"
      minWidth={200}
      testId={testId}
      className={cn('flex', side === 'fab' ? 'flex-none' : 'items-stretch')}
      renderTrigger={({ open }) => trigger(open, label)}
    />
  );
}

/**
 * A room's primary create action (KICKOFF §3.5 Primary, Floating "New";
 * H:1090, H:55–61, H:83). From `md`: a 36px `bg-primary` button with `Plus`
 * 16 and "New <thing>" — split by a 32px "⌄" segment when the room has other
 * create actions, or after an outline partner (Payments' "Pay" + "Receive").
 * On a phone it leaves the toolbar as the floating "New": 52px pills side by
 * side at the inline end, above the tab bar, a showing notice pill and the
 * safe area — its `data-slot="fab"` publishes `--floating-fab-height`
 * (`index.css`) so toasts and the upload tray ride above it.
 */
export function RoomPrimary({ action, menu, secondary, testIdPrefix }: RoomPrimaryProps) {
  const ids = roomToolbarTestIds(testIdPrefix);
  const tier = useViewportTier();
  const PrimaryIcon = action.icon ?? Plus;
  const SecondaryIcon = secondary?.icon ?? Plus;

  if (tier === 'phone') {
    // 52px pills, 14px, gap 8, the FAB shadow (H:55); a labelled pill is padded 16 / 20.
    // Each is a <Button data-slot="pill">, so the Sharp shape squares it too.
    const pill = 'text-sm h-13 gap-2 rounded-full font-medium shadow-(--elevation-fab)';
    const labelled = cn(pill, 'ps-4 pe-5');
    return createPortal(
      <div
        data-slot="fab"
        data-testid={ids.fab}
        className="fixed end-4 bottom-[calc(var(--floating-bottom-offset,0rem)+1rem+env(safe-area-inset-bottom,0rem)+var(--floating-notice-height,0rem))] z-36 flex items-center gap-2"
      >
        {secondary ? (
          <Button
            type="button"
            variant="outline"
            data-slot="pill"
            data-testid={ids.primary(secondary.id)}
            onClick={secondary.onSelect}
            className={labelled}
          >
            <ActionIcon icon={SecondaryIcon} />
            {secondary.label}
          </Button>
        ) : null}
        <Button
          type="button"
          data-slot="pill"
          data-testid={ids.primary(action.id)}
          onClick={action.onSelect}
          className={labelled}
        >
          <ActionIcon icon={PrimaryIcon} />
          {action.label}
        </Button>
        {menu ? (
          <CreateMenu
            menu={menu}
            testId={ids.primaryMenu}
            side="fab"
            trigger={(open, label) => (
              <Button
                type="button"
                data-slot="pill"
                aria-label={label}
                title={label}
                data-testid={ids.primaryMenu}
                className={cn(pill, 'min-w-11 px-3.5')}
              >
                <ActionIcon icon={ChevronDown} turned={open} />
              </Button>
            )}
          />
        ) : null}
      </div>,
      document.body,
    );
  }

  return (
    <div data-slot="room-primary" className="flex flex-none items-center gap-2">
      {secondary ? (
        <Button
          type="button"
          variant="outline"
          data-testid={ids.primary(secondary.id)}
          onClick={secondary.onSelect}
          className="text-body h-9 gap-1.5 rounded-lg ps-3 pe-3.5 shadow-none"
        >
          <ActionIcon icon={SecondaryIcon} />
          {secondary.label}
        </Button>
      ) : null}
      <div className="flex h-9 flex-none items-stretch rounded-lg shadow-(--elevation-control)">
        <Button
          type="button"
          data-testid={ids.primary(action.id)}
          onClick={action.onSelect}
          className={cn(
            'text-body h-9 gap-1.5 rounded-lg ps-3 pe-3.5',
            menu && 'rounded-e-none pe-3',
          )}
        >
          <ActionIcon icon={PrimaryIcon} />
          {action.label}
        </Button>
        {menu ? (
          <CreateMenu
            menu={menu}
            testId={ids.primaryMenu}
            side="toolbar"
            trigger={(open, label) => (
              <Button
                type="button"
                aria-label={label}
                title={label}
                data-testid={ids.primaryMenu}
                className="border-foreground-soft h-9 w-8 rounded-s-none rounded-e-lg border-s px-0"
              >
                <ActionIcon icon={ChevronDown} turned={open} />
              </Button>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
