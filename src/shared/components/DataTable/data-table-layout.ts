/**
 * Column facts and the per-render layout of a `DataTable`: which plan the fold
 * engine makes for this tier and width, the grid template, the row min-width
 * and whether the primary row action gets its label. Pure — no React.
 */
import type { Column, Row, RowData } from '@tanstack/react-table';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';

import {
  type FoldColumn,
  type FoldPlan,
  type MetaLineItem,
  naturalRowWidth,
  planFold,
  planPhoneFold,
  rowActionsWidth,
  rowTemplate,
  type TemplateMode,
} from './data-table-fold.ts';
import type { DataTableFeatures, DataTableFoldValue } from './table-features.ts';

/** A row of a shared table. */
export type TableRow<TData extends RowData> = Row<DataTableFeatures, TData>;
/** A column of a shared table. */
export type TableColumn<TData extends RowData> = Column<
  DataTableFeatures,
  TData,
  unknown
>;

/** How phone rows lay out (KICKOFF §3.5 Data table → Phone). */
export type DataTablePhoneLayout = 'fold' | 'wrap' | 'regrid';

/** Track of a column without `meta.track`. */
const DEFAULT_TRACK = 'minmax(90px,1fr)';
/** The actions column's id inside the fold plan. */
const ACTIONS_COLUMN_ID = '__actions';
/** The checkbox track (an 18px box, H:4199). */
export const CHECKBOX_TRACK = 24;
/** The actions column may grow to this to label the primary action (H:4123). */
const LABELLED_ACTIONS_MAX = 210;

/** A column's name: `meta.label`, else its string header, else its id. */
export function columnLabel<TData extends RowData>(column: TableColumn<TData>): string {
  const header = column.columnDef.header;
  return (
    column.columnDef.meta?.label ?? (typeof header === 'string' ? header : column.id)
  );
}

/** A visible column as the fold engine sees it. */
export function toFoldColumn<TData extends RowData>(
  column: TableColumn<TData>,
): FoldColumn {
  const meta = column.columnDef.meta;
  return {
    id: column.id,
    label: columnLabel(column),
    track: meta?.track ?? DEFAULT_TRACK,
    kind: meta?.kind ?? 'text',
    priority: meta?.priority,
    align: meta?.align,
    locked: meta?.locked,
    primary: meta?.primary,
  };
}

/** The accessor value as meta-line text: strings, numbers and lists of them. */
function defaultFoldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string' || typeof item === 'number')
      .join(', ');
  }
  return '';
}

/** One cell's meta-line item: `meta.foldValue`, else the accessor value. */
export function foldItem<TData extends RowData>(
  row: TableRow<TData>,
  column: TableColumn<TData>,
): MetaLineItem {
  const meta = column.columnDef.meta;
  const raw = meta?.foldValue
    ? meta.foldValue(row.original)
    : defaultFoldText(row.getValue(column.id));
  const fold: DataTableFoldValue =
    typeof raw === 'string' ? { value: raw } : (raw ?? { value: '' });
  return {
    columnId: column.id,
    // Ids show the bare value (H:4116).
    label: meta?.kind === 'id' ? '' : columnLabel(column),
    value: fold.value,
    dotClassName: fold.dotClassName,
    quiet: fold.quiet,
  };
}

/** The button size the fold engine plans the actions with (H:4119). */
const PLANNED_BUTTON = 32;

/** What every row's actions need: one track wide enough for the widest row. */
export interface RowActionsSummary {
  /**
   * Actions track the fold engine plans with, at the design's 32px buttons
   * (H:4119); 0 — no actions.
   */
  track: number;
  /** Actions track as rendered: tablet buttons are at least 36px (H:141). */
  renderTrack: number;
  /** Longest label among the rows' primary actions. */
  primaryLabelLength: number;
}

/** Sizes the actions column over every row (H:4119) for buttons of `buttonSize`. */
export function summariseRowActions<TData extends RowData>(
  rows: readonly TableRow<TData>[],
  rowActions: ((row: TableRow<TData>) => readonly DataTableRowAction[]) | undefined,
  buttonSize: number,
): RowActionsSummary {
  const summary: RowActionsSummary = { track: 0, renderTrack: 0, primaryLabelLength: 0 };
  if (!rowActions) return summary;
  for (const row of rows) {
    const actions = rowActions(row);
    const inline = actions.filter((action) => !action.menu);
    const destructive = inline.filter((action) => action.destructive).length;
    const layout = {
      inline: inline.length,
      separator: destructive > 0 && destructive < inline.length,
      menu: actions.some((action) => action.menu),
    };
    summary.track = Math.max(summary.track, rowActionsWidth(layout, PLANNED_BUTTON));
    summary.renderTrack = Math.max(
      summary.renderTrack,
      rowActionsWidth(layout, Math.max(buttonSize, PLANNED_BUTTON)),
    );
    const primary = inline.find((action) => action.primary);
    if (primary) {
      summary.primaryLabelLength = Math.max(
        summary.primaryLabelLength,
        primary.label.length,
      );
    }
  }
  return summary;
}

