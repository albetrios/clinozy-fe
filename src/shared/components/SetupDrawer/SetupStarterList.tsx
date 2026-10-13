import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import {
  GST_PERCENT_VALUES,
  type GstPercent,
} from '@/shared/api/app/offerings-contracts.ts';
import {
  isConsultationRow,
  type StarterService,
  starterServicesFor,
} from '@/shared/app/app-starter-services.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { OfferingQuickCreate } from '@/shared/components/OfferingQuickCreate/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Checkbox } from '@/shared/components/ui/checkbox.tsx';
import { useCreateOffering, useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { ChevronLeft, Plus } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { starterOfferingFields } from './go-live.ts';
import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import { useConsultationName } from './use-consultation-name.ts';

const K = SETUP_KEYS.starter;

/** One editable starter row: the service, its name in the clinic's words, ticked or not. */
interface StarterRow {
  key: string;
  service: StarterService;
  specialty: OfferingSpecialty;
  name: string;
  minutes: number;
  price: number;
  gstPercent: GstPercent;
  ticked: boolean;
  /** The clinic has an offering of this name already — shown done, never sent again. */
  exists: boolean;
}

/** A whole-number field's value: digits only, empty as 0. */
const wholeNumber = (text: string) => Number(text.replaceAll(/\D/g, '') || '0');

/**
 * "Add your treatments" (KICKOFF §6.2; BRIEF.md:104–106): the starter list for the chosen
 * specialties (`plans/decisions.md` › Starter services), each row ticked or not, its name, minutes,
 * price and GST editable; the Consultations the clinic has are shown done. "Add" creates one
 * offering per ticked row; "Add your own" opens the house quick create.
 */
export function SetupStarterList({
  specialties,
  onBack,
}: {
  specialties: readonly OfferingSpecialty[];
  onBack: () => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  const consultationName = useConsultationName();
  const { data: offerings = [] } = useOfferings({ notifyOnError: false });
  const create = useCreateOffering({ successMessage: undefined });
  const [ownOpen, setOwnOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const taken = new Set(
    offerings.map((offering) => offering.name.trim().toLocaleLowerCase()),
  );
  const [rows, setRows] = useState<StarterRow[]>(() =>
    starterServicesFor(specialties).map((service) => {
      const name = isConsultationRow(service)
        ? consultationName(service.specialty, specialties.length)
        : t(service.nameKey);
      return {
        key: `${service.specialty}-${service.nameKey}`,
        service,
        specialty: service.specialty,
        name,
        minutes: service.durationMinutes,
        price: service.price,
        gstPercent: service.gstPercent,
        ticked: service.isTicked,
        exists: false,
      };
    }),
  );
  // An offering made meanwhile shows done; nothing is ticked by default once it exists.
  const shown = rows.map((row) => ({
    ...row,
    exists: taken.has(row.name.trim().toLocaleLowerCase()),
  }));
  const toAdd = shown.filter(
    (row) => row.ticked && !row.exists && row.name.trim() !== '',
  );

  const update = (key: string, change: Partial<StarterRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );

  const add = async () => {
    if (toAdd.length === 0) {
      notify.info(t(K.nothingTicked));
      return;
    }
    setAdding(true);
    let added = 0;
    try {
      for (const row of toAdd) {
        await create.mutateAsync({
          fields: {
            ...starterOfferingFields(row.service, row.name.trim()),
            durationMin: row.minutes,
            price: row.price,
            gstPercent: row.gstPercent,
          },
          specialty: row.specialty,
        });
        added += 1;
      }
      setupEvents.guideItem('treatments', 'done');
      notify.success(t(K.added, { count: added }));
      onBack();
    } catch {
      if (added > 0) notify.success(t(K.added, { count: added }));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="setup-starter">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onBack}
        data-testid="setup-starter-back"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t(K.back)}
      </Button>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-field font-semibold">{t(K.title)}</h3>
        <p className="text-muted-foreground text-detail">{t(K.sub)}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((row) => (
          <li
            key={row.key}
            data-testid={`setup-starter-row-${row.key}`}
            data-slot="card"
            className="bg-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 rounded-lg border p-2.5 md:grid-cols-[auto_minmax(0,1fr)_4.5rem_6rem_5rem]"
          >
            <Checkbox
              checked={row.exists || row.ticked}
              disabled={row.exists}
              aria-label={t(K.rowLabel, { name: row.name })}
              onCheckedChange={(checked) => update(row.key, { ticked: checked === true })}
              data-testid={`setup-starter-row-${row.key}-tick`}
            />
            <DrawerInput
              aria-label={t(K.name)}
              value={row.name}
              disabled={row.exists}
              onChange={(event) => update(row.key, { name: event.currentTarget.value })}
            />
            {row.exists ? (
              <span className="text-success text-xs font-medium max-md:col-start-2 md:col-span-3">
                {t(K.exists)}
              </span>
            ) : (
              <>
                <DrawerInput
                  aria-label={t(K.minutes)}
                  inputMode="numeric"
                  capitalize={false}
                  value={String(row.minutes)}
                  className="max-md:col-start-2"
                  onChange={(event) =>
                    update(row.key, { minutes: wholeNumber(event.currentTarget.value) })
                  }
                />
                <DrawerInput
                  aria-label={t(K.price)}
                  inputMode="numeric"
                  capitalize={false}
                  value={String(row.price)}
                  className="max-md:col-start-2"
                  onChange={(event) =>
                    update(row.key, { price: wholeNumber(event.currentTarget.value) })
                  }
                />
                <select
                  aria-label={t(K.gst)}
                  value={row.gstPercent}
                  onChange={(event) =>
                    update(row.key, {
                      gstPercent: Number(event.currentTarget.value) as GstPercent,
                    })
                  }
                  className="border-input text-body h-9 rounded-lg border bg-transparent px-2 max-md:col-start-2"
                >
                  {GST_PERCENT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOwnOpen(true)}
          data-testid="setup-starter-add-own"
        >
          <Plus className="size-4" aria-hidden />
          {t(K.addOwn)}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={adding}
          onClick={() => void add()}
          data-testid="setup-starter-add"
        >
          {adding ? t(K.adding) : t(K.add, { count: toAdd.length })}
        </Button>
      </div>
      <OfferingQuickCreate
        open={ownOpen}
        onClose={() => setOwnOpen(false)}
        onCreated={() => setOwnOpen(false)}
      />
    </div>
  );
}
