import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
} from 'react';
import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
  get,
  type Path,
  useController,
  useFieldArray,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { useDrawerItemsField } from '@/shared/components/RecordDrawer/index.ts';
import { Label } from '@/shared/components/ui/label.tsx';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { X } from '@/shared/icons/index.ts';

import {
  ITEMS_FIELD_KEYS,
  ITEMS_FIELD_NS,
  ITEMS_FIELD_TEST_ID,
  itemsFieldTestIds,
} from './items-field.constants.ts';
import type {
  ItemsColumn,
  ItemsRowContext,
  ItemsRowKey,
  ItemsRowName,
  ItemsRowNote,
} from './items-field.types.ts';

/** Props of {@link ItemsField}. */
export interface ItemsFieldProps<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
> {
  control: Control<TForm>;
  /** The array field the rows live in (`items`). */
  name: TName;
  /** The table's accessible name — the field's label ("Items", "Paid now"). */
  label: string;
  columns: readonly ItemsColumn<TForm, TName>[];
  /** A blank row: "+ <add label>" appends it. Without one there is no add button. */
  newRow?: () => FieldArray<TForm, TName>;
  /** The add button's label ("Add item", "Add medicine"); "Add row" by default. */
  addLabel?: string;
  /**
   * Rows the table never drops below: the × on one of them clears it to
   * `newRow()` instead (Invoice and Rx keep one row, H:4807, H:5059).
   */
  minRows?: number;
  /**
   * What the × on a kept row clears it to, when that is not a new row:
   * Receive's last Mode · Amount row goes back to UPI while "+ Split" adds the
   * next mode unused (H:5070).
   */
  clearRow?: () => FieldArray<TForm, TName>;
  /** False drops the × column (a sale return's rows). */
  removable?: boolean;
  /** The footer's figure at the inline end, 13px/600: a `MoneyCell`, "8 in stock". */
  total?: ReactNode;
  /** Spoken before the total ("Total"). */
  totalLabel?: string;
  /** The dashed note line under every row. */
  note?: ItemsRowNote<TForm, TName>;
  /**
   * Mode · Amount rows (H:5071): they leave the drawer's automatic width
   * alone. Every other items field widens its drawer to 840px.
   */
  compact?: boolean;
  /** View only: no ×, no add button, a read-only note; columns render values. */
  readOnly?: boolean;
  /** Above the table: the quick line, Browse and the frequent chips (§6.9). */
  toolbar?: ReactNode;
  /** Root test id; the parts derive theirs (`<testId>-row`, `-add` …). */
  testId?: string;
  className?: string;
}

type TestIds = ReturnType<typeof itemsFieldTestIds>;

/** A row on the shared grid (`md` up): gap 8px, 6px 10px, a `muted` hairline. */
const ROW_GRID_CLASS =
  'grid grid-cols-(--items-cols) items-center gap-2 border-b border-b-muted px-2.5 py-1.5';
/** A phone row wraps (H:95–101): gap 8px 10px, 10px 12px. */
const ROW_WRAP_CLASS =
  'flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-b-muted px-3 py-2.5';

/** The × column's track, beside the host's columns. */
const REMOVE_TRACK = '30px';

/** A field array's live rows as a list — `useWatch` types a generic path loosely. */
function asRows<TForm extends FieldValues, TName extends FieldArrayPath<TForm>>(
  value: unknown,
): readonly FieldArray<TForm, TName>[] {
  return Array.isArray(value) ? (value as FieldArray<TForm, TName>[]) : [];
}

/** The array's own message ("Add at least one item"): RHF keeps it on `root` once rows hold errors. */
function arrayMessage(error: unknown): string | undefined {
  const node = error as { message?: unknown; root?: { message?: unknown } } | undefined;
  const message = node?.root?.message ?? node?.message;
  return typeof message === 'string' && message !== '' ? message : undefined;
}

