import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { appToday } from '@/shared/api/app/app-time.ts';
import {
  BRANCH_PLACE_LIMITS,
  type BranchHoliday,
} from '@/shared/api/app/branch-places-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  type DataTableRowAction,
  DataTableRowActions,
} from '@/shared/components/DataTableRowActions/index.ts';
import { DrawerField, DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { Trash } from '@/shared/icons/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useBranchHolidayWrites } from '../../hooks/useBranchPlaces/index.ts';
import {
  type BranchPlacesAccess,
  EMPTY_HOLIDAY,
  holidaySchema,
  PLACE_ROW_CLASS,
  type PlaceDraftReport,
  reportRowWriteFailure,
  useHolidayDay,
  useReportDraft,
} from './branch-places-form.ts';
import { PlacesEmpty, PlacesSection, RowError } from './branch-places-parts.tsx';

const K = USERS_KEYS.branches.drawer.places;

/** How far ahead the date list reaches: a year (a typed date further out is still read). */
const HOLIDAY_DAYS_AHEAD = 366;

/** The add row: Date, then Holiday, then "Add" — cleared after each add. */
function HolidayAddRow({
  branchId,
  onDraft,
  testId,
}: {
  branchId: string;
  onDraft: PlaceDraftReport;
  testId: string;
}) {
  const { t } = useTranslation(USERS_NS);
  const writes = useBranchHolidayWrites({ branchId });
  const day = useHolidayDay();
  const ids = { date: useId(), label: useId(), error: useId() };
  const [today] = useState(() => appToday());
  const form = useForm({
    resolver: zodResolver(holidaySchema),
    defaultValues: EMPTY_HOLIDAY,
  });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  useReportDraft('holiday-add', isDirty, onDraft);
  const message = errors.date?.message ?? errors.label?.message;
  const error = message ? t(message, { defaultValue: message }) : undefined;

  const submit = form.handleSubmit(async ({ date, label }) => {
    // The schema refuses a row without a date.
    if (!date) return;
    try {
      await writes.add.mutateAsync({ date, label });
    } catch (failure) {
      reportRowWriteFailure(failure, {
        onTaken: () =>
          form.setError('date', {
            type: 'server',
            message: t(K.duplicate.holiday, { date: day(date) }),
          }),
        fields: { holidayDate: 'date', label: 'label' },
        setFieldError: (field, text) =>
          form.setError(field === 'date' ? 'date' : 'label', {
            type: 'server',
            message: text,
          }),
      });
      return;
    }
    resetFormInPlace(form, EMPTY_HOLIDAY);
  });

  return (
    <form
      noValidate
      data-testid={`${testId}-add`}
      aria-label={t(K.newLabel.holiday)}
      onSubmit={(event) => void submit(event)}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <div className="grid min-w-0 grid-cols-[minmax(9rem,auto)_minmax(0,1fr)_auto] items-end gap-2 @max-[480px]:grid-cols-[minmax(0,1fr)_auto]">
        <DrawerField label={t(K.fields.date)} htmlFor={ids.date}>
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <DatePicker
                id={ids.date}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next);
                  form.clearErrors('date');
                }}
                label={t(K.fields.date)}
                today={today}
                min={today}
                past={0}
                future={HOLIDAY_DAYS_AHEAD}
                invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? ids.error : undefined}
                size="md"
                testId={`${testId}-add-date`}
              />
            )}
          />
        </DrawerField>
        <DrawerField
          label={t(K.fields.label)}
          htmlFor={ids.label}
          className="@max-[480px]:col-span-2 @max-[480px]:row-start-2"
        >
          <DrawerInput
            id={ids.label}
            {...form.register('label')}
            aria-invalid={errors.label ? true : undefined}
            aria-describedby={errors.label ? ids.error : undefined}
            placeholder={t(K.placeholders.holiday)}
            maxLength={BRANCH_PLACE_LIMITS.label}
            autoComplete="off"
            data-testid={`${testId}-add-label`}
          />
        </DrawerField>
        <Button
          type="submit"
          variant="outline"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          data-testid={`${testId}-add-submit`}
          className="h-9"
        >
          {t(K.add)}
        </Button>
      </div>
      {error ? (
        <RowError id={ids.error} testId={`${testId}-add-error`} message={error} />
      ) : null}
    </form>
  );
}

/** Props of {@link BranchHolidayRows}. */
export interface BranchHolidayRowsProps {
  branchId: string;
  holidays: readonly BranchHoliday[];
  access: BranchPlacesAccess;
  onDraft: PlaceDraftReport;
  /** `<testId>` — the list's ids are `<testId>`, `-row`, `-add`, `-add-date` … */
  testId: string;
}

/**
 * A branch's holidays in "Places & days" (KICKOFF §6.6, D23): the days it is closed from today
 * on, earliest first — the label over its day. Each row saves on its own: the add row (date +
 * label, `branch:create`) and Remove through the reason confirm with Undo (`branch:delete`). A
 * second holiday on the same day is refused at the date.
 */
export function BranchHolidayRows({
  branchId,
  holidays,
  access,
  onDraft,
  testId,
}: BranchHolidayRowsProps) {
  const { t } = useTranslation(USERS_NS);
  const writes = useBranchHolidayWrites({ branchId });
  const day = useHolidayDay();
  const [removing, setRemoving] = useState<BranchHoliday | null>(null);

  const actionsOf = (holiday: BranchHoliday): DataTableRowAction[] =>
    access.canRemove
      ? [
          {
            id: 'remove',
            label: t(K.remove),
            icon: Trash,
            destructive: true,
            onSelect: () => setRemoving(holiday),
          },
        ]
      : [];

  return (
    <PlacesSection
      title={t(K.sections.holiday)}
      hint={t(K.hints.holiday)}
      testId={testId}
    >
      {holidays.length > 0 ? (
        <TooltipProvider>
          <ul className="flex min-w-0 flex-col">
            {holidays.map((holiday) => {
              const actions = actionsOf(holiday);
              return (
                <li
                  key={holiday.id}
                  data-testid={`${testId}-row`}
                  data-holiday-id={holiday.id}
                  className={PLACE_ROW_CLASS}
                >
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                    <span
                      dir="auto"
                      className="text-body truncate [text-align:match-parent] font-medium"
                    >
                      {holiday.label}
                    </span>
                    <span className="text-caption text-muted-foreground truncate tabular-nums">
                      {day(holiday.date)}
                    </span>
                  </span>
                  {actions.length > 0 ? (
                    <DataTableRowActions
                      actions={actions}
                      testIdPrefix={testId}
                      className="shrink-0"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      ) : (
        <PlacesEmpty testId={`${testId}-empty`}>{t(K.empty.holiday)}</PlacesEmpty>
      )}
      {access.canAdd ? (
        <HolidayAddRow branchId={branchId} onDraft={onDraft} testId={testId} />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={t(K.removeTitle.holiday)}
        reason={{
          record: removing ? `${removing.label} · ${day(removing.date)}` : undefined,
          undo: removing
            ? {
                message: t(K.removed, { name: removing.label }),
                onUndo: () => writes.restore.mutate(removing),
              }
            : undefined,
        }}
        // Landed, the confirm closes itself and offers Undo; a refusal keeps it open.
        onConfirm={async ({ reason, note }) => {
          if (removing)
            await writes.remove.mutateAsync({ record: removing, reason, note });
        }}
      />
    </PlacesSection>
  );
}
