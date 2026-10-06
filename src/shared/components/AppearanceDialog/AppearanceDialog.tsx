import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  APPEARANCE_DIALOG_KEYS,
  APPEARANCE_DIALOG_NS,
  APPEARANCE_DRAWER_CONTENT,
  APPEARANCE_TEST_IDS,
} from './appearance-dialog.constants.ts';
import { AppearancePanel } from './AppearancePanel.tsx';

/**
 * Appearance as a drawer — the record drawer every room opens, so it reads like
 * the rest (and like Settings): from `md` a panel at the inline end over the
 * drawers' backdrop with the floating ×, the full screen below `md`. Its title
 * and sub line head it; the body is the mode and the device's locale cards on
 * the canvas, with no footer — every choice applies live. Esc, the backdrop and
 * the × close it; focus starts on the title and goes back to what opened it.
 *
 * Loaded on demand (`AppearanceDialogLazy`, mounted on the root route): this
 * module brings the record drawer, which must not ride the entry chunk. Open
 * state lives in `useUIStore`. A throw in the body stays in the body
 * (`SectionErrorBoundary`), so the drawer and its × keep working.
 */
export function AppearanceDialog() {
  const { t } = useTranslation(APPEARANCE_DIALOG_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const open = useUIStore((s) => s.appearanceOpen);
  const setOpen = useUIStore((s) => s.setAppearanceOpen);

  return (
    <RecordDrawer
      open={open}
      onClose={() => setOpen(false)}
      title={t(APPEARANCE_DIALOG_KEYS.title)}
      sub={t(APPEARANCE_DIALOG_KEYS.description)}
      content={APPEARANCE_DRAWER_CONTENT}
      hideFooter
      bodyClassName="bg-canvas"
      testId={APPEARANCE_TEST_IDS.drawer}
      closeTestId={APPEARANCE_TEST_IDS.close}
    >
      <SectionErrorBoundary
        title={tErrors(ERRORS_KEYS.widget.appearance)}
        testId={APPEARANCE_TEST_IDS.error}
        variant="inline"
      >
        <AppearancePanel />
      </SectionErrorBoundary>
    </RecordDrawer>
  );
}
