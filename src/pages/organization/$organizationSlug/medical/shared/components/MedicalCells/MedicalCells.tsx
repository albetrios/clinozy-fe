import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { MedicineMaker } from '@/shared/api/clinic/medicines-contracts.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';

/** The manufacturers as pills in their own tones (`medical.md:45, 77`). */
export function MakerPills({ makers }: { makers: readonly MedicineMaker[] }) {
  if (makers.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {makers.map((maker) => (
        <TonePill key={maker.id} tone={maker.tone}>
          {maker.name}
        </TonePill>
      ))}
    </span>
  );
}

/** Names as grey pills (a manufacturer's suppliers) or in one tone (its MRs, mint). */
export function NamePills({
  names,
  tone = 'neutral',
}: {
  names: readonly { id: string; name: string }[];
  tone?: Tone | 'neutral';
}) {
  if (names.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {names.map((entry) => (
        <TonePill key={entry.id} tone={tone}>
          {entry.name}
        </TonePill>
      ))}
    </span>
  );
}
