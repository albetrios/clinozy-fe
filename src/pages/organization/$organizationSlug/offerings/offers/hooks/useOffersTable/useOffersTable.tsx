import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { OFFER_STATE_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import {
  BranchChips,
  UpdatedCell,
  useBranchFold,
} from '../../../shared/components/CatalogueCells/index.ts';
import type { OfferingsCatalogue } from '../../../shared/hooks/useOfferingsCatalogue/index.ts';
import { useOfferLabels } from '../../../shared/hooks/useOfferLabels/index.ts';
import {
  OfferAppliesCell,
  OfferNameCell,
  OfferStatePill,
  OfferTypeCell,
  OfferValidCell,
  useOfferText,
} from '../../components/OfferCells/index.ts';
import { OFFERS_KEYS, OFFERS_NS, OFFERS_TABLE_ID } from '../../offers.constants.ts';
import type { OfferRow } from '../../offers.rows.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as OfferRow;

const K = OFFERS_KEYS.columns;

/**
 * The Offers columns (KICKOFF §6.11 Offers tab; `offerings.md:47–49`): Offer ·
 * Type · Applies to · Branches · Valid · Status · Updated (hidden by default),
 * their tracks and what each folds to — Type is the phone key. Nothing sorts:
 * the tab keeps the server's Running → Scheduled → Paused → Ended. Status is
 * the server's; Updated is the time alone (no one is named on a record, G10).
 */
function useOfferColumns(
  catalogue: Pick<OfferingsCatalogue, 'branches' | 'today'>,
  nameOf: (offeringId: string) => string | undefined,
): ColumnDef<DataTableFeatures, OfferRow>[] {
  const { t } = useTranslation(OFFERS_NS);
  const labels = useOfferLabels();
  const text = useOfferText();
  const branchFold = useBranchFold();

  return [
    {
      id: 'offer',
      accessorKey: 'name',
      header: t(K.offer),
      enableHiding: false,
      cell: ({ row }) => <OfferNameCell offer={row.original} />,
      meta: { track: 'minmax(190px,1.3fr)', kind: 'badges', primary: true },
    },
    {
      id: 'type',
      accessorFn: (offer) => labels.value(offer),
      header: t(K.type),
      cell: ({ row }) => <OfferTypeCell offer={row.original} />,
      meta: {
        track: '150px',
        priority: 1,
        foldValue: (original) => labels.value(rowOf(original)),
      },
    },
    {
      id: 'appliesTo',
      accessorFn: (offer) => text.appliesTo(offer, nameOf),
      header: t(K.appliesTo),
      cell: ({ row }) => <OfferAppliesCell offer={row.original} nameOf={nameOf} />,
      meta: {
        track: 'minmax(200px,1.4fr)',
        foldValue: (original) => text.appliesTo(rowOf(original), nameOf),
      },
    },
    {
      id: 'branches',
      accessorFn: (offer) => offer.branches.join(','),
      header: t(K.branches),
      cell: ({ row }) => (
        <BranchChips values={row.original.branches} branches={catalogue.branches} />
      ),
      meta: {
        track: 'minmax(120px,.9fr)',
        kind: 'badges',
        foldValue: (original) => branchFold(rowOf(original).branches, catalogue.branches),
      },
    },
    {
      id: 'valid',
      accessorFn: (offer) => text.valid(offer),
      header: t(K.valid),
      cell: ({ row }) => <OfferValidCell row={row.original} today={catalogue.today} />,
      meta: {
        track: 'minmax(170px,1fr)',
        foldValue: (original) => text.valid(rowOf(original)),
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: t(K.status),
      cell: ({ row }) => <OfferStatePill status={row.original.status} />,
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const { status } = rowOf(original);
          return {
            value: labels.state(status),
            dotClassName: TONE_CLASSES[OFFER_STATE_TONES[status]].fill,
          };
        },
      },
    },
    {
      id: 'updated',
      accessorKey: 'updatedAt',
      header: t(K.updated),
      cell: ({ row }) => <UpdatedCell updatedAt={row.original.updatedAt} />,
      meta: { track: 'minmax(140px,.9fr)', defaultHidden: true, foldValue: () => null },
    },
  ];
}

/** What {@link useOffersTable} needs from the page. */
export interface OffersTableInput {
  /** The rows on screen — searched, filtered and in the tab's order already. */
  rows: readonly OfferRow[];
  /** The branches (chips) and the clinic's today (Valid). */
  catalogue: Pick<OfferingsCatalogue, 'branches' | 'today'>;
  /** An offering's name by id, for Applies to — none once it is deleted. */
  nameOf: (offeringId: string) => string | undefined;
}

/**
 * The Offers table instance (KICKOFF §6.11): no sorting — the rows keep the
 * server's order; the Columns choice is a device pref (recommended set:
 * Updated hidden — "Columns · 5 of 6 shown"); rows are keyed by the offer's id.
 */
export function useOffersTable({ rows, catalogue, nameOf }: OffersTableInput) {
  const columns = useOfferColumns(catalogue, nameOf);
  const visibility = useHiddenColumns(OFFERS_TABLE_ID, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as OfferRow[],
    columns,
    manualPagination: true,
    enableSorting: false,
    getRowId: (offer) => offer.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
