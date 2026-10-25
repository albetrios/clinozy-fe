import type {
  KeyboardEvent,
  KeyboardEventHandler,
  ReactNode,
  Ref,
  UIEventHandler,
} from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { CELLS_KEYS } from '@/shared/components/Cells/cells.constants.ts';
import {
  PICKER_KEYS,
  PICKER_NS,
  type PickerTestIds,
} from '@/shared/components/Picker/picker.constants.ts';
import { keepFocus } from '@/shared/components/Picker/picker-dom.ts';
import type {
  PickerOptionRow,
  PickerSection,
} from '@/shared/components/Picker/picker-rows.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/components/ui/command.tsx';
import { Spinner } from '@/shared/components/ui/spinner.tsx';
import { Plus, Search } from '@/shared/icons/index.ts';

import { PickerOptionItem } from './PickerOptionItem.tsx';

/** A labelled action in the panel (the create row, the "full details" footer). */
export interface PickerPanelAction {
  label: string;
  onSelect: () => void;
}

/** Props for {@link PickerPanel}. */
export interface PickerPanelProps<T> {
  /** The list's accessible name (the field's label). */
  label: string;
  testIds: PickerTestIds;
  mode: 'single' | 'multiple' | 'menu';
  /** Keys picked right now. */
  picked: ReadonlySet<string>;
  sections: readonly PickerSection<T>[];
  searchable: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  /** The 14px spinner in the search row. */
  searching: boolean;
  /** Four skeleton rows in place of the list. */
  skeleton: boolean;
  /** Two skeleton rows after the list ("Loading more"). */
  loadingMore: boolean;
  empty?: { title: string; hint?: string };
  /** The dashed "Create “<query>”" row. */
  create?: PickerPanelAction;
  /** The footer's "<New thing> · “<query>”" · "full details". */
  createFull?: PickerPanelAction;
  /** The caller's own footer under the list ("Show all" · "Done"). */
  footer?: ReactNode;
  onPick: (row: PickerOptionRow<T>) => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onScroll: UIEventHandler<HTMLDivElement>;
  inputRef?: Ref<HTMLInputElement>;
  listRef?: Ref<HTMLDivElement>;
}

/** The design's skeleton widths (H:3964): title bar, then a shorter sub bar. */
const SKELETON_ROWS = [
  { title: 'w-[62%]', sub: 'w-[40%]' },
  { title: 'w-[48%]', sub: 'w-[26%]' },
  { title: 'w-[70%]', sub: 'w-[48%]' },
  { title: 'w-[40%]', sub: 'w-[18%]' },
] as const;

const LOADING_MORE_ROWS = [
  { title: 'w-[62%]', sub: 'w-[40%]' },
  { title: 'w-[48%]', sub: 'w-[40%]' },
] as const;

/**
 * A loading row: the shared shimmer, its sheen staggered by `index` so the
 * rows sweep as one wave (change-contact-quick-pick D11; reduced motion stills it).
 */
function SkeletonRow({
  title,
  sub,
  index,
}: {
  title: string;
  sub: string;
  index: number;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2.5 px-2">
      <SkeletonBar shape="avatar" index={index} shimmer className="bg-muted size-5.5" />
      <span className="flex flex-1 flex-col gap-1.25">
        <SkeletonBar index={index} shimmer className={cn('h-2.25 rounded-sm', title)} />
        <SkeletonBar
          index={index}
          shimmer
          className={cn('bg-muted h-1.75 rounded-sm', sub)}
        />
      </span>
    </div>
  );
}

/** Home and End move the caret in the search field instead of the active row. */
function keepCaretKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Home' || event.key === 'End') event.stopPropagation();
}

