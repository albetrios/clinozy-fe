import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useRefreshSettle } from '@/lib/animations/index.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { BugReportLazy } from '@/shared/components/BugReport/index.ts';
import { CommandPaletteLazy } from '@/shared/components/CommandPalette/index.ts';
import { KeyboardShortcutsLazy } from '@/shared/components/KeyboardShortcutsDialog/KeyboardShortcutsLazy.tsx';
import { SessionTimeoutDialog } from '@/shared/components/SessionTimeoutDialog/index.ts';
import { UploadTray } from '@/shared/components/UploadTray/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { WorkspaceSwitchOverlay } from '@/shared/components/WorkspaceSwitchOverlay/index.ts';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useOrgBrand } from '@/shared/hooks/useOrgBrand/index.ts';
import { SkipLink } from '@/shared/layouts/AppLayout/AppLayout.shared.tsx';
import { SectionBarShell } from '@/shared/layouts/AppLayout/AppLayoutSectionBar.tsx';

/**
 * Main authenticated layout: the clinic launch's one shell, the section bar
 * (KICKOFF §3.2) — one design per surface, so there is no shell to pick. The
 * org shell route only renders it for a team deployment (`requireTeamDeployment`,
 * D44). Exports `Component` for lazy() resolution. It also settles every list
 * the in-place skeleton leaves (`useRefreshSettle`, change-motion-polish).
 */
export function Component() {
  useOrgBrand();
  useRefreshSettle();
  const { t } = useTranslation(ERRORS_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const { entries: navItems } = useAppNav();

  return (
    <div className="bg-background flex h-screen overflow-hidden" data-testid="app-layout">
      <SkipLink />
      <WorkspaceSwitchOverlay />
      {/* House rule 2. The shell renders the nav, the brand, the branch picker
          and the Account menu; without this, a throw in any of them escalates
          to the route boundary and replaces the whole authenticated
          application. Contained here the user keeps a retry, and the dialogs
          below stay mounted. The shell is a child of the boundary, never this
          component's own render — a throw there would escape past it. */}
      <SectionErrorBoundary
        title={t(ERRORS_KEYS.widget.navigation)}
        testId="app-shell-error"
      >
        <SectionBarShell navItems={navItems} organizationSlug={organizationSlug} />
      </SectionErrorBoundary>
      <CommandPaletteLazy />
      <KeyboardShortcutsLazy />
      <SessionTimeoutDialog />
      {/* Here, not in the shell: an upload outlives the screen that started it,
          and a Retry on the shell boundary must not drop it. Renders nothing
          when idle. */}
      <UploadTray />
      {/* Report a bug — the bottom-end corner, for the signed-in person (iteration
          feat-bug-report-2026-10-13-dgnx). Beside the tray, outside the shell boundary, so a
          Retry there never drops a report being written. */}
      <BugReportLazy />
    </div>
  );
}