/**
 * A cell's box. From `md` up it is a grid track, end-aligned for numbers. A
 * phone row starts every cell; the first takes the whole first line and the
 * last is pushed to the inline end (H:95–101).
 */
function cellClass(phone: boolean, first: boolean, last: boolean, align?: string) {
  if (phone)
    return cn('flex max-w-full min-w-0', first && 'basis-full', last && 'ms-auto');
  return cn('flex min-w-0', align === 'end' && 'justify-end');
}

/** The dashed note line under a row (H:924): "NOTE" and a 12.5px input. */
function RowNote<TForm extends FieldValues, TName extends FieldArrayPath<TForm>>({
  control,
  note,
  context,
  span,
  phone,
  readOnly,
  testId,
}: {
  control: Control<TForm>;
  note: ItemsRowNote<TForm, TName>;
  context: ItemsRowContext<TForm, TName>;
  span: number;
  phone: boolean;
  readOnly: boolean;
  testId: string;
}) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  const name = `${context.name}.${note.key}` as Path<TForm>;
  const {
    field: { ref, value, onChange, onBlur },
  } = useController({ control, name });
  const placeholder = note.placeholder ?? t(ITEMS_FIELD_KEYS.notePlaceholder);
  return (
    <div
      role="cell"
      aria-colspan={span}
      className={phone ? 'basis-full' : 'col-span-full -mt-0.5'}
    >
      <Label className="bg-canvas text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-7.5 items-center gap-2 rounded-md border border-dashed px-2 font-normal focus-within:ring-[3px]">
        <span
          aria-hidden="true"
          className="text-micro shrink-0 font-semibold tracking-[0.04em] uppercase"
        >
          {t(ITEMS_FIELD_KEYS.note)}
        </span>
        <input
          ref={ref}
          name={name}
          type="text"
          autoComplete="off"
          value={typeof value === 'string' ? value : ''}
          maxLength={note.maxLength ?? 200}
          placeholder={placeholder}
          aria-label={placeholder}
          readOnly={readOnly}
          data-testid={testId}
          onChange={(event) => {
            onChange(event.target.value);
            note.onChange?.(event.target.value, context);
          }}
          onBlur={onBlur}
          className="text-detail text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </Label>
    </div>
  );
}

interface ItemsRowProps<TForm extends FieldValues, TName extends FieldArrayPath<TForm>> {
  control: Control<TForm>;
  index: number;
  rowName: ItemsRowName<TName>;
  values: FieldArray<TForm, TName>;
  columns: readonly ItemsColumn<TForm, TName>[];
  note?: ItemsRowNote<TForm, TName>;
  removable: boolean;
  readOnly: boolean;
  phone: boolean;
  onRemove: (index: number) => void;
  testId: string;
  ids: TestIds;
}

