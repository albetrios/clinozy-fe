import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonChip, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import {
  MakerPills,
  useMedicalDates,
} from '../../../shared/components/MedicalCells/index.ts';
import type { MrRow } from '../../../shared/medical-contracts.ts';
import { nextVisitTone } from '../../../shared/medical-tones.ts';

const rowOf = (original: unknown) => original as MrRow;

/** An MR's initials: the rep's own name after the company — "Alvio Pharma · Rakesh" → "RA" (H:5345). */
export function mrInitials(name: string): string {
  const own = name.split(' · ').at(-1) ?? name;
  return own.trim().slice(0, 2).toUpperCase();
}

/**
 * The MRs columns (KICKOFF §6.7 Tables; `medical.md:109–116`): MR · Represents
 * · Last visit · Next visit · Samples (hidden) — tracks `minmax(220px,1.4fr)
 * minmax(180px,1.2fr) 110px 120px 120px`. The next visit is sky ahead and
 * blush once past — against today, not the prototype's fixed "24 Sep". On a
 * phone the MR leads, Represents is the key, the meta line reads the visits.
 */
export function useMrColumns(): ColumnDef<DataTableFeatures, MrRow>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const dates = useMedicalDates();
  const today = clinicToday();
  const keys = MEDICAL_KEYS.mrs;
  const noValue = t(MEDICAL_KEYS.table.noValue);

  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: t(keys.columns.name),
      enableHiding: false,
      cell: ({ row }) => (
        <PersonChip
          name={row.original.name}
          initials={mrInitials(row.original.name)}
          sub={
            row.original.phone
              ? formatClinicPhone(row.original.phone)
              : t(MEDICAL_KEYS.table.addPhone)
          }
          tone="mint"
        />
      ),
      meta: { track: 'minmax(220px,1.4fr)', kind: 'person' },
    },
    {
      id: 'represents',
      accessorFn: (mr) => mr.manufacturers.map((maker) => maker.name),
      header: t(keys.columns.represents),
      enableSorting: false,
      cell: ({ row }) => <MakerPills makers={row.original.manufacturers} />,
      meta: { track: 'minmax(180px,1.2fr)', kind: 'badges' },
    },
    {
      id: 'lastVisit',
      accessorKey: 'lastVisitOn',
      header: t(keys.columns.lastVisit),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="truncate tabular-nums">
          {row.original.lastVisitOn ? dates.day(row.original.lastVisitOn) : noValue}
        </span>
      ),
      meta: {
        track: '110px',
        foldValue: (original) => {
          const last = rowOf(original).lastVisitOn;
          return last ? dates.day(last) : null;
        },
      },
    },
    {
      id: 'nextVisit',
      accessorKey: 'nextVisitOn',
      header: t(keys.columns.nextVisit),
      enableSorting: false,
      cell: ({ row }) => {
        const next = row.original.nextVisitOn;
        if (!next) return null;
        return (
          <TonePill tone={nextVisitTone(next, today)}>
            <span className="tabular-nums">{dates.day(next)}</span>
          </TonePill>
        );
      },
      meta: {
        track: '120px',
        kind: 'badges',
        foldValue: (original) => {
          const next = rowOf(original).nextVisitOn;
          if (!next) return null;
          return {
            value: dates.day(next),
            dotClassName: TONE_CLASSES[nextVisitTone(next, today)].fill,
          };
        },
      },
    },
    {
      id: 'samples',
      accessorKey: 'samples',
      header: t(keys.columns.samples),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {row.original.samples ?? noValue}
        </span>
      ),
      meta: { track: '120px', defaultHidden: true },
    },
  ];
}
