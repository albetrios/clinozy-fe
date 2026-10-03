import { Fragment, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { type AppIcon, MoreHorizontal } from '@/shared/icons/index.ts';

/** One row action (KICKOFF §3.5 Data table → Row actions). */
export interface DataTableRowAction {
  /** Stable id — also the test-id suffix. */
  id: string;
  /** The tooltip and the accessible name. */
  label: string;
  icon: AppIcon;
  onSelect: () => void;
  /**
   * Destructive: shown last, after a separator, on the destructive tint. The
   * caller routes it through the delete confirm — never a direct delete.
   */
  destructive?: boolean;
  /** The row's main action: it shows its label when the row has the room. */
  primary?: boolean;
  /** Listed in the "More actions" menu instead of inline. */
  menu?: boolean;
  disabled?: boolean;
}

interface DataTableRowActionsProps {
  actions: readonly DataTableRowAction[];
  /** Show the primary action's label beside its icon. */
  showPrimaryLabel?: boolean;
  /** Test-id prefix: buttons get `<prefix>-row-action-<id>`. */
  testIdPrefix?: string;
  className?: string;
}

/** Non-destructive first, destructive last — inline and in the menu alike. */
function destructiveLast(actions: readonly DataTableRowAction[]): DataTableRowAction[] {
  return [
    ...actions.filter((action) => !action.destructive),
    ...actions.filter((action) => action.destructive),
  ];
}

// 32px on the desktop, at least 36 × 36 on a tablet (H:141) and 40 × 36 on a
// phone, where the actions get their own line (H:72–74).
const BUTTON_SIZE =
  'h-8 min-w-8 md:max-xl:h-9 md:max-xl:min-w-9 max-md:h-9 max-md:min-w-10';

/** The inline-end actions of one row: direct icon buttons and an optional "More actions" menu. */
export function DataTableRowActions({
  actions,
  showPrimaryLabel = false,
  testIdPrefix = 'data',
  className,
}: DataTableRowActionsProps) {
  const { t } = useTranslation(TABLE_NS);
  const inline = destructiveLast(actions.filter((action) => !action.menu));
  const menu = destructiveLast(actions.filter((action) => action.menu));
  // Row clicks open the record; a press on an action must not.
  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <div
      data-slot="data-table-row-actions"
      className={cn('flex items-center justify-end gap-1.5', className)}
    >
      {inline.map((action, index) => {
        const Icon = action.icon;
        const labelled = Boolean(action.primary && showPrimaryLabel);
        return (
          <Fragment key={action.id}>
            {action.destructive && index > 0 ? (
              <span aria-hidden="true" className="bg-border h-4.5 w-px flex-none" />
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={action.label}
                  disabled={action.disabled}
                  data-testid={`${testIdPrefix}-row-action-${action.id}`}
                  onClick={(event) => {
                    stop(event);
                    action.onSelect();
                  }}
                  className={cn(
                    BUTTON_SIZE,
                    'text-detail rounded-lg px-0 shadow-none transition-colors duration-120',
                    labelled && 'gap-1.5 ps-2 pe-2.5 max-md:ps-2.5 max-md:pe-3',
                    action.destructive
                      ? 'bg-destructive-tint border-destructive-border text-destructive hover:border-destructive hover:bg-destructive-tint hover:text-destructive'
                      : 'bg-card text-foreground-soft hover:border-primary hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {labelled ? <span>{action.label}</span> : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          </Fragment>
        );
      })}
      {menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={t(TABLE_KEYS.moreActions)}
              title={t(TABLE_KEYS.moreActions)}
              data-testid={`${testIdPrefix}-row-more`}
              onClick={stop}
              className="text-muted-foreground-strong hover:bg-muted hover:text-foreground max-md:bg-background size-7.5 rounded-lg max-md:h-9 max-md:w-10 max-md:border md:max-xl:size-9"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52.5">
            {menu.map((action, index) => {
              const Icon = action.icon;
              const previous = menu[index - 1];
              return (
                <Fragment key={action.id}>
                  {action.destructive && previous && !previous.destructive ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  <DropdownMenuItem
                    variant={action.destructive ? 'destructive' : 'default'}
                    disabled={action.disabled}
                    data-testid={`${testIdPrefix}-row-action-${action.id}`}
                    onClick={stop}
                    onSelect={() => action.onSelect()}
                  >
                    <Icon aria-hidden="true" />
                    {action.label}
                  </DropdownMenuItem>
                </Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
