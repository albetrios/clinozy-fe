import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { ChevronDown, MapPin } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';

const keys = LAYOUT_KEYS.app.sectionBar.branch;

/**
 * Header slot 9 (`shell.md:26`; H:545): which branches the rooms show — only
 * when the clinic has more than one open branch (`useBranches().isMultiBranch`,
 * KICKOFF §6.12 One open branch). The selection is
 * `UserPreference.branchFilter` (empty = all, S:235) through the D32
 * preferences hook. "All branches" toggles every branch on, or back to the
 * first picked; the last branch cannot be turned off. Below `md` it is the
 * compact pin (+ the count of extra branches): the phone header holds the
 * section chip, search, this and the avatar at 320px.
 */
export function BranchPicker() {
  const { t } = useTranslation(LAYOUT_NS);
  const { openBranches: branches, isMultiBranch } = useBranches();
  const { preferences, update } = usePreferences();
  const [open, setOpen] = useState(false);
  if (!isMultiBranch) return null;

  const allIds = branches.map((branch) => branch.id);
  const filter = preferences.branchFilter.filter((id) => allIds.includes(id));
  const selected = filter.length > 0 ? filter : allIds;
  const isAll = selected.length === allIds.length;
  const names = branches
    .filter((branch) => selected.includes(branch.id))
    .map((b) => b.name);
  const [first] = names;
  const label = isAll ? t(keys.all) : (first ?? t(keys.all));

  const set = (next: string[]) => {
    if (next.length === 0) {
      notify.info(t(keys.keepOne));
      return;
    }
    const all = next.length === allIds.length;
    update({ branchFilter: all ? [] : next });
    notify.success(
      all
        ? t(keys.showingAll)
        : t(keys.showing, {
            names: branches
              .filter((branch) => next.includes(branch.id))
              .map((branch) => branch.name)
              .join(', '),
          }),
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t(keys.label, { label })}
          title={t(keys.title, { names: isAll ? t(keys.all) : names.join(', ') })}
          data-testid="branch-picker"
          className={cn(
            'bg-card hover:bg-muted text-detail flex h-8 flex-none items-center gap-1 rounded-lg border px-2 font-medium whitespace-nowrap transition-colors md:gap-1.5 md:px-2.5',
            open ? 'border-disabled' : 'border-border',
          )}
        >
          <MapPin className="size-3.25" aria-hidden />
          {/* A phone keeps the pin and the chevron (the name is the button's label). */}
          <span data-testid="branch-picker-label" className="hidden md:inline">
            {label}
          </span>
          {!isAll && names.length > 1 ? (
            <span
              data-slot="pill"
              className="bg-primary text-primary-foreground text-tiny flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.25 font-semibold tabular-nums"
            >
              +{names.length - 1}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="data-[state=open]:animate-dropdown-in min-w-60 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-micro px-2 font-semibold tracking-[0.05em] uppercase">
            {t(keys.viewGroup)}
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={isAll}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => set(isAll ? [selected[0] ?? allIds[0] ?? ''] : allIds)}
            data-testid="branch-picker-all"
            className="items-start py-1.5"
          >
            <span className="flex flex-col">
              <span className="text-body leading-[1.3] font-medium">{t(keys.all)}</span>
              <span className="text-muted-foreground text-caption leading-[1.3]">
                {t(keys.allSub, { count: allIds.length })}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-micro px-2 font-semibold tracking-[0.05em] uppercase">
            {t(keys.branchesGroup)}
          </DropdownMenuLabel>
          {branches.map((branch) => {
            const on = selected.includes(branch.id);
            return (
              <DropdownMenuCheckboxItem
                key={branch.id}
                checked={on}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() =>
                  set(
                    on
                      ? selected.filter((id) => id !== branch.id)
                      : [...selected, branch.id],
                  )
                }
                data-testid={`branch-picker-${branch.id}`}
                className="items-start py-1.5"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden
                    data-slot="pill"
                    className={cn(
                      'mt-1.5 size-2.5 flex-none rounded-full',
                      TONE_CLASSES[branch.tone].fill,
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body leading-[1.3] font-medium">
                      {branch.name}
                    </span>
                    <span className="text-muted-foreground text-caption truncate leading-[1.3]">
                      {branch.area}
                    </span>
                  </span>
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
