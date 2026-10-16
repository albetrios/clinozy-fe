import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { organizationBranchEdit } from '@/lib/routes/branches-builders.ts';
import {
  organizationPatientSection,
  organizationReviewCreate,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import type { PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { firstNameOf, reviewRequestText } from '@/shared/components/ChatColumn/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Skeleton } from '@/shared/components/ui/skeleton.tsx';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { usePatientFeedback } from '@/shared/hooks/useFeedback/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useMessageTranslator } from '@/shared/hooks/useMessageTranslator/index.ts';
import { useQueueContactMessage } from '@/shared/hooks/useThread/index.ts';
import { Check, PenLine, Send, Star } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  PAYMENT_RECEIVED_KEYS,
  PAYMENT_RECEIVED_NS,
  PAYMENT_RECEIVED_TEST_IDS,
} from './payment-received.constants.ts';
import { reviewAskState, reviewsOf } from './payment-received.ts';

const K = PAYMENT_RECEIVED_KEYS.reviews;
const ids = PAYMENT_RECEIVED_TEST_IDS;

/** "Thank you" and "Previous reviews" both name a review's day the same way: "3 Oct". */
function useReviewDay(): (review: PatientReview) => string {
  const { formatDate } = useLocaleFormat();
  return (review) =>
    formatDate(
      localDateOf(review.date),
      { day: 'numeric', month: 'short' },
      { civilDay: true },
    );
}

/** Five stars, the rating's filled; a screen reader hears "Rated 4 of 5" and not the stars. */
function Stars({ rating }: { rating: number }) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  return (
    <span data-slot="review-stars" className="flex items-center gap-0.5">
      <span className="sr-only">{t(K.rated, { rating })}</span>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden="true"
          data-filled={step <= rating ? '' : undefined}
          className={cn('size-3.5', step > rating && 'text-disabled')}
        />
      ))}
    </span>
  );
}

/** One previous review: stars (when rated), the source and day, the first line of its text. */
function ReviewLine({ review, day }: { review: PatientReview; day: string }) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  return (
    <li data-testid={ids.review} className="flex min-w-0 flex-col gap-1 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {review.rating === null ? null : <Stars rating={review.rating} />}
        <span className="text-detail text-foreground font-medium">
          {t(APP_KEYS.reviewSources[review.source])}
        </span>
        <span className="text-detail text-muted-foreground">{day}</span>
        {review.needsAction ? (
          <span
            data-slot="pill"
            className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium"
          >
            {t(K.needsCall)}
          </span>
        ) : null}
      </div>
      {review.text ? (
        <p className="text-detail text-muted-foreground-strong truncate">
          {isolateText(review.text)}
        </p>
      ) : null}
    </li>
  );
}

/** The branch's link is missing: the way to add it, or who can. */
function NoLinkNote({ branchId, canEdit }: { branchId: string; canEdit: boolean }) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  return (
    <p className="text-detail text-muted-foreground">
      {t(K.noLink)}{' '}
      {canEdit ? (
        <Link
          {...organizationBranchEdit(organizationSlug, branchId)}
          // Straight to the step that holds the Google review link.
          search={{ step: 'contact' }}
          data-testid={ids.addLink}
          className="text-foreground font-medium underline underline-offset-2"
        >
          {t(K.addLink)}
        </Link>
      ) : (
        t(K.askAdmin)
      )}
    </p>
  );
}

/** Thanked, not asked: their newest Google review. */
function ThankedLine({ review, day }: { review: PatientReview; day: string }) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  return (
    <p
      data-testid={ids.thanked}
      className="text-detail bg-success/10 text-success-strong flex items-center gap-2 rounded-xl px-3 py-2.5 font-medium"
    >
      <Check aria-hidden="true" className="size-4 shrink-0" />
      {review.rating === null
        ? t(K.thankedNoRating, { date: day })
        : t(K.thanked, { rating: review.rating, date: day })}
    </p>
  );
}

/** "Send on WhatsApp": queues the Review message with the branch's link, then says where it went. */
function SendButton({
  contactId,
  first,
  link,
}: {
  contactId: string;
  first: string;
  link: string | null;
}) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  const tm = useMessageTranslator(PAYMENT_RECEIVED_NS);
  const queue = useQueueContactMessage(contactId);
  const [queued, setQueued] = useState(false);
  const send = () =>
    queue.mutate(
      { channel: 'whatsapp', body: reviewRequestText(tm, first, link ?? '') },
      { onSuccess: () => setQueued(true) },
    );
  let label = t(K.send);
  if (queued) label = t(K.queued, { first: isolateText(first) });
  else if (queue.isPending) label = t(K.sending);
  return (
    <>
      <Button
        type="button"
        variant={queued ? 'outline' : 'default'}
        disabled={!link || queued || queue.isPending}
        onClick={send}
        data-testid={ids.send}
      >
        {queued ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
        {label}
      </Button>
      {queue.isError ? (
        <p role="alert" className="text-detail text-destructive basis-full">
          {t(K.failed)}
        </p>
      ) : null}
    </>
  );
}

