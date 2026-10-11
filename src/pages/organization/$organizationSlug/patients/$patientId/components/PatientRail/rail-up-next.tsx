import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import type {
  PatientFile,
  PatientNextVisit,
} from '@/shared/api/app/patient-file-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useInvoiceTotals } from '@/shared/hooks/useInvoices/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import {
  Calendar,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquare,
  Wallet,
} from '@/shared/icons/index.ts';

import { feedbackCountsText } from '../../shared/patient-feedback.ts';
import { useVisitWhen } from '../../shared/patient-visit.ts';
import { PATIENT_RAIL_KEYS, PATIENT_RAIL_NS } from './patient-rail.constants.ts';

const K = PATIENT_RAIL_KEYS;

/** What the Up next cards open — each hidden when the member can't. */
export interface RailUpNextActions {
  /** "Reschedule" the next visit, or "Book" one. */
  onBook?: (nextVisit: PatientNextVisit | null) => void;
  /** "Collect" → Receive payment for her (`payment:create`). */
  onCollect?: () => void;
  /** The Feedback row → Clinical notes with Feedback open. */
  onFeedback?: () => void;
}

/** What the rail's money card needs — given only to a member who sees billing (Q-F1). */
export interface RailMoney {
  /** The file's money mask (Q-F4) and its toggle — the due card's eye. */
  masked: boolean;
  onToggleMasked: () => void;
}

/** A 28px card button: outline (Reschedule / Book) or primary (Collect). */
function CardButton({
  primary = false,
  onClick,
  children,
  testId,
}: {
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
  testId: string;
}) {
  return (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      size="xs"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'text-xs',
        !primary && 'bg-card text-foreground hover:bg-muted shadow-none',
      )}
    >
      {children}
    </Button>
  );
}

