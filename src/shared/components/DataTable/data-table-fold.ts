/**
 * The fold engine (H:4099–4116, H:4125): which columns still fit a measured
 * width, which fold into the primary cell's meta line, and — on a phone — the
 * one column that stays beside the primary cell as the row's key. Pure
 * functions over plain column descriptions, so the ranking is tested apart
 * from React and the DOM.
 */

/**
 * Width the row chrome takes before any column (H:4106): 40px of side padding,
 * the 24px checkbox track, its 12px gap and the card's 2px of border.
 */
export const FOLD_RESERVED_WIDTH = 78;

/** Gap between two grid columns of a row (H:4099). */
const FOLD_COLUMN_GAP = 12;

/** Side padding plus the 3px status edge a full-width row adds (H:4099). */
const FOLD_ROW_PADDING = 43;

/** Minimum assumed for a flexible track that names no pixel minimum (H:4098). */
const FOLD_DEFAULT_MIN_WIDTH = 90;

/** The phone meta line shows at most this many items (H:4125). */
const PHONE_META_LIMIT = 4;

/** Values the phone meta line drops as noise (H:4125). */
const PHONE_META_SKIPPED_VALUES: readonly string[] = ['All branches', 'Active', '—'];

/**
 * Labels that rank as low-priority columns (H:4109). Unanchored on purpose —
 * the design's own matcher, kept as written so the drop order is the design's.
 */
const LOW_PRIORITY_LABEL =
  /updated|note|detail|team|e-?mail|remark|created|by$|gender|age|conversion|specialty|default/i;

/** What a column holds, as far as ranking and folding care. */
type FoldColumnKind = 'text' | 'id' | 'person' | 'badges' | 'actions';

/** One visible column, described for the fold engine. */
export interface FoldColumn {
  id: string;
  /** Header label ('' for the actions column). */
  label: string;
  /** CSS grid track, e.g. `minmax(120px,1fr)` or `96px`. */
  track: string;
  kind?: FoldColumnKind;
  /**
   * Explicit priority, 1 the most important: ranks as `10 − priority`, so a
   * priority-1 column is the last to fold and the first phone key candidate.
   */
  priority?: number;
  /** End-aligned (amount) columns rank highest of the implicit kinds. */
  align?: 'start' | 'end';
  /** Never folds. */
  locked?: boolean;
  /** Marks the primary column explicitly. */
  primary?: boolean;
}

/** The fold engine's answer for one row layout. */
export interface FoldPlan {
  /** Columns kept side by side, in column order. */
  kept: readonly string[];
  /** Columns folded into the primary cell's meta line, in meta-line order. */
  folded: readonly string[];
  /** The column that carries the meta line. */
  primaryId: string | null;
  /** The phone key column (phone plans only). */
  keyId: string | null;
  /** `grid-template-columns` for the kept columns. */
  template: string;
  /** Width left over when nothing folds — room for a labelled primary action. */
  spare: number;
}

/** One folded value, ready for the meta line. */
export interface MetaLineItem {
  columnId: string;
  /** Column label; empty for id columns, which show the bare value (H:4116). */
  label: string;
  value: string;
  /** Literal class for the optional 6px dot (`bg-tone-sage-dot`). */
  dotClassName?: string;
  /** A default state the phone meta line drops ("Active", "All branches"). */
  quiet?: boolean;
}