function PickerSearchRow({
  query,
  onQueryChange,
  placeholder,
  searching,
  testId,
  inputRef,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  searching: boolean;
  testId: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation(PICKER_NS);
  return (
    <CommandInput
      ref={inputRef}
      value={query}
      onValueChange={onQueryChange}
      onKeyDown={keepCaretKeys}
      placeholder={placeholder}
      maxLength={80}
      data-testid={testId}
      wrapperClassName="text-muted-foreground h-10 shrink-0 gap-2 ps-3 pe-2.5"
      className="text-field text-foreground h-full py-0"
      icon={<Search aria-hidden="true" className="size-3.75 shrink-0" />}
      trailing={
        <>
          {searching ? <Spinner className="size-3.5" /> : null}
          <kbd
            data-slot="kbd"
            className="bg-canvas text-muted-foreground flex h-5 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[0.625rem]"
          >
            {t(PICKER_KEYS.escKey)}
          </kbd>
        </>
      }
    />
  );
}

function PickerGroupHeading({
  label,
  tone,
}: {
  label: string;
  tone: PickerSection<unknown>['tone'];
}) {
  return (
    <span className="text-micro text-muted-foreground flex items-center gap-1.5 px-2 pt-2 pb-1 font-semibold tracking-[0.05em] uppercase">
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-xs', TONE_CLASSES[tone].dot)}
      />
      {label}
    </span>
  );
}

function PickerEmpty({
  title,
  hint,
  testId,
}: {
  title: string;
  hint?: string;
  testId: string;
}) {
  return (
    <output
      data-testid={testId}
      className="flex shrink-0 flex-col items-center gap-1 px-3 py-4.5 text-center"
    >
      <span
        aria-hidden="true"
        data-slot="pill"
        className="bg-muted text-muted-foreground mb-1 flex size-8 items-center justify-center rounded-full"
      >
        <Search className="size-3.75" />
      </span>
      <span className="text-body font-medium">{title}</span>
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </output>
  );
}

const GROUP_CLASS =
  'overflow-visible p-0 [&_[cmdk-group-heading]]:p-0 [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-px';

/**
 * The picker's list (H:2891) on shadcn `command`: the 40px search row (15px
 * glyph, 13.5px input, spinner, "esc"), group headers with their tone square,
 * the option rows, a separator before destructive options, skeleton rows while
 * loading, "Loading more" when paging, the empty and no-results states, the
 * dashed create row and the "full details" footer. cmdk drives ↑ ↓ (wrapping
 * over disabled rows), Home / End and ↵; it never filters — the picker does.
 */
export function PickerPanel<T>({
  label,
  testIds,
  mode,
  picked,
  sections,
  searchable,
  query,
  onQueryChange,
  searchPlaceholder,
  searching,
  skeleton,
  loadingMore,
  empty,
  create,
  createFull,
  footer,
  onPick,
  onKeyDown,
  onScroll,
  inputRef,
  listRef,
}: PickerPanelProps<T>) {
  const { t } = useTranslation(PICKER_NS);
  return (
    <Command
      shouldFilter={false}
      loop
      label={searchPlaceholder}
      onKeyDown={onKeyDown}
      className="h-auto min-h-0 flex-1 rounded-none bg-transparent outline-hidden"
    >
      {searchable ? (
        <PickerSearchRow
          query={query}
          onQueryChange={onQueryChange}
          placeholder={searchPlaceholder}
          searching={searching}
          testId={testIds.search}
          inputRef={inputRef}
        />
      ) : null}
      <div
        data-picker-scroll=""
        onScroll={onScroll}
        className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-1"
      >
        {skeleton ? (
          <output data-testid={testIds.loading} className="flex flex-col">
            <span className="sr-only">{t(PICKER_KEYS.loading)}</span>
            {SKELETON_ROWS.map((row, index) => (
              <SkeletonRow
                key={row.title}
                title={row.title}
                sub={row.sub}
                index={index}
              />
            ))}
          </output>
        ) : null}
        {empty ? (
          <PickerEmpty title={empty.title} hint={empty.hint} testId={testIds.empty} />
        ) : null}
        <CommandList
          ref={listRef}
          label={label}
          className="max-h-none overflow-visible outline-hidden [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col [&_[cmdk-list-sizer]]:gap-px"
        >
          {sections.map((section) => (
            <CommandGroup
              key={section.id}
              value={section.id}
              heading={
                section.heading ? (
                  <PickerGroupHeading label={section.heading} tone={section.tone} />
                ) : undefined
              }
              className={GROUP_CLASS}
            >
              {section.items.map((item) =>
                item.kind === 'separator' ? (
                  <CommandSeparator
                    key={item.id}
                    alwaysRender
                    className="bg-muted -mx-1 my-1"
                  />
                ) : (
                  <PickerOptionItem
                    key={item.value}
                    row={item}
                    picked={picked.has(item.option.key)}
                    mode={mode}
                    testId={testIds.option(item.option.key)}
                    patientLabel={t(CELLS_KEYS.patient)}
                    onPick={onPick}
                  />
                ),
              )}
            </CommandGroup>
          ))}
          {create ? (
            <CommandGroup value="create" className={GROUP_CLASS}>
              <CommandItem
                value="create"
                onSelect={create.onSelect}
                onMouseDown={keepFocus}
                data-testid={testIds.create}
                className="border-border-strong bg-background text-body data-[selected=true]:bg-canvas data-[selected=true]:text-foreground mt-0.5 min-h-9 gap-2 rounded-md border border-dashed px-2 py-1 font-medium"
              >
                <Plus aria-hidden="true" className="size-3.5 text-current" />
                {create.label}
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
        {loadingMore ? (
          <output
            aria-busy="true"
            aria-label={t(PICKER_KEYS.loadingMore)}
            data-testid={testIds.loadingMore}
            className="flex shrink-0 flex-col px-1 py-0.5"
          >
            {LOADING_MORE_ROWS.map((row, index) => (
              <SkeletonRow
                key={row.title}
                title={row.title}
                sub={row.sub}
                index={index}
              />
            ))}
          </output>
        ) : null}
      </div>
      {createFull ? (
        <div className="bg-canvas flex min-h-11 shrink-0 items-center gap-2 border-t px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            data-testid={testIds.createFull}
            onClick={createFull.onSelect}
            className="text-body hover:bg-muted h-8 min-w-0 flex-1 justify-start gap-2 rounded-lg ps-2 pe-2.5 font-medium"
          >
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-md"
            >
              <Plus className="size-3.5 text-current" />
            </span>
            <span className="min-w-0 flex-1 truncate text-start">{createFull.label}</span>
            <span className="text-caption text-muted-foreground shrink-0 font-normal">
              {t(PICKER_KEYS.fullDetails)}
            </span>
          </Button>
        </div>
      ) : null}
      {footer ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-2 py-1.5">
          {footer}
        </div>
      ) : null}
    </Command>
  );
}