/** The ask: "Ask Bhooshan for a Google review", Send on WhatsApp and Log a review. */
function AskCard({
  patientId,
  contactId,
  first,
  branchId,
}: {
  patientId: string;
  contactId: string | null;
  first: string;
  branchId: string;
}) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  const access = useAppAccess();
  const can = (code: string) => access.isResolved && access.canCode(code);
  const { openBranches } = useBranches();
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  const link = openBranches.find((branch) => branch.id === branchId)?.reviewLink ?? null;
  const canSend = can('contact_activity:create') && contactId !== null;
  const logReview = {
    ...organizationReviewCreate(organizationSlug, patientId),
    search: { source: 'google' as const, from: 'overview' as const },
  };
  return (
    <div
      data-testid={ids.ask}
      data-slot="surface"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-body text-foreground font-semibold">
          {t(K.askTitle, { first: isolateText(first) })}
        </h3>
        <p className="text-detail text-muted-foreground">{t(K.askBody)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canSend && contactId ? (
          <SendButton contactId={contactId} first={first} link={link} />
        ) : null}
        {can('patient_review:create') ? (
          <Button asChild variant="outline" data-testid={ids.log}>
            <Link {...logReview}>
              <PenLine aria-hidden="true" />
              {t(K.log)}
            </Link>
          </Button>
        ) : null}
      </div>
      {canSend && !link ? (
        <NoLinkNote branchId={branchId} canEdit={can('branch:update')} />
      ) : null}
    </div>
  );
}

/** The newest few reviews and, past them, "All reviews (7)" to the file's feedback. */
function PreviousReviews({
  patientId,
  recent,
  total,
  dayOf,
}: {
  patientId: string;
  recent: readonly PatientReview[];
  total: number;
  dayOf: (review: PatientReview) => string;
}) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  const organizationSlug = useOrganizationStore((state) => state.organizationSlug) ?? '';
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-detail text-muted-foreground font-semibold tracking-wide uppercase">
          {t(K.previous)}
        </h3>
        {total > recent.length ? (
          <Link
            {...organizationPatientSection(organizationSlug, patientId, 'overview')}
            data-testid={ids.all}
            className="text-detail text-foreground font-medium underline-offset-2 hover:underline"
          >
            {t(K.all, { count: total })}
          </Link>
        ) : null}
      </div>
      <ul className="divide-y">
        {recent.map((review) => (
          <ReviewLine key={review.id} review={review} day={dayOf(review)} />
        ))}
      </ul>
    </div>
  );
}

/** Props for {@link PaymentReviews}. */
export interface PaymentReviewsProps {
  patientId: string;
  contactId: string | null;
  payerName: string;
  /** The branch the payment was taken at — its Google review link is the one sent. */
  branchId: string;
}

/**
 * The review ask after a payment (`feat-payment-celebration` D3, D11, D12): a patient who has not
 * reviewed the clinic on Google is asked — "Send on WhatsApp" queues the composer's Review
 * message with the branch's link in their chat, "Log a review" opens the file's review drawer —
 * and one who has is thanked; then their three newest reviews and "All reviews". Shown only to
 * a member who reads patients; each action only to one allowed to take it.
 */
export function PaymentReviews({
  patientId,
  contactId,
  payerName,
  branchId,
}: PaymentReviewsProps) {
  const access = useAppAccess();
  const canRead = access.isResolved && access.canCode('patient:read');
  const feedback = usePatientFeedback(patientId, { enabled: canRead });
  const dayOf = useReviewDay();

  if (!canRead) return null;
  if (feedback.isPending) {
    return (
      <div data-testid={ids.reviews} aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  // The reviews could not be read: the payment is the point here, the ask can wait.
  if (feedback.isError) return null;

  const state = reviewAskState(reviewsOf(feedback.data));
  return (
    <section data-testid={ids.reviews} className="flex flex-col gap-4">
      {state.google ? (
        <ThankedLine review={state.google} day={dayOf(state.google)} />
      ) : (
        <AskCard
          patientId={patientId}
          contactId={contactId}
          first={firstNameOf(payerName)}
          branchId={branchId}
        />
      )}
      {state.recent.length > 0 ? (
        <PreviousReviews
          patientId={patientId}
          recent={state.recent}
          total={state.total}
          dayOf={dayOf}
        />
      ) : null}
    </section>
  );
}
