import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { InvoiceType } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-fixture-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  useFixtureOfferings,
  useFixtureOffers,
} from '@/shared/hooks/useFixtureOfferings/index.ts';
import { useMedicineCatalogue } from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import {
  type InvoiceCatalogItem,
  medicineCatalogItem,
  offeringCatalogItem,
  offeringsFor,
} from './invoice-lines.ts';

const K = INVOICE_DRAWER_KEYS.items;

/** What the drawer bills from, for the invoice's type and branch. */
export interface InvoiceCatalog {
  /** The offerings (or medicines) the type lists, in the catalogue's order. */
  items: InvoiceCatalogItem[];
  byKey: ReadonlyMap<string, InvoiceCatalogItem>;
  /** Every offering by id — a saved line's floor and sessions, listed or not. */
  offerings: ReadonlyMap<string, OfferingRecord>;
  /** Each entry's sub line ("Package · 6 sessions", "8 in stock · Adapalene…") and its price. */
  words: (item: InvoiceCatalogItem) => { sub: string; meta: string };
  /** The row picker's options. */
  options: PickerOption<InvoiceCatalogItem>[];
  isLoading: boolean;
}

/**
 * The Invoice drawer's catalogue (KICKOFF §6.9 Items): a clinic or
 * consultation invoice lists its type's offerings at the branch — each at its
 * effective price, with its live offer named — and a Medical one the medicines
 * at MRP with their stock. The offerings and offers are the fixture world's
 * (`useFixtureOfferings`, `useFixtureOffers`) until Payments moves to clinozy-be; the medicines
 * share the Medical room's cache entry (`useMedicineCatalogue`).
 */
export function useInvoiceCatalog(
  type: InvoiceType,
  branchId: string | null,
): InvoiceCatalog {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const medical = type === 'medical';
  const offerings = useFixtureOfferings();
  const offers = useFixtureOffers();
  const medicines = useMedicineCatalogue();
  const today = clinicToday();

  const items = useMemo(() => {
    if (medical) return (medicines.data ?? []).map(medicineCatalogItem);
    return offeringsFor(offerings.data ?? [], type, branchId).map((offering) =>
      offeringCatalogItem(offering, branchId, offers.data ?? [], today),
    );
  }, [medical, medicines.data, offerings.data, offers.data, type, branchId, today]);

  const words = (item: InvoiceCatalogItem) => {
    if (item.kind === 'medicine') {
      const stock =
        item.stock && item.stock > 0
          ? t(K.inStock, { count: item.stock })
          : t(K.outOfStock);
      return {
        sub: [stock, item.detail].filter(Boolean).join(' · '),
        meta: formatPaise(item.price),
      };
    }
    const parts = [
      item.detail
        ? t(CLINIC_KEYS.offerings.categories[item.group as OfferingRecord['category']])
        : '',
      item.sessions > 1 ? t(K.sessions, { count: item.sessions }) : '',
      item.promo ?? '',
    ];
    return { sub: parts.filter(Boolean).join(' · '), meta: formatPaise(item.price) };
  };

  return {
    items,
    byKey: new Map(items.map((item) => [item.key, item])),
    offerings: new Map((offerings.data ?? []).map((offering) => [offering.id, offering])),
    words,
    options: items.map((item) => ({
      key: item.key,
      label: item.label,
      ...words(item),
      keywords: item.keywords ? [item.keywords] : undefined,
      data: item,
    })),
    isLoading: medical ? medicines.isPending : offerings.isPending || offers.isPending,
  };
}
