import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import {
  firstOpenGuideItem,
  type OnboardingSetup,
  type OnboardingSetupGuideItem,
  type OnboardingSetupSkippableItem,
} from '@/shared/api/app/onboarding-setup-contracts.ts';
import { InviteMemberDialog } from '@/shared/components/InviteMemberDialog/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { useAppRoles } from '@/shared/hooks/useAppRoles/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useChangeOnboardingSetup } from '@/shared/hooks/useOnboardingSetup/index.ts';
import {
  type AppIcon,
  Calendar,
  CheckCircle,
  ClipboardList,
  Settings,
  UserPlus,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { setupEvents } from './setup-analytics.ts';
import { SETUP_KEYS, SETUP_NS } from './setup-drawer.constants.ts';
import { SetupStarterList } from './SetupStarterList.tsx';

const K = SETUP_KEYS.guide;

/** Each item's copy and glyph; "Invite your doctor" while nobody can be booked (D15). */
function itemCopy(item: OnboardingSetupGuideItem, hasSomeoneToBook: boolean) {
  switch (item.key) {
    case 'treatments':
      return { keys: K.items.treatments, icon: ClipboardList };
    case 'invite_team':
      return {
        keys: hasSomeoneToBook ? K.items.inviteTeam : K.items.inviteDoctor,
        icon: UserPlus,
      };
    case 'first_appointment':
      return { keys: { ...K.items.firstAppointment, sub: undefined }, icon: Calendar };
  }
}

/** A guide item's state: done from the records, skipped by a manager, or still open. */
type GuideStatus = 'done' | 'skipped' | 'open';

function guideStatus(item: OnboardingSetupGuideItem): GuideStatus {
  if (item.isDone) return 'done';
  return item.isSkipped ? 'skipped' : 'open';
}

/** An open item's action and its Skip / Undo skip (only on the skippable ones). */
function GuideRowActions({
  item,
  action,
  busy,
  onAction,
  onSkip,
}: {
  item: OnboardingSetupGuideItem;
  action: string;
  busy: boolean;
  onAction: () => void;
  onSkip: (skip: boolean) => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  return (
    <span className="flex flex-none items-center gap-1">
      {item.isSkipped ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAction}
          data-testid={`setup-guide-item-${item.key}-action`}
        >
          {action}
        </Button>
      )}
      {item.canSkip ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onSkip(!item.isSkipped)}
          data-testid={`setup-guide-item-${item.key}-skip`}
        >
          {item.isSkipped ? t(K.undoSkip) : t(K.skip)}
        </Button>
      ) : null}
    </span>
  );
}