/** Everything one render's layout depends on. */
export interface TableLayoutInput {
  /** The visible data columns. */
  columns: readonly FoldColumn[];
  actions: RowActionsSummary;
  /** The scroller's measured width (0 until measured). */
  width: number;
  isPhone: boolean;
  phoneLayout: DataTablePhoneLayout;
  fold: boolean;
  /** "Show all" is on: every column side by side. */
  showAll: boolean;
  /** Rows carry the checkbox track. */
  selection: boolean;
  /** Explicit minimum row width (px) when every column shows. */
  minWidth?: number;
}

/** One render's row layout. */
export interface TableLayout {
  plan: FoldPlan;
  /** `grid-template-columns`, the checkbox track included. */
  template: string;
  /** Row min-width in px; 0 lets the rows fit the scroller. */
  minWidth: number;
  /** The primary row action shows its label. */
  showPrimaryLabel: boolean;
  /** The footer offers "Show all" ↔ "Fit to width". */
  hasFoldControl: boolean;
}

function withActionsColumn(columns: readonly FoldColumn[], track: number): FoldColumn[] {
  if (track <= 0) return [...columns];
  return [
    ...columns,
    { id: ACTIONS_COLUMN_ID, label: '', track: `${track}px`, kind: 'actions' },
  ];
}

function planFor(columns: readonly FoldColumn[], input: TableLayoutInput): FoldPlan {
  if (input.isPhone) {
    return input.phoneLayout === 'fold' ? planPhoneFold(columns) : planFold(columns, 0);
  }
  return input.fold && !input.showAll
    ? planFold(columns, input.width)
    : planFold(columns, 0);
}

/**
 * Extra actions width that labels the primary action, or 0: only on a folding
 * table that folds nothing and has the spare room, up to 210px (H:4122–4124).
 */
function primaryLabelExtra(input: TableLayoutInput, plan: FoldPlan): number {
  const { actions } = input;
  if (input.isPhone || !input.fold || input.showAll || actions.primaryLabelLength === 0) {
    return 0;
  }
  const extra = Math.round(actions.primaryLabelLength * 7.2 + 10);
  const fits =
    plan.folded.length === 0 &&
    plan.spare >= extra + 24 &&
    actions.track + extra <= LABELLED_ACTIONS_MAX;
  return fits ? extra : 0;
}

/**
 * How the rendered tracks size. The plan counts 32px action buttons, as the
 * design does (H:4119); the tablet's 36px buttons (H:141) make the rendered
 * track wider, and a row that only just fits relaxes its minimums to absorb it.
 */
function templateMode(plan: FoldPlan, input: TableLayoutInput): TemplateMode {
  if (plan.folded.length > 0) return 'folded';
  const growth = input.actions.renderTrack - input.actions.track;
  return growth > 0 && plan.spare > 0 && plan.spare < growth ? 'relaxed' : 'natural';
}

/** Plans one render: fold plan, template, min-width and the labelled primary action. */
export function planTableLayout(input: TableLayoutInput): TableLayout {
  const { actions } = input;
  let plan = planFor(withActionsColumn(input.columns, actions.track), input);
  const extra = primaryLabelExtra(input, plan);
  if (extra > 0)
    plan = planFor(withActionsColumn(input.columns, actions.track + extra), input);
  // The grid draws the actions at their rendered width.
  const rendered = withActionsColumn(
    input.columns,
    actions.renderTrack > 0 ? actions.renderTrack + extra : 0,
  );
  const tracks = rowTemplate(
    rendered,
    plan.kept,
    plan.primaryId,
    templateMode(plan, input),
  );
  const leadingTrack = input.selection ? CHECKBOX_TRACK : 0;
  const scrollsSideways = !input.isPhone && (!input.fold || input.showAll);
  return {
    plan,
    template: leadingTrack > 0 ? `${leadingTrack}px ${tracks}` : tracks,
    minWidth: scrollsSideways
      ? Math.max(naturalRowWidth(rendered, leadingTrack), input.minWidth ?? 0)
      : 0,
    showPrimaryLabel: input.isPhone || extra > 0,
    hasFoldControl:
      !input.isPhone && input.fold && (plan.folded.length > 0 || input.showAll),
  };
}
