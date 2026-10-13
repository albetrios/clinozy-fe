import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { APP_PHONE_PREFIX, formatAppPhoneDigits } from '@/shared/app/app-phone-field.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import { ProgressLine } from '@/shared/components/ProgressLine/index.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Spinner } from '@/shared/components/Spinner/index.ts';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command.tsx';
import {
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
} from '@/shared/forms/ContactEditor/index.ts';
import { Plus, Search, X } from '@/shared/icons/index.ts';

import {
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
  CONTACT_QUICK_PICK_TEST_IDS,
} from './contact-quick-pick.constants.ts';
import { markMatch, type QuickAddDraft } from './contact-quick-pick-query.ts';
import { ContactQuickAdd } from './ContactQuickAdd.tsx';
import {
  QUICK_PICK_ADD_VALUE,
  type QuickPickView,
  useContactQuickPick,
} from './use-contact-quick-pick.ts';

const K = CONTACT_QUICK_PICK_KEYS;
const IDS = CONTACT_QUICK_PICK_TEST_IDS;

/** Three loading rows: name and line bars at the picker's skeleton widths (H:3964). */
const SKELETON_ROWS = [
  { name: 'w-[62%]', line: 'w-[40%]' },
  { name: 'w-[48%]', line: 'w-[26%]' },
  { name: 'w-[70%]', line: 'w-[48%]' },
] as const;

/** The ↵ hint on the highlighted row (tablet and desktop — a phone has no ↵ to press). */
const ENTER_KEY_CLASS =
  'bg-card text-muted-foreground hidden h-5 flex-none items-center rounded-sm border px-1.5 font-mono text-[0.625rem] md:flex';

/** A note line in the list: "Keep typing…", "No existing match". */
const NOTE_CLASS = 'text-detail text-muted-foreground px-3 py-2.5';

/** How a host draws one person: their second line, the row's action and the avatar's tone. */
export interface ContactQuickPickRow {
  /** "Patient · C-12345 · +91 98250 11241", or the mobile. */
  line: string;
  /** "Use contact", "Open lead", "Re-create lead". */
  action: string;
  tone: Tone;
}

/** The host's own test ids, kept from the searches the picker replaced. */
export interface ContactQuickPickTestIds {
  search: string;
  hit: (hit: ContactSummary) => string;
  /** The add row ("New contact" / "Add “…” as a new contact"). */
  add: string;
  /** "No existing match". */
  noMatch?: string;
}

/** Props for {@link ContactQuickPick}. */
export interface ContactQuickPickProps {
  searchPlaceholder: string;
  /** The search's accessible name. */
  searchLabel: string;
  /** The most people a search shows (the API answers eight at most). */
  limit?: number;
  describe: (hit: ContactSummary) => ContactQuickPickRow;
  /** A person picked — by click, tap or ↵. */
  onPick: (hit: ContactSummary) => void;
  /** "Add contact" in the quick add, its values checked. */
  onQuickAdd: (draft: QuickAddDraft) => void;
  /** "More details" in the quick add — the full contact editor from its values. */
  onMoreDetails?: (draft: QuickAddDraft) => void;
  /** The quick add also needs a 10-digit mobile. */
  requirePhone?: boolean;
  /**
   * Controls between the search and the people (New lead's Quick start chips). ↵ on one of its
   * buttons presses that button, never the highlighted row.
   */
  toolbar?: ReactNode;
  /** The search input — a drawer's initial focus. */
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  /** The root of the picker's own test ids (`CONTACT_QUICK_PICK_TEST_IDS`). */
  testId: string;
  testIds: ContactQuickPickTestIds;
  className?: string;
}

/** A row press keeps the focus in the search, so ↑ ↓ ↵ carry on from there. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

/** Home / End move the caret in the search, not the highlight. */
function keepCaretKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Home' || event.key === 'End') event.stopPropagation();
}

/** A person's name with the searched part marked (`<mark>`), in its own direction. */
function MarkedName({ name, typed }: { name: string; typed: string }) {
  const marked = markMatch(name, typed);
  return (
    <span dir="auto" className="text-body truncate [text-align:match-parent] font-medium">
      {marked ? (
        <>
          {marked.before}
          <mark className="bg-tone-butter text-tone-butter-foreground rounded-xs">
            {marked.match}
          </mark>
          {marked.after}
        </>
      ) : (
        name
      )}
    </span>
  );
}

