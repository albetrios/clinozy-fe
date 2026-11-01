import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationHome } from '@/lib/routes/index.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { getAccessToken } from '@/shared/auth/token.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import { PublicCard } from '@/shared/components/PublicFrame/index.ts';
import { Spinner } from '@/shared/components/ui/spinner.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { mapFrontendError } from '@/shared/errors/map-frontend-error.ts';
import { useConsumedSearchToken } from '@/shared/hooks/useConsumedSearchToken/index.ts';
import { CheckCircle, XCircle } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { acceptInvitationAndOpenClinic } from '@/shared/tenancy/accept-invitation.ts';
import {
  clearStashedInviteToken,
  readStashedInviteToken,
  stashInviteToken,
} from '@/shared/tenancy/invite-token-stash.ts';

import {
  ACCEPT_INVITE_REDIRECT_MS,
  ACCEPT_INVITE_TEST_IDS,
  AUTH_KEYS,
  AUTH_NS,
} from './accept-invite.constants.ts';

/**
 * `partial` is the membership-created-but-workspace-not-opened state: the
 * invitation was accepted server-side, so the user IS a member, but the
 * follow-up org switch / token refresh failed. It is a success with a caveat —
 * never an error, and never a reason to send the user back to sign-in.
 */
type Status = 'accepting' | 'success' | 'partial' | 'error';

interface InviteStatusCardProps {
  status: Status;
  error: string | null;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

/**
 * Each outcome's tone, by the status-tone rule the launch keeps for every state
 * (L-62): butter while it is pending, sage once it is done — a join with a
 * caveat is still a join — and blush for trouble.
 */
const INVITE_STATUS_TONES: Readonly<Record<Status, Tone>> = {
  accepting: 'butter',
  success: 'sage',
  partial: 'sage',
  error: 'blush',
};

function InviteStatusCard({
  status,
  error,
  canRetry,
  isRetrying,
  onRetry,
}: Readonly<InviteStatusCardProps>) {
  const { t } = useTranslation(AUTH_NS);

  let icon: ReactNode = <XCircle data-testid={ACCEPT_INVITE_TEST_IDS.error} />;
  if (status === 'accepting') {
    icon = <Spinner data-testid={ACCEPT_INVITE_TEST_IDS.loading} />;
  } else if (status === 'success' || status === 'partial') {
    icon = <CheckCircle data-testid={ACCEPT_INVITE_TEST_IDS.success} />;
  }

  let description: ReactNode = error;
  if (status === 'accepting') description = t(AUTH_KEYS.acceptInvite.accepting);
  else if (status === 'success') description = t(AUTH_KEYS.acceptInvite.success);
  else if (status === 'partial') description = t(AUTH_KEYS.acceptInvite.switchFailed);

  return (
    // The "Signed out" card (H:515) holding the design's empty state: the
    // outcome's tone illustration, its title and line, then the way on.
    <PublicCard aria-live="polite">
      <EmptyState
        className="px-0 py-0"
        tone={INVITE_STATUS_TONES[status]}
        icon={icon}
        headingLevel={1}
        title={
          status === 'error'
            ? t(AUTH_KEYS.acceptInvite.problemTitle)
            : t(AUTH_KEYS.acceptInvite.joiningTitle)
        }
        description={description}
        action={
          status === 'error' ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canRetry && (
                <EmptyStateAction
                  icon={null}
                  onClick={onRetry}
                  disabled={isRetrying}
                  data-testid={ACCEPT_INVITE_TEST_IDS.retry}
                >
                  {t(AUTH_KEYS.common.tryAgain)}
                </EmptyStateAction>
              )}
              <EmptyStateAction
                asChild
                variant={canRetry ? 'outline' : 'default'}
                data-testid={ACCEPT_INVITE_TEST_IDS.login}
              >
                <Link to="/login">{t(AUTH_KEYS.common.goToSignIn)}</Link>
              </EmptyStateAction>
            </div>
          ) : undefined
        }
      />
    </PublicCard>
  );
}

/**
 * Landing page for `/accept-invite/$invitationId?token=…`. Accepts the invitation
 * on mount, then opens the organization the user just joined.
 *
 * Two things it deliberately does NOT do:
 *
 * - **It never reports success and then drops the user at sign-in.** Accepting and
 *   opening the workspace are separate steps. When the accept succeeds but the
 *   switch/refresh behind it fails, the membership is real, so the user stays
 *   signed in: the failure is reported, a warning toast explains it, and the
 *   redirect goes to `/` (the resolver picks the right landing surface). The old
 *   `catch` swallowed that error, claimed success, and sent them to `/login` — a
 *   green check followed by the sign-in page with no explanation (INV-1).
 * - **It never fires two accepts for one gesture.** `acceptInvitation` is a write;
 *   the in-flight ref below is the single-flight guard, flipped synchronously so a
 *   double-click on Try again cannot get past it (`disabled` only lands a render
 *   later). See `agent-os/rules/fe-resilient-interactions.mdc` section 1.
 */
