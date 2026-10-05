import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  VISIT_NOTE_LIMITS,
  type VisitNote,
} from '@/shared/api/clinic/visits-contracts.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import { useVisitCatalog } from '@/shared/hooks/useVisits/index.ts';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';

const K = VISIT_KEYS.consult;
const ids = VISIT_TEST_IDS.consult;

/** A field's label: 12px, `muted-foreground-strong`, 4px above its box. */
const LABEL = 'text-muted-foreground-strong flex flex-col gap-1 text-xs';

/** A note box over the shadcn field (padding 7px 10px, radius 8px, `canvas`, 13px). */
const BOX =
  'bg-canvas dark:bg-canvas text-body md:text-body text-foreground border-border h-auto rounded-lg px-2.5 py-1.75 shadow-none disabled:cursor-default disabled:opacity-100';

/** Props of {@link ConsultNote}. */
export interface ConsultNoteProps {
  note: VisitNote;
  onChange: (patch: Partial<VisitNote>) => void;
  /** The Rx is approved: the note shows as it was saved. */
  readOnly: boolean;
}

/**
 * "Consult note" (KICKOFF §6.13; `today.md:78–85`; H:2532–2552): Complaint
 * (≤120), Findings (a textarea), Diagnosis (multi-select chips from the
 * clinic's list, picked blush) and Plan (≤120) — all editable, kept in the
 * sheet's draft until Approve. "Dictate a draft" is not built until a
 * dictation service exists (AMBER).
 */
export function ConsultNote({ note, onChange, readOnly }: ConsultNoteProps) {
  const { t } = useTranslation(VISIT_NS);
  const catalog = useVisitCatalog().data;
  const complaintId = useId();
  const findingsId = useId();
  const planId = useId();
  const diagnosisId = useId();
  const options = [...new Set([...(catalog?.diagnoses ?? []), ...note.diagnoses])];

  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-auto px-4.5 py-3.5 max-md:overflow-visible max-md:px-3">
      <h3 className="font-heading text-title font-semibold tracking-[-0.02em]">
        {t(K.note)}
      </h3>
      <label htmlFor={complaintId} className={LABEL}>
        {t(K.complaint)}
        <Input
          id={complaintId}
          value={note.complaint}
          maxLength={VISIT_NOTE_LIMITS.complaint}
          disabled={readOnly}
          onChange={(event) => onChange({ complaint: event.target.value })}
          data-testid={ids.complaint}
          className={BOX}
        />
      </label>
      <label htmlFor={findingsId} className={LABEL}>
        {t(K.findings)}
        <Textarea
          id={findingsId}
          value={note.findings}
          maxLength={VISIT_NOTE_LIMITS.findings}
          disabled={readOnly}
          placeholder={t(K.findingsPlaceholder)}
          onChange={(event) => onChange({ findings: event.target.value })}
          data-testid={ids.findings}
          className={cn(
            BOX,
            'placeholder:text-muted-foreground-strong min-h-[54px] resize-y py-2.25 leading-[1.5]',
          )}
        />
      </label>
      <div role="group" aria-labelledby={diagnosisId} className={cn(LABEL, 'gap-1.5')}>
        <span id={diagnosisId}>{t(K.diagnosis)}</span>
        <div className="flex flex-wrap gap-1.25">
          {options.map((diagnosis) => {
            const on = note.diagnoses.includes(diagnosis);
            return (
              <button
                key={diagnosis}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() =>
                  onChange({
                    diagnoses: on
                      ? note.diagnoses.filter((value) => value !== diagnosis)
                      : [...note.diagnoses, diagnosis],
                  })
                }
                data-testid={ids.diagnosis}
                data-value={diagnosis}
                className={cn(
                  'text-detail rounded-lg border px-2.5 py-1 disabled:cursor-default',
                  on
                    ? 'bg-tone-blush border-tone-blush-border text-tone-blush-foreground'
                    : 'text-foreground bg-transparent',
                )}
              >
                {diagnosis}
              </button>
            );
          })}
        </div>
      </div>
      <label htmlFor={planId} className={LABEL}>
        {t(K.plan)}
        <Input
          id={planId}
          value={note.plan}
          maxLength={VISIT_NOTE_LIMITS.plan}
          disabled={readOnly}
          onChange={(event) => onChange({ plan: event.target.value })}
          data-testid={ids.plan}
          className={BOX}
        />
      </label>
    </div>
  );
}
