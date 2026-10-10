import type {
  OfferRecord,
  OfferStatus,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { OFFER_STATE_TONES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

import { CellText } from '../../../shared/components/CatalogueCells/index.ts';
import { useOfferLabels } from '../../../shared/hooks/useOfferLabels/index.ts';
import type { OfferRow } from '../../offers.rows.ts';
import { useOfferText } from './use-offer-text.ts';

/** The Offer cell: the offer's pill in its tone, then a grey code pill ("GLOW20") when it has one. */
export function OfferNameCell({
  offer,
}: {
  offer: Pick<OfferRecord, 'name' | 'tone' | 'code'>;
}) {
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      <TonePill tone={offer.tone}>{offer.name}</TonePill>
      {offer.code ? <TonePill tone="neutral">{offer.code}</TonePill> : null}
    </span>
  );
}

/** The Type cell: the value 600 ("20% off", "at ₹3,999") over its kind ("% off", "Fixed price"). */
export function OfferTypeCell({ offer }: { offer: Pick<OfferRecord, 'kind' | 'value'> }) {
  const labels = useOfferLabels();
  return (
    <CellText
      text={labels.value(offer)}
      sub={labels.kind(offer.kind)}
      weight="semibold"
    />
  );
}

/**
 * The Applies to cell: the first two offerings' names and "+N" — "No offerings"
 * once every one was deleted (OFFERINGS-M4) — over the offer's note.
 */
export function OfferAppliesCell({
  offer,
  nameOf,
}: {
  offer: Pick<OfferRecord, 'offeringIds' | 'note'>;
  nameOf: (offeringId: string) => string | undefined;
}) {
  const text = useOfferText();
  return <CellText text={text.appliesTo(offer, nameOf)} sub={offer.note ?? undefined} />;
}

/**
 * The Valid cell: "22 Sep 2026 – 2 Oct 2026" over "Ends in 28 days", "Starts …",
 * "Over" — by the server's status.
 */
export function OfferValidCell({ row, today }: { row: OfferRow; today: string }) {
  const text = useOfferText();
  return (
    <CellText
      text={text.valid(row)}
      sub={text.validSub(row, today) || undefined}
      className="text-foreground-soft"
    />
  );
}

/**
 * The Status cell, the server's status: "Running" sage · "Scheduled" sky ·
 * "Paused" butter · "Ended" stone, with a dot.
 */
export function OfferStatePill({ status }: { status: OfferStatus }) {
  const labels = useOfferLabels();
  return (
    <TonePill tone={OFFER_STATE_TONES[status]} dot>
      {labels.state(status)}
    </TonePill>
  );
}