/** One guide row: its tick (from the records), title, why, action and Skip / Undo skip. */
function GuideRow({
  item,
  title,
  sub,
  action,
  icon: Icon,
  busy,
  onAction,
  onSkip,
}: {
  item: OnboardingSetupGuideItem;
  title: string;
  sub?: string;
  action: string;
  icon: AppIcon;
  busy: boolean;
  onAction: () => void;
  onSkip: (skip: boolean) => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  const status = guideStatus(item);
  const STATUS_LINE: Record<GuideStatus, string | undefined> = {
    open: sub,
    done: t(K.done),
    skipped: t(K.skipped),
  };
  const line = STATUS_LINE[status];
  const StatusIcon = status === 'done' ? CheckCircle : Icon;
  return (
    <li
      data-testid={`setup-guide-item-${item.key}`}
      data-state={status}
      data-slot="card"
      className="bg-card flex min-w-0 items-center gap-3 rounded-lg border p-3"
    >
      <StatusIcon
        className={cn(
          'size-5 flex-none',
          status === 'done' ? 'text-success' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-field font-medium',
            status !== 'open' && 'text-muted-foreground line-through',
          )}
        >
          {title}
        </span>
        {line ? <span className="text-muted-foreground text-xs">{line}</span> : null}
      </span>
      {status === 'done' ? null : (
        <GuideRowActions
          item={item}
          action={action}
          busy={busy}
          onAction={onAction}
          onSkip={onSkip}
        />
      )}
    </li>
  );
}

/**
 * The short guide behind the profile icon (KICKOFF §6.2; BRIEF.md:82–112): "✓ Consultation added",
 * then the three items, each ticked from the clinic's records — never by hand but Skip (the first
 * appointment cannot be skipped) — and "Hide this guide". Once every item is done or skipped it
 * reads "Your clinic is ready" with Clinic settings (never "All set", the splash's word).
 */
export function SetupGuide({
  setup,
  profile,
  onBook,
  onClose,
}: {
  setup: OnboardingSetup;
  profile: ClinicProfile;
  onBook: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETUP_NS);
  const navigate = useNavigate();
  const [view, setView] = useState<'items' | 'treatments'>('items');
  const [inviting, setInviting] = useState(false);
  const change = useChangeOnboardingSetup();
  const { roles } = useAppRoles();
  const { openBranches } = useBranches();
  const canInvite = useCan({ permission: 'membership:create' });
  const main = openBranches.find((branch) => branch.id === setup.mainBranchId);
  const doctorRoleId =
    roles.find((role) => role.isSystem && role.preset === 'doctor')?.id ?? '';
  const ready = setup.guideDoneAt !== null || firstOpenGuideItem(setup) === null;

  const skip = (key: OnboardingSetupSkippableItem, skipping: boolean) => {
    change.mutate(skipping ? { skippedItemsAdd: [key] } : { skippedItemsRemove: [key] });
    if (skipping) setupEvents.guideItem(key, 'skipped');
  };

  const hide = () => {
    change.mutate(
      { guideHidden: true },
      {
        onSuccess: () => {
          setupEvents.guideHidden();
          notify.success(t(K.hidden));
          onClose();
        },
      },
    );
  };

  const act = (item: OnboardingSetupGuideItem) => {
    if (item.key === 'treatments') setView('treatments');
    else if (item.key === 'invite_team') {
      if (canInvite) setInviting(true);
    } else onBook();
  };

  const openClinicSettings = () =>
    void navigate({
      to: '.',
      hash: settingsHash('organization', 'clinic'),
      search: (previous) => previous,
    });

  let body = (
    <div className="flex flex-col gap-2.5">
      <p
        className="text-detail flex items-center gap-2"
        data-testid="setup-guide-consultation"
      >
        <CheckCircle className="text-success size-4 flex-none" aria-hidden />
        {t(K.consultationAdded)}
      </p>
      <ul className="flex flex-col gap-2">
        {setup.guideItems.map((item) => {
          const copy = itemCopy(item, setup.hasSomeoneToBook);
          return (
            <GuideRow
              key={item.key}
              item={item}
              title={t(copy.keys.title)}
              sub={copy.keys.sub ? t(copy.keys.sub) : undefined}
              action={t(copy.keys.action)}
              icon={copy.icon}
              busy={change.isPending}
              onAction={() => act(item)}
              onSkip={(skipping) => {
                if (item.key !== 'first_appointment') skip(item.key, skipping);
              }}
            />
          );
        })}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-end"
        disabled={change.isPending}
        onClick={hide}
        data-testid="setup-guide-hide"
      >
        {t(K.hide)}
      </Button>
    </div>
  );
  if (view === 'treatments') {
    body = (
      <SetupStarterList
        specialties={profile.specialties}
        onBack={() => setView('items')}
      />
    );
  } else if (ready) {
    body = (
      <div className="flex flex-col items-start gap-3" data-testid="setup-guide-ready">
        <CheckCircle className="text-success size-8" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-field font-semibold">{t(K.ready.title)}</p>
          <p className="text-muted-foreground text-detail">{t(K.ready.sub)}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openClinicSettings}>
          <Settings className="size-4" aria-hidden />
          {t(K.ready.settings)}
        </Button>
      </div>
    );
  }

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(K.title, { clinic: profile.name })}
        band={
          <div className="bg-background flex items-center gap-3 border-b px-(--drawer-pad-x) py-2.5">
            <span className="text-muted-foreground shrink-0 text-xs font-medium">
              {t(K.count, { done: setup.guideDoneCount, total: setup.guideTotalCount })}
            </span>
            <Progress
              value={Math.round((setup.guideDoneCount / setup.guideTotalCount) * 100)}
              aria-label={t(K.count, {
                done: setup.guideDoneCount,
                total: setup.guideTotalCount,
              })}
              className="bg-success/20 [&>[data-slot=progress-indicator]]:bg-success h-1.5 [&>[data-slot=progress-indicator]]:duration-200 motion-reduce:[&>[data-slot=progress-indicator]]:duration-1"
            />
          </div>
        }
        content={{ fieldCount: 6 }}
        closeStyle="form"
        hideFooter
        testId="setup-guide"
      >
        {body}
      </RecordDrawer>
      {inviting ? (
        <InviteMemberDialog
          key={setup.hasSomeoneToBook ? 'team' : doctorRoleId}
          open
          onOpenChange={setInviting}
          defaultRoleId={setup.hasSomeoneToBook ? '' : doctorRoleId}
          memberDefaults={
            main
              ? {
                  branchIds: [main.id],
                  workingDays: main.workingDays,
                  workStartsAt: main.opensAt,
                  workEndsAt: main.closesAt,
                }
              : undefined
          }
          onInvited={() => setupEvents.guideItem('invite_team', 'done')}
        />
      ) : null}
    </>
  );
}
