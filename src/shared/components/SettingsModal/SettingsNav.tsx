import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RoomSearchField } from '@/shared/components/RoomToolbar/RoomSearchField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Search } from '@/shared/icons/index.ts';

import { SETTINGS_KEYS, SETTINGS_NS } from './settings.constants.ts';
import type { SettingsNavGroup, SettingsSectionRef } from './settings-sections.ts';
import { filterNav, withActiveSection } from './settings-sections.ts';

interface SettingsNavProps {
  /** Groups already filtered by context + permission (parent owns gating). */
  groups: readonly SettingsNavGroup[];
  active: SettingsSectionRef;
  onSelect: (next: SettingsSectionRef) => void;
}

/**
 * The Settings rail, as the Users room's role list (`users.md:44–53`;
 * H:1118–1121): the search over a `canvas` column of sections, each scope under
 * its 11px uppercase label; a section is a 36px row (16px icon, 13px label) and
 * the open one takes the card's fill, edge and shadow with `aria-current`.
 */
export function SettingsNav({ groups, active, onSelect }: SettingsNavProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const [query, setQuery] = useState('');
  /**
   * The section the current query was typed against.
   *
   * This aside never unmounts — the modal swaps only the content pane — so a
   * query typed on Profile survived every later navigation: a deep link, the
   * mobile section picker, or simply picking a result. The rail then stayed
   * narrowed to a search the user had finished with two sections ago. Keeping
   * the open section listed (`withActiveSection`) fixed the rail contradicting
   * the pane; it does not stop the query outliving its visit. The search
   * belongs to the visit that typed it, so it is dropped the moment the active
   * section moves on — including when the move is its own doing.
   */
  const [queryFor, setQueryFor] = useState(active);
  if (queryFor.scope !== active.scope || queryFor.section !== active.section) {
    // Adjusting state during render because an input changed — the pattern
    // React documents for exactly this, and cheaper than the extra pass an
    // effect would cost.
    setQueryFor(active);
    setQuery('');
  }

  const matches = useMemo(
    () => filterNav(groups, query, (key) => t(key)),
    [groups, query, t],
  );
  /**
   * Searching does not navigate, so the section the pane is showing stays
   * listed even when it does not match — see {@link withActiveSection}. The
   * "no matches" line below still answers for the SEARCH, which is a different
   * question from what is open.
   */
  const visible = useMemo(
    () => withActiveSection(matches, groups, active),
    [matches, groups, active],
  );
  const searching = query.trim().length > 0;
  const matchCount = matches.reduce((total, group) => total + group.items.length, 0);

  return (
    <aside
      aria-label={t(SETTINGS_KEYS.nav.ariaSections)}
      data-testid="settings-nav"
      className="bg-canvas hidden h-full min-h-0 flex-col border-e sm:flex"
    >
      {/* The rail's own 8px inset (the role list's `p-2`), on the spacing scale so
          the theme's Density setting moves it; the search sits on the rows' 10px
          sides and lines up with the content pane's head row (20px down). */}
      <div className="flex flex-col gap-2 px-2.5 pt-5 pb-2">
        <RoomSearchField
          layout="fill"
          value={query}
          onValueChange={setQuery}
          placeholder={t(SETTINGS_KEYS.nav.searchPlaceholder)}
          label={t(SETTINGS_KEYS.nav.searchAria)}
          inputTestId="settings-search"
        />
        {/* How many sections the query actually matched. Without it the rail
            silently shrank with no way to tell a one-hit search from a list
            that had always been that short — and now that the open section
            stays listed regardless, the count is the only thing that says
            whether it is there as a match or as the open one. Polite, because
            it updates on every keystroke. */}
        {searching ? (
          <output
            aria-live="polite"
            className="text-muted-foreground text-caption block px-0.5"
            data-testid="settings-search-count"
          >
            {t(SETTINGS_KEYS.nav.matches, { count: matchCount })}
          </output>
        ) : null}
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-3"
        aria-label={t(SETTINGS_KEYS.nav.ariaSettings)}
      >
        {matches.length === 0 && (
          /*
            The app's own empty-state primitive rather than markup invented
            here, so a fruitless settings search looks like every other empty
            surface in the product — its docstring names "empty search" as one
            of the cases it exists for. Scaled down for a 240px rail: the
            default `px-6 py-12` and 40px icon are sized for a content pane.

            It has to say more than "No matches", because it is NOT alone on
            screen: the section the user has open stays listed right below it
            (`withActiveSection`). Unqualified, the two read as a contradiction
            — a "nothing found" notice sitting on top of something found. The
            description names the query and says the row below is the open one.
          */
          <div data-testid="settings-nav-empty">
            <EmptyState
              className="gap-2 border-b px-2 pt-2 pb-5 [&_svg]:size-6"
              icon={<Search aria-hidden />}
              title={t(SETTINGS_KEYS.nav.empty)}
              description={t(SETTINGS_KEYS.nav.emptyHint, { query: query.trim() })}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery('')}
                  data-testid="settings-search-clear"
                >
                  {t(SETTINGS_KEYS.nav.clearSearch)}
                </Button>
              }
            />
          </div>
        )}
        {visible.map((group) => (
          <div key={group.scope}>
            <p className="text-micro text-muted-foreground px-2.5 pt-1 pb-1.5 font-semibold tracking-[0.05em] uppercase">
              {t(group.labelKey)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.scope === active.scope && item.section === active.section;
                return (
                  <li key={`${item.scope}/${item.section}`}>
                    <button
                      type="button"
                      data-slot="nav-item"
                      onClick={() => {
                        // Clear here as well as on the section change above: a
                        // result that IS the active section changes nothing for
                        // the render-time reset to notice, and leaving the query
                        // up over a rail the user has finished with is the stale
                        // state all over again.
                        setQuery('');
                        onSelect(item);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      data-testid={`settings-nav-${item.scope}-${item.section}`}
                      className={cn(
                        'text-body flex h-9 w-full items-center gap-2.5 rounded-lg border px-2.5 text-start transition-colors duration-150',
                        isActive
                          ? 'bg-card border-border-strong text-foreground font-semibold shadow-xs'
                          : 'text-foreground-soft hover:bg-background hover:text-foreground border-transparent font-medium',
                      )}
                    >
                      <item.icon
                        className={cn(
                          'size-4 shrink-0',
                          isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