/** One row: a cell per column, the ×, then the note line. */
function ItemsRow<TForm extends FieldValues, TName extends FieldArrayPath<TForm>>({
  control,
  index,
  rowName,
  values,
  columns,
  note,
  removable,
  readOnly,
  phone,
  onRemove,
  testId,
  ids,
}: ItemsRowProps<TForm, TName>) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  const contextFor = (
    label: string,
    cellTestId: string,
  ): ItemsRowContext<TForm, TName> => ({
    index,
    name: rowName,
    row: values,
    label,
    testId: cellTestId,
    editable: !readOnly,
    bind: (key: ItemsRowKey<TForm, TName>, bindLabel = label) => ({
      control,
      name: `${rowName}.${key}` as Path<TForm>,
      label: bindLabel,
      testId: cellTestId,
    }),
  });
  const lastColumn = removable ? -1 : columns.length - 1;

  return (
    <div
      role="row"
      tabIndex={-1}
      data-testid={ids.row}
      className={phone ? ROW_WRAP_CLASS : ROW_GRID_CLASS}
    >
      {columns.map((column, position) => (
        <div
          key={column.id}
          role="cell"
          data-column={column.id}
          className={cellClass(
            phone,
            position === 0,
            position === lastColumn,
            column.align,
          )}
        >
          {column.cell(contextFor(column.header, `${testId}-${column.id}`))}
        </div>
      ))}
      {removable ? (
        <div role="cell" className={cellClass(phone, false, true)}>
          <button
            type="button"
            data-slot="items-remove"
            data-testid={ids.remove}
            aria-label={t(ITEMS_FIELD_KEYS.removeRow)}
            onClick={() => onRemove(index)}
            className="text-muted-foreground hover:bg-destructive-tint hover:text-destructive flex size-7 items-center justify-center rounded-md transition-colors"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
      {note ? (
        <RowNote
          control={control}
          note={note}
          context={contextFor(note.placeholder ?? '', ids.note)}
          span={columns.length + Number(removable)}
          phone={phone}
          readOnly={readOnly}
          testId={ids.note}
        />
      ) : null}
    </div>
  );
}

/**
 * After a × the focus stays in the table: on the × now at the removed row's
 * place (or the last one), else on the add button.
 */
function useFocusAfterRemove() {
  const tableRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const index = pending.current;
    if (index === null) return;
    pending.current = null;
    const buttons =
      tableRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-slot="items-remove"]',
      ) ?? [];
    (buttons[Math.min(index, buttons.length - 1)] ?? addRef.current)?.focus();
  });
  return {
    tableRef,
    addRef,
    focusAfterRemove: (index: number) => {
      pending.current = index;
    },
  };
}

/** The 34px header row (from `md` up): 10.5px uppercase heads on `canvas`. */
function ItemsHeaderRow<TForm extends FieldValues, TName extends FieldArrayPath<TForm>>({
  columns,
  removable,
  testId,
}: {
  columns: readonly ItemsColumn<TForm, TName>[];
  removable: boolean;
  testId: string;
}) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  return (
    <div
      role="row"
      tabIndex={-1}
      data-testid={testId}
      className="bg-canvas text-tiny text-muted-foreground grid h-8.75 grid-cols-(--items-cols) items-center gap-2 border-b px-2.5 font-semibold tracking-[0.04em] uppercase"
    >
      {columns.map((column) => (
        <span
          key={column.id}
          role="columnheader"
          tabIndex={-1}
          className={cn('truncate', column.align === 'end' && 'text-end')}
        >
          {column.header}
        </span>
      ))}
      {removable ? (
        <span role="columnheader" tabIndex={-1}>
          <span className="sr-only">{t(ITEMS_FIELD_KEYS.remove)}</span>
        </span>
      ) : null}
    </div>
  );
}

/** The footer: "+ <add label>" (32px, dashed) and the total at the inline end. */
function ItemsFooter({
  onAdd,
  addLabel,
  addRef,
  total,
  totalLabel,
  ids,
}: {
  /** Absent: no add button (read-only, or no blank row to add). */
  onAdd?: () => void;
  addLabel?: string;
  addRef: Ref<HTMLButtonElement>;
  total?: ReactNode;
  totalLabel?: string;
  ids: TestIds;
}) {
  const { t } = useTranslation(ITEMS_FIELD_NS);
  if (!onAdd && total === undefined) return null;
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2">
      {onAdd ? (
        <button
          ref={addRef}
          type="button"
          data-slot="button"
          data-testid={ids.add}
          onClick={onAdd}
          className="border-border-strong bg-card text-detail hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg border border-dashed px-3 font-medium transition-colors"
        >
          <span aria-hidden="true">+</span>
          {addLabel ?? t(ITEMS_FIELD_KEYS.addRow)}
        </button>
      ) : null}
      {total === undefined ? null : (
        <span
          data-testid={ids.total}
          className="text-body ms-auto font-semibold whitespace-nowrap tabular-nums"
        >
          {totalLabel ? <span className="sr-only">{totalLabel} </span> : null}
          {total}
        </span>
      )}
    </div>
  );
}

