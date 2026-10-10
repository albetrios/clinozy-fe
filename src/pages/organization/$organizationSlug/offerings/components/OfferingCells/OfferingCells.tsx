import { cn } from '@/lib/utils.ts';
import type { OfferingCategory } from '@/shared/api/clinic/clinic-schema.ts';
import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import type { EffectivePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

import type { OfferingRow } from '../../offerings.rows.ts';
import { CellText } from '../../shared/components/CatalogueCells/index.ts';
import { useOfferLabels } from '../../shared/hooks/useOfferLabels/index.ts';
import { useOfferingText } from './use-offering-text.ts';

/** The Offering cell: the name 13px/500 over its description, or "Valid 60 days". */
export function OfferingNameCell({ row }: { row: OfferingRow }) {
  const text = useOfferingText();
  return <CellText text={row.name} sub={text.sub(row)} weight="medium" />;
}

/** The Category cell: the category's pill in its tone (Consultation sky · Treatment sage …). */
export function OfferingCategoryPill({ category }: { category: OfferingCategory }) {
  const text = useOfferingText();
  return (
    <TonePill tone={OFFERING_CATEGORY_TONES[category]}>
      {text.category(category)}
    </TonePill>
  );
}

/**
 * The Price cell, at the inline end: what is billed today, 600 — below it
 * "was ₹1,500 · 20% off" in the sage ink, or a grey "list price".
 */
export function OfferingPriceCell({ priced }: { priced: EffectivePrice<OfferRecord> }) {
  const text = useOfferingText();
  return (
    <CellText
      text={text.price(priced)}
      sub={text.priceSub(priced)}
      align="end"
      weight="semibold"
      subClassName={
        priced.final < priced.list ? 'text-tone-sage-foreground' : 'text-muted-foreground'
      }
    />
  );
}

/** The Offer cell: the winning Running offer's pill in its tone; its value is the tooltip ("20% off"). */
export function OfferingOfferCell({ offer }: { offer: OfferRecord | null }) {
  const labels = useOfferLabels();
  if (!offer) return null;
  return (
    <TonePill tone={offer.tone} title={labels.value(offer)}>
      {offer.name}
    </TonePill>
  );
}

/** The Duration cell: "45 min", or a grey "—" for a product (`offeringDuration`). */
export function OfferingDurationCell({ minutes }: { minutes: number | null }) {
  const text = useOfferingText();
  return (
    <span
      className={cn(
        'text-body truncate leading-[1.3] tabular-nums',
        minutes === null ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {text.duration(minutes)}
    </span>
  );
}

/** The Sessions cell: "6 sessions + 1 free" over "valid 180 days". */
export function OfferingSessionsCell({ row }: { row: OfferingRow }) {
  const text = useOfferingText();
  return (
    <CellText
      text={text.sessions(row.sessions, row.priced.extraSessions)}
      sub={text.validFor(row.validityDays)}
    />
  );
}

/** The Status cell: "Active" sage with a dot, or "Inactive" grey with a dot. */
export function OfferingStatusPill({ isActive }: { isActive: boolean }) {
  const text = useOfferingText();
  return (
    <TonePill tone={isActive ? 'sage' : 'neutral'} dot>
      {text.status(isActive)}
    </TonePill>
  );
}
