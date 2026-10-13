import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CREDIT_DIRECTION_VALUES,
  type CreditDirection,
} from '@/shared/api/app/app-schema.ts';
import { creditQueryKeys, searchCreditParties } from '@/shared/api/app/credits-api.ts';
import {
  CREDIT_NOTE_MAX,
  type CreditPartyRow,
} from '@/shared/api/app/credits-contracts.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { APP_NS } from '@/shared/app/app.constants.ts';
import { CREDIT_DIRECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerNumberInput,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';
import { useDayLabel } from '../../../shared/hooks/useDayLabel/index.ts';
import {
  type CreditFormValues,
  type CreditParty,
  partyByName,
  partyOf,
  reasonsOf,
  reasonTone,
} from './credit-form.ts';
import {
  creditPartyOption,
  invoiceOptions,
  NO_INVOICE,
  pickedPartyOption,
} from './credit-options.ts';

const K = PAYMENTS_KEYS.credit;

/** The amount's limit: nine characters of rupees, as the money fields take. */
const MONEY_LENGTH = 9;

/** Everything both steps' bodies read. */
interface CreditFieldsProps {
  form: UseFormReturn<CreditFormValues>;
  values: CreditFormValues;
  idPrefix: string;
  testId: string;
  readOnly: boolean;
}

/**
 * Step 1, "Which way" (H:4023–4024): Which way — "Give" blush, "Take" sky,
 * each saying what it means in its tooltip; switching drops the reason — ·
 * Who — the clinic's people (`GET /app/contacts`), then its stock vendors and
 * Medical suppliers, or a name typed in ("Add “q”") · the Amount in ₹.
 */
export function CreditWayFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  onDirection,
  onParty,
}: CreditFieldsProps & {
  onDirection: (direction: CreditDirection) => void;
  onParty: (party: CreditParty | null) => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const field = useDrawerFieldIds(form, idPrefix);
  const who = field('party');
  const amount = field('amount');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.way)}>
        <DrawerChips
          label={t(K.way)}
          options={CREDIT_DIRECTION_VALUES.map((direction) => ({
            value: direction,
            label: t(PAYMENTS_KEYS.pending.ways[direction]),
            tone: CREDIT_DIRECTION_TONES[direction],
            hint: t(PAYMENTS_KEYS.pending.wayTitles[direction]),
          }))}
          value={values.direction}
          onChange={(next) => {
            if (next) onDirection(next);
          }}
          disabled={readOnly}
          testId={`${testId}-way`}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(K.who)}
        htmlFor={who.id}
        required
        error={who.error}
      >
        <Picker<CreditPartyRow>
          id={who.id}
          aria-describedby={who.control['aria-describedby']}
          invalid={Boolean(who.error)}
          label={t(K.who)}
          placeholder={t(K.whoPlaceholder)}
          searchPlaceholder={t(K.whoPlaceholder)}
          loadOptionsKey={creditQueryKeys.parties(organizationId)}
          loadOptions={async (query, cursor) => {
            const page = await searchCreditParties(query, cursor ?? null);
            return {
              rows: page.items.map((row) => creditPartyOption(row, t)),
              next: page.nextCursor,
              hasMore: page.nextCursor !== null,
            };
          }}
          selectedOptions={values.party ? [pickedPartyOption(values.party)] : []}
          value={values.party?.key ?? null}
          onChange={(key, option) => {
            if (key === null) onParty(null);
            else if (option?.data) onParty(partyOf(option.data));
          }}
          onCreate={(query) => {
            if (query.trim()) onParty(partyByName(query));
          }}
          createLabel={t(K.add)}
          disabled={readOnly}
          size="md"
          minWidth={280}
          testId={`${testId}-who`}
        />
      </DrawerField>
      <DrawerField
        span="third"
        label={t(K.amount)}
        htmlFor={amount.id}
        required
        error={amount.error}
      >
        <Controller
          control={form.control}
          name="amount"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...amount.control}
              aria-required="true"
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={tApp(RECORD_DRAWER_KEYS.currency)}
              maxLength={MONEY_LENGTH}
              readOnly={readOnly}
              data-testid={`${testId}-amount`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * Step 2, "Why" (H:4025–4031): the Reason chips of the way picked · For
 * invoice — the person's invoices, when they have any ("optional · links the
 * credit to a bill") · Settle by — a task falls due that day · Note (300;
 * required for "Other", its placeholder by the way).
 */
export function CreditWhyFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  invoices,
  today,
}: CreditFieldsProps & {
  /** The picked person's invoices, newest first; null for a supplier. */
  invoices: readonly InvoiceRecord[] | null;
  today: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const formatDay = useDayLabel();
  const field = useDrawerFieldIds(form, idPrefix);
  const reason = field('reasonKey');
  const invoice = field('invoiceId');
  const settleBy = field('settleBy');
  const note = field('note');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.reason)} required error={reason.error}>
        <Controller
          control={form.control}
          name="reasonKey"
          render={({ field: control }) => (
            <DrawerChips
              label={t(K.reason)}
              options={reasonsOf(values.direction).map((key) => ({
                value: key,
                label: t(PAYMENTS_KEYS.pending.reasons[key]),
                tone: reasonTone(values.direction, key),
              }))}
              value={control.value}
              onChange={(next) => {
                if (next) control.onChange(next);
              }}
              disabled={readOnly}
              testId={`${testId}-reason`}
            />
          )}
        />
      </DrawerField>
      {invoices && invoices.length > 0 ? (
        <DrawerField
          span="half"
          label={t(K.invoice)}
          htmlFor={invoice.id}
          hint={t(K.invoiceHint)}
        >
          <Controller
            control={form.control}
            name="invoiceId"
            render={({ field: control }) => (
              <Picker
                id={invoice.id}
                label={t(K.invoice)}
                placeholder={t(K.noInvoice)}
                options={invoiceOptions({ invoices, t, formatRupees, formatDay })}
                value={control.value ?? NO_INVOICE}
                onChange={(key) => control.onChange(key === NO_INVOICE ? null : key)}
                disabled={readOnly}
                size="md"
                minWidth={260}
                testId={`${testId}-invoice`}
              />
            )}
          />
        </DrawerField>
      ) : null}
      <DrawerField span="third" label={t(K.settleBy)} htmlFor={settleBy.id}>
        <Controller
          control={form.control}
          name="settleBy"
          render={({ field: control }) => (
            <DatePicker
              id={settleBy.id}
              label={t(K.settleBy)}
              value={control.value}
              onChange={control.onChange}
              today={today}
              min={today}
              clearable
              size="md"
              disabled={readOnly}
              testId={`${testId}-settle-by`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        label={t(K.note)}
        htmlFor={note.id}
        required={values.reasonKey === 'other'}
        error={note.error}
      >
        <DrawerTextarea
          {...note.control}
          {...form.register('note')}
          maxLength={CREDIT_NOTE_MAX}
          placeholder={t(K.notePlaceholder[values.direction])}
          readOnly={readOnly}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