/**
 * The items table of a drawer form (`_patterns.md:135–142`, H:911–926) on
 * react-hook-form's `useFieldArray`: an invoice's lines, a sale's or a
 * purchase's items, an Rx's medicines, the Mode · Amount rows. A bordered
 * `rounded-xl` frame holds the 34px `canvas` header (10.5px uppercase), one
 * grid row per item (gap 8px, 6px 10px, a `muted` hairline) built from the
 * host's columns, an optional dashed note line per row, and a footer with
 * "+ <add label>" (32px, dashed) and the total at the inline end. Each column
 * renders its cell from the row's context — `row.bind(key)` binds the shared
 * cells (`ItemsPickerCell`, `ItemsQtyCell`, `ItemsNumberCell`,
 * `ItemsTextCell`) to one field of the row, and a field's message (Zod, or a
 * 422 mapped by `mapValidationErrors`) shows on its cell. The array's own
 * message shows under the table.
 *
 * On a phone the header hides and each row wraps (gap 8px 10px, 10px 12px):
 * the first cell takes the first line, the others follow, the last sits at the
 * inline end and the note keeps a line of its own (H:95–101). Inside a
 * `RecordDrawer`, a field that is not `compact` widens the drawer to 840px
 * through its width rule.
 */
export function ItemsField<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
>(props: ItemsFieldProps<TForm, TName>) {
  const { control, name, columns, newRow, minRows = 0, readOnly = false } = props;
  const phone = useViewportTier() === 'phone';
  const testId = props.testId ?? ITEMS_FIELD_TEST_ID;
  const ids = itemsFieldTestIds(testId);
  const errorId = useId();
  const watchedName = name as unknown as FieldPath<TForm>;

  const { fields, append, remove, update } = useFieldArray({ control, name });
  const rows = asRows<TForm, TName>(useWatch({ control, name: watchedName }));
  const { errors } = useFormState({ control, name: watchedName });
  const message = arrayMessage(get(errors, name));
  const { tableRef, addRef, focusAfterRemove } = useFocusAfterRemove();
  useDrawerItemsField(!props.compact);

  const removable = !readOnly && props.removable !== false;
  const template = [
    ...columns.map((column) => column.track),
    ...(removable ? [REMOVE_TRACK] : []),
  ].join(' ');

  const blankRow = props.clearRow ?? newRow;
  const removeRow = (index: number) => {
    focusAfterRemove(index);
    if (fields.length <= minRows && blankRow) update(index, blankRow());
    else remove(index);
  };

  return (
    <TooltipProvider>
      <div
        data-testid={testId}
        className={cn('flex min-w-0 flex-col gap-2', props.className)}
      >
        {props.toolbar}
        <div
          data-slot="items-field"
          className="bg-card overflow-hidden rounded-xl border"
        >
          {phone && fields.length === 0 ? null : (
            <div
              ref={tableRef}
              role="table"
              aria-label={props.label}
              aria-describedby={message ? errorId : undefined}
              data-testid={ids.table}
              style={{ '--items-cols': template } as CSSProperties}
            >
              {phone ? null : (
                <ItemsHeaderRow
                  columns={columns}
                  removable={removable}
                  testId={ids.header}
                />
              )}
              {fields.map((row, index) => (
                <ItemsRow
                  key={row.id}
                  control={control}
                  index={index}
                  rowName={`${name}.${index}`}
                  values={rows[index] ?? row}
                  columns={columns}
                  note={props.note}
                  removable={removable}
                  readOnly={readOnly}
                  phone={phone}
                  onRemove={removeRow}
                  testId={testId}
                  ids={ids}
                />
              ))}
            </div>
          )}
          <ItemsFooter
            onAdd={readOnly || !newRow ? undefined : () => append(newRow())}
            addLabel={props.addLabel}
            addRef={addRef}
            total={props.total}
            totalLabel={props.totalLabel}
            ids={ids}
          />
        </div>
        {message ? (
          <p
            id={errorId}
            role="alert"
            data-testid={ids.error}
            className="text-destructive text-xs"
          >
            {message}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
