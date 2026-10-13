import {
  type ColumnDef,
  functionalUpdate,
  type OnChangeFn,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { OFFERING_CATEGORY_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { IdPill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
} from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import {
  OfferingCategoryPill,
  OfferingDurationCell,
  OfferingNameCell,
  OfferingOfferCell,
  OfferingPriceCell,
  OfferingSessionsCell,
  OfferingStatusPill,
  useOfferingText,
} from '../../components/OfferingCells/index.ts';
import {
  OFFERINGS_KEYS,
  OFFERINGS_NS,
  OFFERINGS_TABLE_ID,
} from '../../offerings.constants.ts';
import {
  offeringDuration,
  type OfferingRow,
  offeringStatus,
} from '../../offerings.rows.ts';
import type { OfferingsSort } from '../../offerings.search.ts';
import {
  BranchChips,
  UpdatedCell,
  useBranchFold,
} from '../../shared/components/CatalogueCells/index.ts';
import type { OfferingsCatalogue } from '../../shared/hooks/useOfferingsCatalogue/index.ts';

/** The table's row as the meta line and the phone key read it. */
const rowOf = (original: unknown) => original as OfferingRow;

const K = OFFERINGS_KEYS.columns;

/**
 * The Offerings columns (KICKOFF §6.11 Offerings tab; `offerings.md:31–33`): ID ·
 * Offering · Category · Price · Offer · Branches · Duration · Sessions · Status ·
 * Updated (hidden by default), their tracks, which sort (not Offer or
 * Branches), and what each folds to — the tablet meta line, the phone rows'
 * (Price is the phone key). The ids are the URL's sort keys.
 */
function useOfferingColumns(
  catalogue: Pick<OfferingsCatalogue, 'branches'>,
): ColumnDef<DataTableFeatures, OfferingRow>[] {
  const { t } = useTranslation(OFFERINGS_NS);
  const text = useOfferingText();
  const branchFold = useBranchFold();
  const clock = useAppClock();

  return [
    {
      id: 'seq',
      accessorKey: 'offeringNumber',
      header: t(K.seq),
      enableHiding: false,
      cell: ({ row }) => (
        <IdPill>{displayId.offering(row.original.offeringNumber)}</IdPill>
      ),
      meta: {
        track: '64px',
        kind: 'id',
        foldValue: (original) => displayId.offering(rowOf(original).offeringNumber),
      },
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: t(K.name),
      cell: ({ row }) => <OfferingNameCell row={row.original} />,
      meta: { track: 'minmax(200px,1.6fr)', primary: true },
    },
    {
      id: 'category',
      accessorKey: 'category',
      header: t(K.category),
      cell: ({ row }) => <OfferingCategoryPill category={row.original.category} />,
      meta: {
        track: '120px',
        kind: 'badges',
        foldValue: (original) => {
          const { category } = rowOf(original);
          return {
            value: text.category(category),
            dotClassName: TONE_CLASSES[OFFERING_CATEGORY_TONES[category]].fill,
          };
        },
      },
    },
    {
      id: 'price',
      accessorFn: (offering) => offering.priced.final,
      header: t(K.price),
      cell: ({ row }) => <OfferingPriceCell priced={row.original.priced} />,
      meta: {
        track: '130px',
        align: 'end',
        foldValue: (original) => text.price(rowOf(original).priced),
      },
    },
    {
      id: 'offer',
      accessorFn: (offering) => offering.priced.winningOffer?.name ?? '',
      header: t(K.offer),
      enableSorting: false,
      cell: ({ row }) => <OfferingOfferCell offer={row.original.priced.winningOffer} />,
      meta: {
        track: 'minmax(130px,1fr)',
        kind: 'badges',
        foldValue: (original) => {
          const offer = rowOf(original).priced.winningOffer;
          return offer
            ? { value: offer.name, dotClassName: TONE_CLASSES[offer.tone].fill }
            : null;
        },
      },
    },
    {
      id: 'branches',
      accessorFn: (offering) => offering.branches.join(','),
      header: t(K.branches),
      enableSorting: false,
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
      id: 'duration',
      accessorFn: offeringDuration,
      header: t(K.duration),
      cell: ({ row }) => (
        <OfferingDurationCell minutes={offeringDuration(row.original)} />
      ),
      meta: {
        track: '84px',
        foldValue: (original) => text.duration(offeringDuration(rowOf(original))),
      },
    },
    {
      id: 'sessions',
      accessorKey: 'sessions',
      header: t(K.sessions),
      cell: ({ row }) => <OfferingSessionsCell row={row.original} />,
      meta: {
        track: '130px',
        foldValue: (original) => {
          const offering = rowOf(original);
          return text.sessions(offering.sessions, offering.priced.extraSessions);
        },
      },
    },
    {
      id: 'status',
      accessorFn: offeringStatus,
      header: t(K.status),
      cell: ({ row }) => <OfferingStatusPill isActive={row.original.isActive} />,
      meta: {
        track: '104px',
        kind: 'badges',
        foldValue: (original) => {
          const { isActive } = rowOf(original);
          return {
            value: text.status(isActive),
            dotClassName: isActive ? TONE_CLASSES.sage.fill : 'bg-muted-foreground',
            quiet: isActive,
          };
        },
      },
    },
    {
      id: 'updated',
      accessorKey: 'updatedAt',
      header: t(K.updated),
      // When it was last saved — no one is named: clinozy-be keeps no saver on a record (G10).
      cell: ({ row }) => <UpdatedCell updatedAt={row.original.updatedAt} />,
      meta: {
        track: 'minmax(150px,1fr)',
        defaultHidden: true,
        foldValue: (original) => clock.moment(rowOf(original).updatedAt),
      },
    },
  ];
}

/** What {@link useOfferingsTable} needs from the page. */
export interface OfferingsTableInput {
  /** The rows on screen — searched, filtered and sorted already. */
  rows: readonly OfferingRow[];
  /** The URL's column sort. */
  sort: OfferingsSort | undefined;
  /** Write a new sort to the URL (`undefined` clears it). */
  onSortChange: (sort: string | undefined) => void;
  /** The open branches, for the Branches chips. */
  catalogue: Pick<OfferingsCatalogue, 'branches'>;
}

/**
 * The Offerings table instance (KICKOFF §6.11): the page sorts the rows (the
 * header cycles ascending → descending → off and writes the URL's `sort`,
 * `manualSorting`); the Columns choice is a device pref (`useHiddenColumns`,
 * recommended set: Updated hidden — "Columns · 8 of 9 shown"); rows are keyed
 * by the offering's id.
 */
export function useOfferingsTable({
  rows,
  sort,
  onSortChange,
  catalogue,
}: OfferingsTableInput) {
  const columns = useOfferingColumns(catalogue);
  const visibility = useHiddenColumns(OFFERINGS_TABLE_ID, columns);
  const sorting = useMemo<SortingState>(() => sortingFromSearch(sort), [sort]);
  const onSortingChange: OnChangeFn<SortingState> = (updater) =>
    onSortChange(sortingToSearch(functionalUpdate(updater, sorting)));

  return useTable({
    features: dataTableFeatures,
    data: rows as OfferingRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (offering) => offering.id,
    state: { sorting, columnVisibility: visibility.columnVisibility },
    onSortingChange,
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