/** One person's row: avatar, the marked name over the host's line, the action, ↵ when highlighted. */
function PersonRow({
  hit,
  typed,
  row,
  highlighted,
  onPick,
  testId,
}: {
  hit: ContactSummary;
  typed: string;
  row: ContactQuickPickRow;
  /** The row ↵ picks: it shows the ↵ hint. */
  highlighted: boolean;
  onPick: (hit: ContactSummary) => void;
  testId: string;
}) {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  return (
    <CommandItem
      value={hit.id}
      onSelect={() => onPick(hit)}
      onMouseDown={keepFocus}
      data-testid={testId}
      className="group border-b-muted data-[selected=true]:bg-canvas hover:bg-canvas data-[selected=true]:text-foreground flex cursor-pointer items-center gap-2.5 rounded-none border-b px-3 py-2 text-start"
    >
      <PersonAvatar
        initials={personInitials(hit.name)}
        tone={row.tone}
        size="roster"
        patient={hit.patientId !== null}
      />
      <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
        <MarkedName name={hit.name} typed={typed} />
        <span className="text-caption text-muted-foreground truncate">{row.line}</span>
      </span>
      <span className="text-foreground-soft flex-none text-xs font-medium">
        {row.action}
      </span>
      {highlighted ? (
        <span aria-hidden="true" data-slot="kbd" className={ENTER_KEY_CLASS}>
          {t(K.enterKey)}
        </span>
      ) : null}
    </CommandItem>
  );
}

