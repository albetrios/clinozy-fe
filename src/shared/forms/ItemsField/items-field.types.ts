import type { ReactNode } from 'react';
import type {
  Control,
  FieldArray,
  FieldArrayPath,
  FieldValues,
  Path,
} from 'react-hook-form';

/** A row's path in the form: `items.3`. */
export type ItemsRowName<TName extends string> = `${TName}.${number}`;

/** A field of one row, as a path inside the row (`qty`, `rate`). */
export type ItemsRowKey<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
> = Path<FieldArray<TForm, TName>>;

/**
 * What a bound cell needs — spread `row.bind('qty')` onto it. The control is
 * the form's; the name is the field's full path (`items.3.qty`).
 */
export interface ItemsCellBinding<TForm extends FieldValues> {
  control: Control<TForm>;
  name: Path<TForm>;
  /** The column's header: the control's accessible name. */
  label: string;
  /** `<field test id>-<column id>`. */
  testId: string;
}

/** What a column's `cell` renders from. */
export interface ItemsRowContext<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
> {
  /** The row's position. */
  index: number;
  /** The row's path: `items.3` — `${row.name}.rate` names one of its fields. */
  name: ItemsRowName<TName>;
  /** The row's live values. */
  row: FieldArray<TForm, TName>;
  /** The column's header: the accessible name for an unbound control. */
  label: string;
  /** `<field test id>-<column id>`, for an unbound control. */
  testId: string;
  /** False on a read-only field: render the value, not a control. */
  editable: boolean;
  /** Binds a cell to one field of this row; `label` replaces the header as its name. */
  bind: (key: ItemsRowKey<TForm, TName>, label?: string) => ItemsCellBinding<TForm>;
}

/** One column of an items table (H:3811: a grid track, a header, a cell per row). */
export interface ItemsColumn<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
> {
  /** Stable id: the React key, the cell's `data-column` and the bound cell's test-id suffix. */
  id: string;
  /** The 10.5px uppercase header, and the cell control's accessible name. */
  header: string;
  /** Its grid track from `md` up: `88px`, `minmax(0,2.2fr)`. */
  track: string;
  /** End-aligned (numbers, money) from `md` up; a phone row starts every cell. */
  align?: 'start' | 'end';
  cell: (row: ItemsRowContext<TForm, TName>) => ReactNode;
}

/** The dashed full-width note line under every row (the Rx remarks, H:924). */
export interface ItemsRowNote<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
> {
  /** The row field the note writes. */
  key: ItemsRowKey<TForm, TName>;
  /** The uppercase tag before the input; "Note" by default. */
  tag?: string;
  /** Placeholder and accessible name; "Remarks" by default. */
  placeholder?: string;
  /** 200 characters by default. */
  maxLength?: number;
  /** After each change — the Rx "10 days" recomputing the row's quantity. */
  onChange?: (value: string, row: ItemsRowContext<TForm, TName>) => void;
}
