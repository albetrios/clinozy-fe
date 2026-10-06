import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationHome } from '@/lib/routes/index.ts';
import { cn } from '@/lib/utils.ts';
import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';
import { TONE_CLASSES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { CreateOrganizationDialog } from '@/shared/components/CreateOrganizationDialog/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  PublicCard,
  PublicCardHeader,
  PublicFrame,
} from '@/shared/components/PublicFrame/index.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { Building, ChevronRight, Plus } from '@/shared/icons/index.ts';
import {
  type MyOrganizationSummary,
  useMyOrganizationSummaries,
} from '@/shared/tenancy/my-organization-summaries.ts';

/**
 * One organization as an All sections row (`shell.md:43`; H:532): the 28px
 * tile in the name's hashed tone with the 16px icon, the name 13px/600 over
 * the slug 11.5px, a chevron at the end. The active organization is the
 * current row — `canvas` with the `border-strong` edge — and hover is `muted`.
 */
function OrganizationRow({
  organization,
}: {
  organization: MyOrganizationSummary & { slug: string };
}) {
  return (
    <Link
      {...organizationHome(organization.slug)}
      aria-current={organization.isActive ? 'true' : undefined}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-lg border py-1.5 ps-1.5 pe-2 text-start transition-colors',
        organization.isActive
          ? 'bg-canvas border-border-strong'
          : 'hover:bg-muted border-transparent',
      )}
      data-testid={`organization-picker-option-${organization.slug}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 flex-none items-center justify-center rounded-md',
          TONE_CLASSES[toneForLabel(organization.name)].surface,
        )}
      >
        <Building className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span dir="auto" className="text-body truncate leading-[1.3] font-semibold">
          {organization.name}
        </span>
        <span
          dir="ltr"
          className="text-muted-foreground text-caption truncate [text-align:match-parent] leading-[1.3]"
        >
          {organization.slug}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * The organization list. Split out so the boundary below wraps a real unit: a
 * throw in a row (a malformed slug, a missing field) takes the list, not the
 * page — and the `Create organization` action underneath stays reachable, which
 * matters because this screen is where the resolver sends a user who has
 * nowhere else to land.
 */
function OrganizationList() {
  const { t } = useTranslation(AUTH_NS);
  /*
   * The same list, under the same cache key, that the guard chain and the
   * switcher read. The guard that sent the user here already resolved
   * it, so the FIRST paint shows the real list instead of flashing two skeletons
   * for the length of a cached response (PICK-2). The hook raises no toast; this
   * list renders its own error card with a retry.
   */
  const { data, isLoading, isError, refetch } = useMyOrganizationSummaries();
  // A personal organization has no slug, so it has no row to link to.
  const organizations = (data ?? []).filter(
    (org): org is MyOrganizationSummary & { slug: string } => org.slug !== null,
  );

  const isEmpty = !(isLoading || isError) && organizations.length === 0;

  return (
    <>
      {isLoading && (
        <>
          <SkeletonBar shape="field" className="h-11" />
          <SkeletonBar shape="field" className="h-11" />
        </>
      )}

      {isError && (
        // The design's dashed card (EmptyState `card`), with the retry as its action.
        <div data-testid="organization-picker-error">
          <EmptyState
            variant="card"
            title={t(AUTH_KEYS.organizationPicker.loadError)}
            action={
              /*
                No `disabled`/spinner here on purpose. Retrying resets the query to
                pending, so this whole card unmounts and the skeletons below take
                its place — the feedback PICK-1 asked for, and a button that is
                gone cannot be spammed. A disabled state would never be rendered.
              */
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                data-testid="organization-picker-retry"
              >
                {t(AUTH_KEYS.common.tryAgain)}
              </Button>
            }
          />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          variant="inline"
          testId="organization-picker-empty"
          title={t(AUTH_KEYS.organizationPicker.empty)}
          className="px-1.5 py-2"
        />
      )}

      {!(isLoading || isError) &&
        organizations.map((organization) => (
          <OrganizationRow key={organization.id} organization={organization} />
        ))}
    </>
  );
}

/**
 * Organization picker — choose which organization to enter. Selecting one
 * navigates to its home (the member's role home); the organization guard syncs
 * context from the URL and persists the choice for the `/` resolver. The
 * signed-out canvas and its 360px card: the heading, the list as All sections
 * rows, then "Create organization".
 */
export function OrganizationPickerPage() {
  const { t } = useTranslation(AUTH_NS);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PublicFrame
      testId="organization-page"
      mainId="organization-main"
      controls={<ThemeModeToggle surface="frame" />}
    >
      <PublicCard>
        <PublicCardHeader
          title={t(AUTH_KEYS.organizationPicker.heading)}
          description={t(AUTH_KEYS.organizationPicker.subheading)}
        />

        <div className="-mx-1.5 flex flex-col gap-0.5">
          <SectionErrorBoundary
            title={t(AUTH_KEYS.organizationPicker.listTitle)}
            testId="organization-picker-list-error"
          >
            <OrganizationList />
          </SectionErrorBoundary>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => setCreateOpen(true)}
          data-testid="organization-picker-create"
        >
          <Plus className="size-4" />
          {t(AUTH_KEYS.organizationPicker.create)}
        </Button>
      </PublicCard>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PublicFrame>
  );
}
