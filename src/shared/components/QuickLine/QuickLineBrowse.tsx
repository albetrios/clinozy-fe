import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { Minus, Plus, X } from '@/shared/icons/index.ts';

import {
  QUICK_LINE_BROWSE_LIMIT,
  QUICK_LINE_KEYS,
  QUICK_LINE_NS,
  quickLineTestIds,
} from './quick-line.constants.ts';
import type { QuickLineBrowseConfig, QuickLineItem } from './quick-line.types.ts';

const K = QUICK_LINE_KEYS;

/** Props of {@link QuickLineBrowse}. */
export interface QuickLineBrowseProps<TItem> {
  config: QuickLineBrowseConfig<TItem>;
  /** The quick line's words: the tiles narrow to them. */
  words: readonly string[];
  onClose: () => void;
  testId: string;
}

/** A tile's [− n +] once its item is in the form (H:3798). */
function TileStepper<TItem>({
  item,
  count,
  onStep,
}: {
  item: QuickLineItem<TItem>;
  count: number;
  onStep: (item: QuickLineItem<TItem>, step: 1 | -1) => void;
}) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const step =
    'bg-success/10 text-success hover:bg-success/20 flex h-full w-5.5 flex-none items-center justify-center transition-colors';
  return (
    <span className="border-success bg-background flex h-6 flex-none items-center overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={() => onStep(item, -1)}
        aria-label={`${t(K.removeOne)} · ${item.label}`}
        title={t(K.removeOne)}
        className={step}
      >
        <Minus aria-hidden="true" className="size-3" />
      </button>
      <span className="text-success min-w-5.5 px-0.5 text-center text-xs font-semibold tabular-nums">
        {count}
      </span>
      <button
        type="button"
        onClick={() => onStep(item, 1)}
        aria-label={`${t(K.addOne)} · ${item.label}`}
        title={t(K.addOne)}
        className={step}
      >
        <Plus aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}

/** The dashed "<item> not in the list" field and its add (H:3798). */
function NewItemField({
  placeholder,
  onAdd,
  testId,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
  testId: string;
}) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const [name, setName] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };
  return (
    <div className="border-disabled bg-background flex items-center gap-1 rounded-lg border border-dashed p-1.5">
      <input
        value={name}
        maxLength={60}
        placeholder={placeholder}
        aria-label={placeholder}
        data-testid={testId}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          add();
        }}
        className="text-detail placeholder:text-muted-foreground h-7 min-w-0 flex-1 bg-transparent px-1.5 outline-none"
      />
      <button
        type="button"
        onClick={add}
        aria-label={t(K.addNew)}
        title={t(K.addNew)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-7 flex-none items-center justify-center rounded-md transition-colors"
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Browse (`_patterns.md:141`; H:3797–3802): the group chips with "Close
 * browse", tiles of `minmax(180px, 1fr)` — name, sub and meta, or a green
 * [− n +] once the form holds the item — the inline new-item field, and the
 * 44px footer: "2 added" (or "Tap a tile to add"), "Showing 60 of 84 · type
 * to narrow" past sixty, and "Done". A tile's tap adds one.
 */
export function QuickLineBrowse<TItem>({
  config,
  words,
  onClose,
  testId,
}: QuickLineBrowseProps<TItem>) {
  const { t } = useTranslation(QUICK_LINE_NS);
  const ids = quickLineTestIds(testId);
  const [group, setGroup] = useState(config.groups[0]?.id ?? '');
  const tiles = config.tiles(group, words);
  const shown = tiles.slice(0, QUICK_LINE_BROWSE_LIMIT);
  const footer = config.added ? t(K.added, { count: config.added }) : t(K.tapToAdd);

  return (
    <>
      <div className="flex flex-none items-center gap-2 border-b py-2.5 ps-3 pe-2.5">
        <div
          role="group"
          aria-label={t(K.groups)}
          className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1.5 overflow-x-auto"
        >
          {config.groups.map((option) => {
            const on = option.id === group;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setGroup(option.id)}
                data-testid={`${ids.group}-${option.id}`}
                data-slot="pill"
                className={cn(
                  'h-6 flex-none rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
                  on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground-soft hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t(K.closeBrowse)}
          title={t(K.closeBrowse)}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 flex-none items-center justify-center rounded-md transition-colors"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] content-start gap-1.5 overflow-y-auto p-2.5">
        {shown.map((item) => {
          const count = config.count(item);
          return (
            <div
              key={item.key}
              data-testid={ids.tile}
              data-added={count > 0 ? '' : undefined}
              className={cn(
                'flex min-w-0 flex-col gap-0.5 rounded-lg border py-1.75 ps-2.5 pe-2 transition-colors',
                count > 0
                  ? 'border-success bg-success/10'
                  : 'bg-background hover:border-disabled',
              )}
            >
              <button
                type="button"
                onClick={() => config.onStep(item, 1)}
                title={item.label}
                aria-label={`${t(K.addOne)} · ${item.label}`}
                className="text-detail min-w-0 truncate text-start leading-[1.3] font-medium outline-none focus-visible:underline"
              >
                {item.label}
              </button>
              <span className="flex min-h-6 items-center gap-1.5">
                <span className="text-micro text-muted-foreground min-w-0 flex-1 truncate">
                  {item.sub}
                </span>
                {count > 0 ? (
                  <TileStepper item={item} count={count} onStep={config.onStep} />
                ) : null}
                {count === 0 && item.meta ? (
                  <span className="text-caption text-foreground-soft flex-none font-medium tabular-nums">
                    {item.meta}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
        {config.newItem ? (
          <NewItemField
            placeholder={config.newItem.placeholder}
            onAdd={config.newItem.onAdd}
            testId={ids.newItem}
          />
        ) : null}
      </div>
      {tiles.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t(K.emptyGroup)}
          className="flex-none px-3 pb-2.5"
        />
      ) : null}
      <div className="bg-canvas flex h-11 flex-none items-center gap-2 border-t ps-3 pe-2.5">
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          {footer}
          {tiles.length > QUICK_LINE_BROWSE_LIMIT
            ? ` · ${t(K.showing, { shown: QUICK_LINE_BROWSE_LIMIT, total: tiles.length })}`
            : null}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          data-testid={ids.done}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-body h-8 flex-none rounded-lg px-3.5 font-medium transition-colors"
        >
          {t(K.done)}
        </button>
      </div>
    </>
  );
}