/** The minimum width a grid track asks for (H:4098). */
export function trackMinWidth(track: string): number {
  const minmax = /^minmax\(\s*(\d+)px/.exec(track);
  if (minmax) return Number(minmax[1]);
  if (/^minmax\(\s*0/.test(track)) return FOLD_DEFAULT_MIN_WIDTH;
  const fixed = /^(\d+)px$/.exec(track.trim());
  if (fixed) return Number(fixed[1]);
  return FOLD_DEFAULT_MIN_WIDTH;
}

/**
 * A column's fold rank (H:4110): explicit priority `10 − priority`, id 0, low
 * labels 1, plain 2, end-aligned 4. Lower ranks fold first.
 */
export function foldRank(column: FoldColumn): number {
  if (column.priority !== undefined) return 10 - column.priority;
  if (column.kind === 'id') return 0;
  if (LOW_PRIORITY_LABEL.test(column.label)) return 1;
  if (column.align === 'end') return 4;
  return 2;
}

/**
 * The primary column (H:4105): the one marked primary, else the first person
 * column, else the first labelled text column, else the first column.
 */
export function primaryColumnIndex(columns: readonly FoldColumn[]): number {
  const explicit = columns.findIndex((column) => column.primary);
  if (explicit >= 0) return explicit;
  const person = columns.findIndex((column) => column.kind === 'person');
  if (person >= 0) return person;
  const text = columns.findIndex(
    (column) => (column.kind ?? 'text') === 'text' && column.label !== '',
  );
  return Math.max(text, 0);
}

/** Width a set of columns needs side by side: their minimums plus the gaps. */
function neededWidth(columns: readonly FoldColumn[], indexes: readonly number[]): number {
  const widths = indexes.reduce(
    (sum, index) => sum + trackMinWidth(columns[index]?.track ?? ''),
    0,
  );
  return widths + FOLD_COLUMN_GAP * Math.max(0, indexes.length - 1);
}

/** Columns that may fold: never the primary, the actions or a locked column. */
function foldCandidates(columns: readonly FoldColumn[], primary: number): number[] {
  return columns
    .map((_, index) => index)
    .filter((index) => {
      const column = columns[index];
      return (
        column !== undefined &&
        index !== primary &&
        column.kind !== 'actions' &&
        !column.locked
      );
    });
}

const rankOf = (columns: readonly FoldColumn[], index: number) => {
  const column = columns[index];
  return column ? foldRank(column) : 0;
};

/** How a row's tracks size (see {@link rowTemplate}). */
export type TemplateMode = 'natural' | 'relaxed' | 'folded';

/**
 * `grid-template-columns` for the kept columns: `natural` keeps each track as
 * declared; `relaxed` lowers every `minmax(Npx, …)` minimum to 0; `folded` also
 * gives the primary column `minmax(0,1fr)` — the folded row of H:4114.
 */
export function rowTemplate(
  columns: readonly FoldColumn[],
  kept: readonly string[],
  primaryId: string | null,
  mode: TemplateMode,
): string {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return kept
    .map((id) => {
      const track = byId.get(id)?.track ?? '';
      if (mode === 'natural') return track;
      if (mode === 'folded' && id === primaryId) return 'minmax(0,1fr)';
      return track.replace(/^minmax\(\s*\d+px/, 'minmax(0');
    })
    .join(' ');
}

/**
 * The width a row needs to show every column side by side — the min-width of
 * "Show all" and of tables that never fold (H:4100–4101). `leadingTrack` is
 * the checkbox track's width when the table selects rows.
 */
export function naturalRowWidth(
  columns: readonly FoldColumn[],
  leadingTrack = 0,
): number {
  const indexes = columns.map((_, index) => index);
  const leading = leadingTrack > 0 ? leadingTrack + FOLD_COLUMN_GAP : 0;
  return neededWidth(columns, indexes) + leading + FOLD_ROW_PADDING;
}

/**
 * Plans a tablet or desktop row for a measured scroller width (H:4099–4114).
 * The available width is `containerWidth − 78`; when the columns' minimums do
 * not fit, candidates drop in ascending rank — ties rightmost first — until
 * they do. An unmeasured width (0) plans no fold.
 */
export function planFold(
  columns: readonly FoldColumn[],
  containerWidth: number,
): FoldPlan {
  const primary = primaryColumnIndex(columns);
  const all = columns.map((_, index) => index);
  const plan: FoldPlan = {
    kept: columns.map((column) => column.id),
    folded: [],
    primaryId: columns[primary]?.id ?? null,
    keyId: null,
    template: columns.map((column) => column.track).join(' '),
    spare: 0,
  };
  if (containerWidth <= 0 || columns.length === 0) return plan;

  const available = containerWidth - FOLD_RESERVED_WIDTH;
  if (neededWidth(columns, all) <= available) {
    return { ...plan, spare: available - neededWidth(columns, all) };
  }

  const candidates = foldCandidates(columns, primary).sort(
    (a, b) => rankOf(columns, a) - rankOf(columns, b) || b - a,
  );
  let kept = all;
  const folded: number[] = [];
  for (const index of candidates) {
    if (neededWidth(columns, kept) <= available) break;
    kept = kept.filter((keptIndex) => keptIndex !== index);
    folded.push(index);
  }
  const keptIds = kept.map((index) => columns[index]?.id ?? '');
  return {
    ...plan,
    kept: keptIds,
    // The desktop meta line reads in column order (H:4125).
    folded: folded.sort((a, b) => a - b).map((index) => columns[index]?.id ?? ''),
    template: rowTemplate(columns, keptIds, plan.primaryId, 'folded'),
  };
}

/**
 * The phone key column (H:4112): the highest-ranked column other than the
 * primary, the actions and locked ones — explicit priority, then amounts, then
 * plain columns, then low labels, ids last; ties go to the leftmost.
 */
export function pickPhoneKeyColumn(columns: readonly FoldColumn[]): string | null {
  const primary = primaryColumnIndex(columns);
  const [key] = foldCandidates(columns, primary).sort(
    (a, b) => rankOf(columns, b) - rankOf(columns, a) || a - b,
  );
  return key === undefined ? null : (columns[key]?.id ?? null);
}

/**
 * Plans a phone row (H:4112): the primary, the key column, the actions and any
 * locked column stay; every other column folds, most important first.
 */
export function planPhoneFold(columns: readonly FoldColumn[]): FoldPlan {
  const primary = primaryColumnIndex(columns);
  const keyId = pickPhoneKeyColumn(columns);
  const stays = (column: FoldColumn, index: number) =>
    index === primary ||
    column.id === keyId ||
    column.kind === 'actions' ||
    Boolean(column.locked);
  const kept = columns.flatMap((column, index) =>
    stays(column, index) ? [column.id] : [],
  );
  const folded = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => !stays(column, index))
    .sort((a, b) => foldRank(b.column) - foldRank(a.column) || a.index - b.index)
    .map(({ column }) => column.id);
  return {
    kept,
    folded,
    primaryId: columns[primary]?.id ?? null,
    keyId,
    template: '',
    spare: 0,
  };
}

const isBlank = (value: string) => {
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '—' || trimmed === '-';
};

/**
 * The meta line from folded values, in plan order (H:4115–4116, H:4125):
 * empty and "—" values never show; on a phone it also drops the quiet and
 * skipped values ("All branches", "Active") and stops at four items.
 */
export function buildMetaLine(
  items: readonly MetaLineItem[],
  options: { phone: boolean; skipValues?: readonly string[] },
): MetaLineItem[] {
  const shown = items.filter((item) => !isBlank(item.value));
  if (!options.phone) return shown;
  const skipped = new Set(
    (options.skipValues ?? PHONE_META_SKIPPED_VALUES).map((value) => value.trim()),
  );
  return shown
    .filter((item) => !(item.quiet || skipped.has(item.value.trim())))
    .slice(0, PHONE_META_LIMIT);
}

/** What a row's actions hold, for sizing their track. */
export interface RowActionsLayout {
  /** Inline icon buttons. */
  inline: number;
  /** A destructive action follows a non-destructive one (1px separator). */
  separator: boolean;
  /** A "More actions" menu button follows. */
  menu: boolean;
}

/**
 * Width of a row-actions track (H:4119): the buttons with 6px gaps, 13px for
 * the destructive separator, a 30px "More actions" and 24px of air — 183px for
 * Patients' four 32px actions, 145px for three.
 */
export function rowActionsWidth(layout: RowActionsLayout, buttonSize: number): number {
  if (layout.inline === 0 && !layout.menu) return 0;
  const buttons = layout.inline * buttonSize + Math.max(0, layout.inline - 1) * 6;
  const separator = layout.separator ? 13 : 0;
  let more = 0;
  if (layout.menu) more = layout.inline > 0 ? 36 : 30;
  return buttons + separator + more + 24;
}
