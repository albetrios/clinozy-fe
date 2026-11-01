import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv } from '@/lib/csv.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { PickerSheet } from '@/shared/components/Picker/index.ts';
import { RoomViewAction } from '@/shared/components/RoomToolbar/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Input } from '@/shared/components/ui/input.tsx';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Download, Receipt } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';
import { usePurchaseGstSummary } from '../../../shared/hooks/useMedicalLists/index.ts';
import { exportPurchaseGstSummary } from '../../../shared/medical-api.ts';
import type { PurchaseGstGroup } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.gstSummary;
const TEST_ID = MEDICAL_DRAWER_TEST_IDS.gstSummary;

/** Props of {@link PurchaseGstSummary}. */
export interface PurchaseGstSummaryProps {
  /** Whether the member may download the CSV (`medicine:export`). */
  canExport: boolean;
}

/** One table of groups: its first column (a rate, or an HSN code and its rate), then the money. */
function GroupTable({
  caption,
  head,
  rows,
  testId,
}: {
  caption: string;
  head: string;
  rows: readonly (PurchaseGstGroup & { key: string; label: string })[];
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatRupees = useRupeeFormat();
  return (
    <table className="w-full text-xs tabular-nums" data-testid={testId}>
      <caption className="text-muted-foreground pb-1 text-start font-semibold">
        {caption}
      </caption>
      <thead>
        <tr className="text-muted-foreground border-b">
          <th scope="col" className="py-1 text-start font-medium">
            {head}
          </th>
          <th scope="col" className="py-1 text-end font-medium">
            {t(K.lines)}
          </th>
          <th scope="col" className="py-1 text-end font-medium">
            {t(K.taxable)}
          </th>
          <th scope="col" className="py-1 text-end font-medium">
            {t(K.gst)}
          </th>
          <th scope="col" className="py-1 text-end font-medium">
            {t(K.total)}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className="border-b last:border-b-0"
            data-testid={`${testId}-row`}
          >
            <th scope="row" className="py-1 text-start font-medium">
              {row.label}
            </th>
            <td className="py-1 text-end">{row.lines}</td>
            <td className="py-1 text-end">{formatRupees(row.taxable)}</td>
            <td className="py-1 text-end">{formatRupees(row.gst)}</td>
            <td className="py-1 text-end font-medium">{formatRupees(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Download CSV": the server's file for the month, saved as it names it. */
function DownloadAction({ month }: { month: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    exportPurchaseGstSummary(month)
      .then((file) => {
        downloadCsv(file.fileName, file.content);
        notify.success(t(K.downloaded));
      })
      .catch((error: unknown) => notifyError(error))
      .finally(() => setBusy(false));
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={run}
      data-testid={`${TEST_ID}-download`}
    >
      <Download aria-hidden="true" />
      {t(K.download)}
    </Button>
  );
}

/** The panel's body for one month: the counts, by rate, by HSN code, the totals. */
function SummaryBody({ month, canExport }: { month: string; canExport: boolean }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatRupees = useRupeeFormat();
  const summary = usePurchaseGstSummary(month).data;
  if (!summary) return null;
  if (summary.totals.lines === 0) {
    return (
      <p
        className="text-muted-foreground px-3.5 py-6 text-center text-xs"
        data-testid={`${TEST_ID}-empty`}
      >
        {t(K.empty)}
      </p>
    );
  }
  const rate = (value: number) =>
    t(MEDICAL_DRAWER_KEYS.purchaseOrder.fields.gstRate, { value });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3.5">
      <GroupTable
        caption={t(K.byRate)}
        head={t(K.rate)}
        rows={summary.byRate.map((row) => ({
          ...row,
          key: String(row.gstPercent),
          label: rate(row.gstPercent),
        }))}
        testId={`${TEST_ID}-by-rate`}
      />
      <GroupTable
        caption={t(K.byHsn)}
        head={t(K.hsn)}
        rows={summary.byHsn.map((row) => ({
          ...row,
          key: `${row.hsn ?? ''}-${row.gstPercent}`,
          label: `${row.hsn ?? t(K.noHsn)} · ${rate(row.gstPercent)}`,
        }))}
        testId={`${TEST_ID}-by-hsn`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span
          className="text-xs font-semibold tabular-nums"
          data-testid={`${TEST_ID}-totals`}
        >
          {t(K.totals, {
            taxable: formatRupees(summary.totals.taxable),
            gst: formatRupees(summary.totals.gst),
            total: formatRupees(summary.totals.total),
          })}
        </span>
        {canExport ? <DownloadAction month={month} /> : null}
      </div>
    </div>
  );
}

/**
 * Purchases › "GST summary" (clinozy-be feat-purchase-line-gst, D4): the month's purchase GST —
 * the received lines of the orders received that month, by GST rate, by HSN code and rate, and in
 * total (`GET /app/medical-purchase-orders/gst-summary`) — with "Download CSV" for members who may
 * export (`medicine:export`). A popover (a bottom sheet on a phone) like Sales' payment
 * reminders; the month starts at this month and cannot pass it.
 */
export function PurchaseGstSummary({ canExport }: PurchaseGstSummaryProps) {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tPanel } = useTranslation(MEDICAL_DRAWERS_NS);
  const thisMonth = appToday().slice(0, 7);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const monthId = useId();
  const summary = usePurchaseGstSummary(open ? month : '').data;
  return (
    <PickerSheet
      open={open}
      onOpenChange={setOpen}
      sheet="filters"
      title={tPanel(K.title)}
      align="end"
      testId={TEST_ID}
      panelClassName="w-120 max-w-[calc(100vw-2.5rem)] max-h-(--radix-popover-content-available-height) rounded-xl"
      trigger={
        <RoomViewAction
          actionId="gst-summary"
          tableId={MEDICAL_TABLE_IDS.purchases}
          icon={Receipt}
          label={t(MEDICAL_KEYS.viewActions.gstSummary)}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none flex-wrap items-end justify-between gap-3 border-b px-3.5 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-field leading-[normal] font-semibold">
              {tPanel(K.title)}
            </span>
            {summary ? (
              <span
                data-testid={`${TEST_ID}-summary`}
                className="text-muted-foreground text-xs leading-[normal]"
              >
                {tPanel(K.summary, {
                  orders: summary.totals.orders,
                  lines: summary.totals.lines,
                })}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={monthId} className="text-xs font-medium">
              {tPanel(K.month)}
            </label>
            <Input
              id={monthId}
              type="month"
              value={month}
              max={thisMonth}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
              className="h-8 w-40"
              data-testid={`${TEST_ID}-month`}
            />
          </div>
        </div>
        {open ? <SummaryBody month={month} canExport={canExport} /> : null}
      </div>
    </PickerSheet>
  );
}
