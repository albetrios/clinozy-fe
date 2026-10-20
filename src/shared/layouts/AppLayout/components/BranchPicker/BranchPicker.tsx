import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { ChevronDown, MapPin } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';

const keys = LAYOUT_KEYS.app.sectionBar.branch;

/** The "All branches" row's key — a branch id never takes it. */
const ALL_BRANCHES_KEY = 'all-branches';

/**
 * Header slot 9 (`shell.md:26`; H:545, H:6114): which branches the rooms show
 * — only when the clinic has more than one open branch
 * (`useBranches().isMultiBranch`, KICKOFF §6.12 One open branch). The list is
 * the shared Picker, multi-select: "All branches" under "View", then each
 * branch (its tone dot, its area) under "Branches". The selection is
 * `UserPreference.branchFilter` (empty = all, S:235) through the D32
 * preferences hook. "All branches" toggles every branch on, or back to the
 * first picked; the last branch cannot be turned off. Below `md` the trigger
 * is the compact pin (+ the count of extra branches): the phone header holds
 * the section chip, search, this and the avatar at 320px.
 */
export function BranchPicker() {
  const { t } = useTranslation(LAYOUT_NS);
  const { openBranches: branches, isMultiBranch } = useBranches();
  const { preferences, update } = usePreferences();
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
  // The "+n" badge beside the first name is shown text, so the name carries it too (WCAG 2.5.3).
  const others = isAll ? 0 : names.length - 1;
  const shownLabel = others > 0 ? `${label} +${others}` : label;

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

  const options: PickerOption[] = [
    {
      key: ALL_BRANCHES_KEY,
      label: t(keys.all),
      sub: t(keys.allSub, { count: allIds.length }),
      group: t(keys.viewGroup),
    },
    ...branches.map((branch) => ({
      key: branch.id,
      label: branch.name,
      group: t(keys.branchesGroup),
      tone: branch.tone,
    })),
  ];
  const value = isAll ? [ALL_BRANCHES_KEY, ...allIds] : selected;

  /** One row changed: "All branches", or one branch on or off. */
  const handleChange = (picked: string[]) => {
    const toggled =
      picked.find((key) => !value.includes(key)) ??
      value.find((key) => !picked.includes(key));
    if (toggled === undefined) return;
    if (toggled === ALL_BRANCHES_KEY) {
      set(isAll ? [selected[0] ?? allIds[0] ?? ''] : allIds);
      return;
    }
    set(
      selected.includes(toggled)
        ? selected.filter((id) => id !== toggled)
        : [...selected, toggled],
    );
  };

  return (
    <Picker
      multiple
      label={t(keys.branchesGroup)}
      value={value}
      options={options}
      onChange={handleChange}
      align="end"
      testId="branch-picker"
      className="flex-none"
      renderTrigger={({ open }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t(keys.label, { label: shownLabel })}
          title={t(keys.title, { names: isAll ? t(keys.all) : names.join(', ') })}
          data-testid="branch-picker"
          className={cn(
            'bg-card hover:bg-muted text-detail gap-1 px-2 shadow-none md:gap-1.5 md:px-2.5',
            open ? 'border-disabled' : 'border-border',
          )}
        >
          <MapPin className="size-3.25" aria-hidden />
          {/* A phone keeps the pin and the chevron (the name is the button's label). */}
          <span data-testid="branch-picker-label" className="hidden md:inline">
            {label}
          </span>
          {others > 0 ? <CountBadge count={others}>+{others}</CountBadge> : null}
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-transform duration-150',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </Button>
      )}
    />
  );
}