export function AcceptInvitePage() {
  const { t } = useTranslation(AUTH_NS);
  const { invitationId } = useParams({ strict: false });
  const linkToken = useConsumedSearchToken();
  // Back from signing in: the link's token waited in this tab, not in the redirect URL (E-5).
  const [invitationToken] = useState(
    () => linkToken || readStashedInviteToken(invitationId),
  );
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('accepting');
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const startedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether this page still owns the screen. The accept is a chain of long
   * awaits (accept → switch → refresh), and every branch after them either sets
   * state or navigates. Without this, leaving mid-flight meant the finished
   * chain still moved the browser — off whatever page the user had just opened
   * — and still wrote state into a component that was gone (INV-2). The timer
   * was already released on unmount; the awaits were not.
   */
  const aliveRef = useRef(true);

  const redirectAfterDelay = useCallback((run: () => void) => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    redirectTimerRef.current = setTimeout(run, ACCEPT_INVITE_REDIRECT_MS);
  }, []);

  const acceptInvite = useCallback(async () => {
    if (!invitationId) return;
    // The token stays in this tab (`shared/tenancy/invite-token-stash.ts`) — never in the redirect URL.
    const recoverThroughLogin = () => {
      stashInviteToken(invitationId, invitationToken);
      void navigate({
        to: '/login',
        search: { redirect: `/accept-invite/${invitationId}` },
        replace: true,
      });
    };

    try {
      // Accepting requires a signed-in session whose email matches the
      // invite — and the email recipient is usually NOT signed in yet. Send
      // them to login first, carrying this page as the post-login redirect
      // (the token waits in the tab), instead of firing a doomed accept that
      // renders an "Invitation problem: Unauthorized" card for the happy path.
      if (!getAccessToken()) {
        recoverThroughLogin();
        return;
      }
      clearStashedInviteToken();
      // A link without its token still works: clinozy-be lets the signed-in
      // owner of the invited, verified email accept on their own (D84).
      const accepted = await acceptInvitationAndOpenClinic(
        invitationId,
        invitationToken || undefined,
      );

      if (accepted.switchError) {
        // Joined, but this tab could not be moved into the new org. Report it,
        // say so, and hand off to the index resolver — signing the user out of
        // their own successful join would be the worst possible recovery.
        reportError(accepted.switchError, {
          scope: 'accept-invite.switch',
          invitation_id: invitationId,
          organization_id: accepted.organizationId,
        });
        if (!aliveRef.current) return;
        notify.warning(t(AUTH_KEYS.acceptInvite.switchFailedToast));
        setStatus('partial');
        redirectAfterDelay(() => void navigate({ to: '/', replace: true }));
        return;
      }

      if (!aliveRef.current) return;
      setStatus('success');
      // The clinic's home; for someone who has not finished onboarding its guard
      // runs the profile steps first — never the create-a-clinic step (D84).
      const { slug } = accepted;
      redirectAfterDelay(() => {
        if (slug) {
          void navigate({ ...organizationHome(slug), replace: true });
        } else {
          void navigate({ to: '/', replace: true });
        }
      });
    } catch (err) {
      // A 401 here means the session died between boot and accept — the
      // invitation itself is fine, so recover through login, not the card.
      if (!aliveRef.current) return;
      if (err instanceof HttpError && err.status === 401) {
        recoverThroughLogin();
        return;
      }
      setError(mapFrontendError(err));
      setStatus('error');
    }
  }, [invitationId, invitationToken, navigate, redirectAfterDelay, t]);

  /**
   * Single-flight: a second call while the first accept is still running joins
   * that promise instead of POSTing again. The ref flips inside the call, so it
   * closes the double-click window a `disabled` prop cannot.
   */
  const runAccept = useCallback((): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    const promise = acceptInvite().finally(() => {
      inFlightRef.current = null;
      setIsRetrying(false);
    });
    inFlightRef.current = promise;
    return promise;
  }, [acceptInvite]);

  const handleRetry = useCallback(() => {
    if (inFlightRef.current) return;
    setIsRetrying(true);
    setError(null);
    setStatus('accepting');
    void runAccept();
  }, [runAccept]);

  useEffect(() => {
    if (!invitationId) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void runAccept();
  }, [invitationId, runAccept]);

  useEffect(() => {
    // Set on every run, not just the first. A ref outlives React's simulated
    // unmount → remount (Strict Mode does it on every mount, in dev and so in
    // every E2E run), and a cleanup that only ever flips this to `false` leaves
    // the page permanently "gone" to itself: the accept finished, hit
    // `if (!aliveRef.current) return`, and the card sat on "Accepting your
    // invitation…" forever — no success, no error, no redirect. Production has no
    // double mount, which is how it went unnoticed. Same trap, same fix as
    // `BillingPaymentMethods`' `isMountedRef`.
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  if (!invitationId) {
    return null;
  }

  return (
    // The public layout's canvas centres this column; the card brings its own width.
    <div
      className="flex w-full flex-col items-center"
      data-testid={ACCEPT_INVITE_TEST_IDS.page}
    >
      {/* Contained here, a throw inside the status card leaves the public shell
          and its branding standing with a retry in place, instead of escalating
          to the route boundary and replacing the whole screen. */}
      <SectionErrorBoundary
        title={t(AUTH_KEYS.acceptInvite.joiningTitle)}
        testId={ACCEPT_INVITE_TEST_IDS.cardError}
      >
        <InviteStatusCard
          status={status}
          error={error}
          canRetry
          isRetrying={isRetrying}
          onRetry={handleRetry}
        />
      </SectionErrorBoundary>
    </div>
  );
}