/** The loading rows: avatar, name and line bars, the shared shimmer staggered down the rows. */
function LoadingRows({ testId }: { testId: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className="animate-fade pointer-events-none flex flex-col"
    >
      {SKELETON_ROWS.map((row, index) => (
        <div
          key={row.name}
          className="border-b-muted flex items-center gap-2.5 border-b px-3 py-2"
        >
          <SkeletonBar shape="avatar" index={index} shimmer className="size-7.5" />
          <span className="flex flex-1 flex-col gap-1.5 py-0.5">
            <SkeletonBar
              index={index}
              shimmer
              className={cn('h-2.25 rounded-sm', row.name)}
            />
            <SkeletonBar
              index={index}
              shimmer
              className={cn('bg-muted h-1.75 rounded-sm', row.line)}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The add row's words: what the search would start the new person with. */
function useAddLabel() {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const { t: tEditor } = useTranslation(CONTACT_EDITOR_NS);
  return ({ name, phone }: QuickAddDraft) => {
    const shown = isolateValues({
      name,
      phone: `${APP_PHONE_PREFIX} ${formatAppPhoneDigits(phone)}`,
    });
    if (name && phone) return t(K.addNamedPhone, shown);
    if (name) return t(K.addNamed, shown);
    if (phone) return t(K.addPhone, shown);
    return tEditor(CONTACT_EDITOR_KEYS.newContact);
  };
}

/** The add row: "New contact", or what the search would start the new person with. */
function AddRow({
  draft,
  keyHint,
  onSelect,
  testId,
}: {
  draft: QuickAddDraft;
  /** The ↵ hint: highlighted, and not while ↵ waits for the first answer. */
  keyHint: boolean;
  onSelect: () => void;
  testId: string;
}) {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const addLabel = useAddLabel();
  return (
    <CommandGroup className="p-0">
      <CommandItem
        value={QUICK_PICK_ADD_VALUE}
        onSelect={onSelect}
        onMouseDown={keepFocus}
        data-testid={testId}
        className="group bg-canvas hover:bg-muted data-[selected=true]:bg-muted data-[selected=true]:text-foreground text-body flex h-10 cursor-pointer items-center gap-2 rounded-none px-3 text-start font-medium"
      >
        <Plus aria-hidden="true" className="size-3.25 text-current" />
        <span dir="auto" className="min-w-0 flex-1 truncate [text-align:match-parent]">
          {addLabel(draft)}
        </span>
        {keyHint ? (
          <span aria-hidden="true" data-slot="kbd" className={ENTER_KEY_CLASS}>
            {t(K.enterKey)}
          </span>
        ) : null}
      </CommandItem>
    </CommandGroup>
  );
}

/** The 44px search: the glyph spins and the line runs while an answer is on its way; × clears. */
function SearchField({
  query,
  onQueryChange,
  searching,
  disabled,
  placeholder,
  label,
  inputRef,
  testId,
  searchTestId,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  searching: boolean;
  disabled: boolean;
  placeholder: string;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  testId: string;
  searchTestId: string;
}) {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const glyph = searching ? (
    <Spinner className="text-muted-foreground size-4 shrink-0" />
  ) : (
    <Search aria-hidden="true" className="size-4 shrink-0" />
  );
  return (
    <CommandInput
      ref={inputRef}
      value={query}
      onValueChange={onQueryChange}
      onKeyDown={keepCaretKeys}
      maxLength={80}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      data-testid={searchTestId}
      wrapperClassName="text-muted-foreground relative h-11 shrink-0 gap-2 px-3"
      className="text-field text-foreground h-full py-0"
      icon={glyph}
      trailing={
        <>
          {query && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={t(K.clearSearch)}
              title={t(K.clearSearch)}
              onMouseDown={keepFocus}
              onClick={() => onQueryChange('')}
              data-testid={IDS.clear(testId)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-6 flex-none items-center justify-center rounded-md"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
          {searching ? (
            <ProgressLine
              label={t(K.searching)}
              testId={IDS.progress(testId)}
              className="absolute inset-x-0 -bottom-px"
            />
          ) : null}
        </>
      }
    />
  );
}

/** A group of person rows. */
function PeopleGroup({
  people,
  typed,
  highlighted,
  describe,
  onPick,
  testIds,
  ...group
}: {
  people: readonly ContactSummary[];
  typed: string;
  /** The highlighted row's value. */
  highlighted: string;
  describe: ContactQuickPickProps['describe'];
  onPick: (hit: ContactSummary) => void;
  testIds: ContactQuickPickTestIds;
  heading?: ReactNode;
  className?: string;
  'data-testid': string;
}) {
  return (
    <CommandGroup {...group}>
      {people.map((hit) => (
        <PersonRow
          key={hit.id}
          hit={hit}
          typed={typed}
          row={describe(hit)}
          highlighted={hit.id === highlighted}
          onPick={onPick}
          testId={testIds.hit(hit)}
        />
      ))}
    </CommandGroup>
  );
}

/** The list under the search: Recent or the search's people, the loading rows, notes, the add row. */
function PickList({
  view,
  highlighted,
  label,
  describe,
  onPick,
  onAdd,
  testId,
  testIds,
}: {
  view: QuickPickView;
  highlighted: string;
  label: string;
  describe: ContactQuickPickProps['describe'];
  onPick: (hit: ContactSummary) => void;
  onAdd: () => void;
  testId: string;
  testIds: ContactQuickPickTestIds;
}) {
  const { t } = useTranslation(CONTACT_QUICK_PICK_NS);
  const rows = { typed: view.typed, highlighted, describe, onPick, testIds };
  return (
    <CommandList
      label={label}
      // A cmdk group is presentational, so the busy state sits on the listbox itself.
      aria-busy={view.refreshing || view.waiting}
      className="max-h-none overflow-visible [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col"
    >
      {view.recent.length > 0 ? (
        <PeopleGroup
          {...rows}
          people={view.recent}
          heading={
            <span className="text-tiny text-muted-foreground block px-3 pt-2 pb-1 font-medium tracking-wider uppercase">
              {t(K.recent)}
            </span>
          }
          data-testid={IDS.recent(testId)}
          className="p-0 [&_[cmdk-group-heading]]:p-0"
        />
      ) : null}
      {view.waiting ? <LoadingRows testId={IDS.loading(testId)} /> : null}
      {view.hits.length > 0 ? (
        <PeopleGroup
          {...rows}
          people={view.hits}
          data-testid={IDS.results(testId)}
          className={cn(
            'p-0 transition-opacity duration-150',
            view.refreshing && 'opacity-60',
          )}
        />
      ) : null}
      {view.typed !== '' && !view.live ? (
        <p data-testid={IDS.hint(testId)} className={NOTE_CLASS}>
          {t(K.keepTyping)}
        </p>
      ) : null}
      {view.noMatch ? (
        <p data-testid={testIds.noMatch} className={NOTE_CLASS}>
          {t(K.noMatch)}
        </p>
      ) : null}
      <AddRow
        draft={view.draft}
        keyHint={highlighted === QUICK_PICK_ADD_VALUE && !view.waiting}
        onSelect={onAdd}
        testId={testIds.add}
      />
    </CommandList>
  );
}

/**
 * The person step of a drawer (change-contact-quick-pick): find the person, or add them, in as
 * few keys as the desk can manage. One card, on shadcn `command` (cmdk, no filtering of its
 * own):
 *
 * - **The search** (44px): the clinic's people from 3 letters, 4 digits or a whole `C-12345`
 *   (`useContactSearch`, 250ms). While an answer is on its way the glyph spins and the shared
 *   {@link ProgressLine} runs under the field; with nothing shown yet, three shimmer rows stand in,
 *   and a new answer loading over the last keeps the last rows, dimmed.
 * - **Recent**: before anything is typed, the five people last in touch (`useRecentContacts`).
 * - **The rows**: the host's line and action, the typed words marked in the name; ↑ ↓ move a
 *   highlight that starts on the first row, ↵ or a press picks.
 * - **The add row**: "New contact", or what the search would start them with — ↵ on it (or on an
 *   empty answer) opens {@link ContactQuickAdd}, prefilled from the search.
 * - **The status line** speaks "Searching…", then the count or "No existing match".
 *
 * Reduced motion stills the spinner, the line and the shimmer (the platform rule).
 */
export function ContactQuickPick({
  searchPlaceholder,
  searchLabel,
  limit = 8,
  describe,
  onPick,
  onQuickAdd,
  onMoreDetails,
  requirePhone = false,
  toolbar,
  inputRef,
  disabled = false,
  testId,
  testIds,
  className,
}: ContactQuickPickProps) {
  const pickState = useContactQuickPick({ limit, disabled });
  const { view, setQuery, setAdding } = pickState;
  const done = () => {
    setAdding(null);
    setQuery('');
  };
  const pick = (hit: ContactSummary) => {
    onPick(hit);
    setQuery('');
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    // ↵ on a button of the toolbar is that button's: cmdk would pick the highlighted row
    // instead, so it is kept out (`preventDefault`) and the button pressed as ↵ would.
    if (event.target instanceof HTMLButtonElement) {
      event.preventDefault();
      event.target.click();
      return;
    }
    // ↵ while the first answer is on its way waits for it: it never opens the quick add
    // instead of the first hit the desk was about to get.
    if (view.waiting) event.preventDefault();
  };

  return (
    <div
      data-slot="surface"
      className={cn('bg-card flex flex-col overflow-hidden rounded-xl border', className)}
    >
      <output aria-live="polite" data-testid={IDS.status(testId)} className="sr-only">
        {pickState.status}
      </output>
      {pickState.adding ? (
        <ContactQuickAdd
          draft={pickState.adding}
          requirePhone={requirePhone}
          onAdd={(values) => {
            onQuickAdd(values);
            done();
          }}
          onMoreDetails={
            onMoreDetails &&
            ((values) => {
              onMoreDetails(values);
              done();
            })
          }
          onBack={() => setAdding(null)}
          testId={testId}
        />
      ) : (
        <Command
          shouldFilter={false}
          loop
          value={pickState.highlighted}
          onValueChange={pickState.setActive}
          label={searchLabel}
          onKeyDown={onKeyDown}
          className="h-auto rounded-none bg-transparent"
        >
          <SearchField
            query={pickState.query}
            onQueryChange={setQuery}
            searching={view.searching}
            disabled={disabled}
            placeholder={searchPlaceholder}
            label={searchLabel}
            inputRef={inputRef}
            testId={testId}
            searchTestId={testIds.search}
          />
          {toolbar}
          {disabled ? null : (
            <PickList
              view={view}
              highlighted={pickState.highlighted}
              label={searchLabel}
              describe={describe}
              onPick={pick}
              onAdd={() => setAdding(view.draft)}
              testId={testId}
              testIds={testIds}
            />
          )}
        </Command>
      )}
    </div>
  );
}
