import { useNavigate, useRouterState } from '@tanstack/react-router';
import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { RecordDrawerPending } from '@/shared/components/RecordDrawer/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useClinicProfile } from '@/shared/hooks/useClinicProfile/index.ts';
import {
  useChangeOnboardingSetup,
  useOnboardingSetup,
} from '@/shared/hooks/useOnboardingSetup/index.ts';

import { setupEvents, type SetupEventStep } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import { parseSetupHash, setupHash, type SetupHashStep } from './setup-hash-grammar.ts';
import { canonicalSetupPlace } from './setup-place.ts';
import { SetupGuide } from './SetupGuide.tsx';
import { SetupLive } from './SetupLive.tsx';
import { SetupStepsDrawer } from './SetupStepsDrawer.tsx';

/** A drawer place as the setup events name it. */
const EVENT_STEP: Record<SetupHashStep, SetupEventStep> = {
  'clinic-type': 'clinic_type',
  location: 'location',
  you: 'you',
  live: 'guide',
  guide: 'guide',
};

/** The shared appointment form, in its own chunk — as Today loads it. */
const loadAppointmentForm = onceAsync(() =>
  import('@/shared/forms/AppointmentForm/index.ts').then((module) => ({
    default: module.AppointmentForm,
  })),
);

/** "Book your first appointment": the shared booking form over the room (BRIEF.md:76). */
function SetupBooking({
  clinicCreatedAt,
  onClose,
}: {
  clinicCreatedAt: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(APP_NS);
  const { Component: AppointmentForm, retry } = useRetryableLazy(loadAppointmentForm);
  return (
    <SectionErrorBoundary
      title={t(APP_KEYS.sections.appointments.label)}
      onReset={retry}
      testId="setup-booking-error"
      variant="inline"
    >
      <Suspense fallback={null}>
        <AppointmentForm
          open
          mode="create"
          prefill={{}}
          onClose={onClose}
          onSaved={() => {
            setupEvents.firstAppointmentBooked(clinicCreatedAt);
            onClose();
          }}
        />
      </Suspense>
    </SectionErrorBoundary>
  );
}

/**
 * The clinic setup drawer (feat-clinic-setup KICKOFF §6.1, §6.2): reads the setup and the clinic,
 * puts the address where it belongs (`replace`), and shows the three steps while the clinic is not
 * live, "You're live" right after, and the guide from then on. Closing it while not live is
 * "Explore first": the server stores the deferral once (D2, D5) and the drawer stops opening by
 * itself.
 */
export function SetupDrawer() {
  const { t } = useTranslation(SETUP_NS);
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const setupQuery = useOnboardingSetup();
  const profileQuery = useClinicProfile();
  const defer = useChangeOnboardingSetup({ notifyOnError: false });
  const [booking, setBooking] = useState(false);
  const setup = setupQuery.data;
  const profile = profileQuery.data;
  const place = parseSetupHash(hash);
  const canonical =
    setup && place !== undefined ? canonicalSetupPlace(setup, place) : null;

  const goTo = (step: SetupHashStep) =>
    void navigate({
      to: '.',
      hash: setupHash(step),
      search: (previous) => previous,
      replace: true,
    });

  useEffect(() => {
    if (canonical && place !== canonical) {
      void navigate({
        to: '.',
        hash: setupHash(canonical),
        search: (previous) => previous,
        replace: true,
      });
    }
  }, [canonical, place, navigate]);

  const close = () => {
    if (setup && !setup.isLive && setup.deferredAt === null) {
      defer.mutate({ deferred: true });
      setupEvents.deferred(canonical ? EVENT_STEP[canonical] : 'clinic_type');
    }
    void navigate({ to: '.', hash: '', search: (previous) => previous, replace: true });
  };

  if (!(setup && profile && canonical)) {
    return (
      <RecordDrawerPending
        open
        onClose={close}
        title={t(SETUP_KEYS.drawer.title, { clinic: profile?.name ?? '' })}
        recordLabel={t(SETUP_KEYS.drawer.progressLabel)}
        content={{ fieldCount: 8 }}
        testId="setup-drawer"
      />
    );
  }

  let drawer: ReactNode;
  if (canonical === 'live') {
    drawer = (
      <SetupLive
        setup={setup}
        profile={profile}
        onBook={() => setBooking(true)}
        onClose={close}
      />
    );
  } else if (canonical === 'guide') {
    drawer = (
      <SetupGuide
        setup={setup}
        profile={profile}
        onBook={() => setBooking(true)}
        onClose={close}
      />
    );
  } else {
    drawer = (
      <SetupStepsDrawer
        setup={setup}
        profile={profile}
        step={canonical}
        // A live clinic re-opening its branch goes back to the guide once it is saved.
        onStepChange={(step) => goTo(setup.isLive ? 'guide' : step)}
        onClose={close}
      />
    );
  }

  return (
    <>
      {drawer}
      {booking ? (
        <SetupBooking
          clinicCreatedAt={profile.createdAt}
          onClose={() => setBooking(false)}
        />
      ) : null}
    </>
  );
}
