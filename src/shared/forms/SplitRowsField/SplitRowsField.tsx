import type { Control, FieldArray, FieldArrayPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsPickerCell,
  type ItemsRowKey,
} from '@/shared/forms/ItemsField/index.ts';

import {
  FIRST_SPLIT_MODE,
  nextSplitMode,
  SPLIT_MODES,
  type SplitRow,
  splitsTotal,
} from './split-rows.ts';
import { SPLIT_ROWS_KEYS, SPLIT_ROWS_NS } from './split-rows-field.constants.ts';

/** A form whose Mode · Amount rows live in `splits`. */
export interface SplitRowsForm extends FieldValues {
  splits: SplitRow[];
}

/*
 * RHF cannot see `splits` through a generic form: the rows' path and their
 * fields' paths are named once here, as `ItemsField` names its own.
 */
type RowsPath<TForm extends SplitRowsForm> = FieldArrayPath<TForm>;
const rowsPath = <TForm extends SplitRowsForm>() =>
  'splits' as unknown as RowsPath<TForm>;
const rowKey = <TForm extends SplitRowsForm>(key: keyof SplitRow) =>
  key as unknown as ItemsRowKey<TForm, RowsPath<TForm>>;
const asRow = <TForm extends SplitRowsForm>(row: SplitRow) =>
  row as unknown as FieldArray<TForm, RowsPath<TForm>>;

/** Props of {@link SplitRowsField}. */
export interface SplitRowsFieldProps<TForm extends SplitRowsForm> {
  control: Control<TForm>;
  /** The table's accessible name — the field's label ("Amount received", "Paid back by"). */
  label: string;
  /** The rows as they stand (the form's live `splits`). */
  rows: readonly SplitRow[];
  /** What the rows may add up to — an added row takes what is left of it; null without one. */
  limit: number | null;
  /** The add button: "Split · add a mode", "Add another mode" (the field draws the "+"). */
  addLabel: string;
  /** The footer: "Total ₹8,550 · due ₹8,550", "Total ₹500 · of ₹500". */
  total: string;
  /**
   * Receive's rows leave the drawer's automatic width alone (H:5071); every
   * other use widens its drawer to 840px, as item rows do (H:3850).
   */
  compact?: boolean;
  readOnly?: boolean;
  /** Root test id: `-row`, `-mode`, `-amount`, `-add`, `-total` derive from it. */
  testId: string;
}

/** Cash, UPI, Card — each on its tone's dot. */
function useModeOptions(): PickerOption[] {
  const { t } = useTranslation(CLINIC_NS);
  return SPLIT_MODES.map((mode) => ({
    key: mode,
    label: t(CLINIC_KEYS.paymentModes[mode]),
    tone: PAYMENT_MODE_TONES[mode],
  }));
}

/** Mode `minmax(0,1fr)` · Amount `150px` (+ the ×), H:5071. */
function useSplitColumns<TForm extends SplitRowsForm>(): ItemsColumn<
  TForm,
  RowsPath<TForm>
>[] {
  const { t } = useTranslation(SPLIT_ROWS_NS);
  const modes = useModeOptions();
  return [
    {
      id: 'mode',
      header: t(SPLIT_ROWS_KEYS.mode),
      track: 'minmax(0,1fr)',
      cell: (row) => (
        <ItemsPickerCell
          {...row.bind(rowKey<TForm>('mode'))}
          options={modes}
          placeholder={t(SPLIT_ROWS_KEYS.mode)}
          searchable={false}
          minWidth={180}
        />
      ),
    },
    {
      id: 'amount',
      header: t(SPLIT_ROWS_KEYS.amount),
      track: '150px',
      align: 'end',
      cell: (row) => <ItemsNumberCell {...row.bind(rowKey<TForm>('amount'))} money />,
    },
  ];
}

/**
 * The Mode · Amount rows (H:5071; `payments.md:103, 174`): a mode picker and a
 * ₹ amount per row, the × — which clears the last row back to an empty UPI one
 * — "+ <add label>" until every mode is used, the added row taking the next
 * mode and what is left of `limit`, and the total at the foot. Receive payment
 * and the give-back drawer both write their money through it.
 */
export function SplitRowsField<TForm extends SplitRowsForm>({
  control,
  label,
  rows,
  limit,
  addLabel,
  total,
  compact = false,
  readOnly = false,
  testId,
}: SplitRowsFieldProps<TForm>) {
  const columns = useSplitColumns<TForm>();
  const next = nextSplitMode(rows);
  const sum = splitsTotal(rows);
  return (
    <ItemsField<TForm, RowsPath<TForm>>
      control={control}
      name={rowsPath<TForm>()}
      label={label}
      columns={columns}
      compact={compact}
      minRows={1}
      newRow={
        next
          ? () =>
              asRow<TForm>({
                mode: next,
                amount: limit === null ? 0 : Math.max(0, limit - sum),
              })
          : undefined
      }
      clearRow={() => asRow<TForm>({ mode: FIRST_SPLIT_MODE, amount: 0 })}
      addLabel={addLabel}
      total={total}
      readOnly={readOnly}
      testId={testId}
    />
  );
}