/** The next visit (H:723): a 44px date tile, when and what, Reschedule — or "Not booked" and Book. */
function NextVisitCard({
  visit,
  onBook,
}: {
  visit: PatientNextVisit | null;
  onBook?: RailUpNextActions['onBook'];
}) {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const { formatDate } = useLocaleFormat();
  const when = useVisitWhen();
  const date = visit ? localDateOf(visit.date) : null;
  return (
    <div
      data-slot="rail-next-visit"
      className="bg-card flex items-center gap-2.5 rounded-xl border p-2"
    >
      <span className="bg-channel-call-tint text-tone-sky-foreground flex size-11 flex-none flex-col items-center justify-center rounded-lg leading-none">
        {date ? (
          <>
            <span className="text-[length:calc(var(--text-sm)*17/14)] font-semibold tabular-nums">
              {formatDate(date, { day: 'numeric' }, { civilDay: true })}
            </span>
            <span className="mt-0.5 text-[length:calc(var(--text-xs)*19/24)] font-semibold tracking-[0.06em] uppercase">
              {formatDate(date, { month: 'short' }, { civilDay: true })}
            </span>
          </>
        ) : (
          <Calendar aria-hidden="true" className="size-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        {/* A moment alone on its line reads in its own direction (today's bare time too). */}
        <span
          dir="auto"
          className="text-body truncate [text-align:match-parent] font-semibold"
        >
          {visit ? when(visit) : t(K.notBooked)}
        </span>
        <span dir="auto" className="text-muted-foreground truncate text-xs">
          {visit ? visit.serviceLabel : t(K.noUpcoming)}
        </span>
      </span>
      {onBook ? (
        <CardButton onClick={() => onBook(visit)} testId="patient-rail-book">
          {t(visit ? K.reschedule : K.book)}
        </CardButton>
      ) : null}
    </div>
  );
}

/**
 * What she owes (H:724), the server's over every invoice of hers (`meta.due_total`; one cached
 * read shared with the Billing card): "₹ ••••" with its eye while the file is masked, and
 * Collect; "All paid · nothing due" when nothing is. A bar while it loads; nothing when the read
 * fails — the file's Invoices and Billing card say so, with Retry.
 */
function RailDue({
  patientId,
  money,
  onCollect,
}: {
  patientId: string;
  money: RailMoney;
  onCollect?: () => void;
}) {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const formatRupees = useRupeeFormat();
  const totals = useInvoiceTotals({ patientId });
  if (totals.isPending) return <SkeletonBar shape="field" className="h-14 rounded-xl" />;
  if (!totals.data) return null;
  const { due } = totals.data;
  if (due <= 0) {
    return (
      <div
        data-testid="patient-rail-all-paid"
        className="text-tone-sage-foreground flex items-center gap-1.5 px-1 text-xs"
      >
        <span aria-hidden="true" className="bg-success size-1.5 rounded-full" />
        {t(K.allPaid)}
      </div>
    );
  }
  const { masked, onToggleMasked } = money;
  const eyeLabel = t(masked ? K.showAmount : K.hideAmount);
  const Eyes = masked ? Eye : EyeOff;
  return (
    <div
      data-slot="rail-due"
      className="bg-card border-destructive-border flex items-center gap-2.5 rounded-xl border p-2"
    >
      <span className="bg-tone-blush text-tone-blush-foreground flex size-11 flex-none items-center justify-center rounded-lg">
        <Wallet aria-hidden="true" className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span
          dir="auto"
          data-testid="patient-rail-due"
          className="text-body font-semibold tabular-nums"
        >
          {masked ? t(K.maskedAmount) : formatRupees(due)}
        </span>
        <button
          type="button"
          onClick={onToggleMasked}
          aria-label={eyeLabel}
          aria-pressed={!masked}
          title={eyeLabel}
          data-testid="patient-rail-due-eye"
          className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex size-5.5 flex-none items-center justify-center rounded-md transition-colors"
        >
          <Eyes aria-hidden="true" className="size-3.5" />
        </button>
      </span>
      {onCollect ? (
        <CardButton primary onClick={onCollect} testId="patient-rail-collect">
          {t(K.collect)}
        </CardButton>
      ) : null}
    </div>
  );
}

/**
 * The rail's fixed bottom (H:722–726; `patient-file.md:22`): the next visit; what she owes or
 * "All paid · nothing due", for a member who sees billing (`money`); the Feedback row. What the
 * clinic holds to give back has no read for a patient yet (the pending credits' `left_amount`
 * would be summed here — G-P8).
 */
export function RailUpNext({
  file,
  actions,
  money,
}: {
  file: PatientFile;
  actions: RailUpNextActions;
  /** The money card's mask — absent for a member who does not see billing. */
  money?: RailMoney;
}) {
  const { t } = useTranslation([PATIENT_RAIL_NS, APP_NS]);
  const { feedback } = file;
  const worse = feedback.feel === 'worse';
  const feedbackValue = (() => {
    if (feedback.feel) {
      const feel = t(APP_KEYS.checkInFeels[feedback.feel], { ns: APP_NS });
      return feedback.score === null
        ? feel
        : t(K.feedbackScore, { feel, score: feedback.score });
    }
    if (feedback.review) {
      return t(K.feedbackReview, {
        rating: feedback.review.rating ?? 0,
        source: t(APP_KEYS.reviewSources[feedback.review.source], { ns: APP_NS }),
      });
    }
    return t(K.noFeedback);
  })();

  return (
    <section
      aria-label={t(K.upNext)}
      className="bg-canvas relative flex flex-none flex-col gap-2 border-t px-3.5 pt-3 pb-3.5"
    >
      <span className="text-micro text-muted-foreground font-semibold tracking-wider uppercase">
        {t(K.upNext)}
      </span>
      <NextVisitCard visit={file.nextVisit} onBook={actions.onBook} />
      {money ? (
        <RailDue
          patientId={file.patient.id}
          money={money}
          onCollect={actions.onCollect}
        />
      ) : null}
      <button
        type="button"
        onClick={actions.onFeedback}
        disabled={!actions.onFeedback}
        data-testid="patient-rail-feedback"
        data-slot="rail-feedback"
        className="bg-card hover:bg-muted flex items-center gap-2.5 rounded-xl border py-2 ps-2 pe-2.5 text-start transition-colors disabled:pointer-events-none"
      >
        <span
          className={cn(
            'flex size-8 flex-none items-center justify-center rounded-lg',
            worse
              ? 'bg-tone-blush text-tone-blush-foreground'
              : 'bg-tone-sage text-tone-sage-foreground',
          )}
        >
          <MessageSquare aria-hidden="true" className="size-3.75" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="text-caption text-muted-foreground">{t(K.feedback)}</span>
          <span className="text-body truncate leading-[1.3] font-semibold">
            {feedbackValue}
          </span>
          <span className="text-caption text-muted-foreground truncate">
            {feedbackCountsText(t, feedback)}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="text-disabled size-3.5 flex-none rtl:-scale-x-100"
        />
      </button>
    </section>
  );
}
