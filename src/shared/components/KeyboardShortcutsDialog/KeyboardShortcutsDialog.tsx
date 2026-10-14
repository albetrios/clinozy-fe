import { useTranslation } from 'react-i18next';

import { isApplePlatform } from '@/lib/apple-platform.ts';
import {
  type DrawerContentProfile,
  RecordDrawer,
} from '@/shared/components/RecordDrawer/index.ts';
import { saveShortcutLabel } from '@/shared/components/RecordDrawer/record-drawer-save-shortcut.ts';
import { SettingsList, SettingsListRow } from '@/shared/components/SettingsCard/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

/** The reference's test id; the record drawer derives its parts' ids from it. */
const KEYBOARD_SHORTCUTS_TEST_ID = 'keyboard-shortcuts-dialog';

/**
 * A read-only list — no fields at all — so the record drawer's light width,
 * 560px from `md`.
 */
const SHORTCUTS_DRAWER_CONTENT: DrawerContentProfile = { fieldCount: 0 };

/**
 * Keyboard shortcuts reference — opened via `?` or Cmd/Ctrl+/ from anywhere in
 * the app shell, and from the Account menu and ⌘K. A drawer like every other
 * overlay (Settings, Appearance, the rooms' records): from `md` a panel at the
 * inline end with the floating ×, the full screen below `md`. The list sits on
 * the canvas with no footer; Esc, the backdrop and the × close it.
 */
export function KeyboardShortcutsDialog() {
  const { t } = useTranslation(LAYOUT_NS);
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  const mac = isApplePlatform();
  const sk = LAYOUT_KEYS.app.shortcuts;

  const rows: { labelKey: string; keys: string }[] = [
    { labelKey: sk.commandPalette, keys: mac ? '⌘ K' : 'Ctrl K' },
    { labelKey: sk.showShortcuts, keys: '?' },
    { labelKey: sk.showShortcutsAlt, keys: mac ? '⌘ /' : 'Ctrl /' },
    { labelKey: sk.allSections, keys: 'G' },
    { labelKey: sk.jumpToSection, keys: '1–9 · 0' },
    { labelKey: sk.listSearch, keys: '/' },
    { labelKey: sk.leadRows, keys: 'j · k' },
    { labelKey: sk.saveForm, keys: saveShortcutLabel(mac) },
    { labelKey: sk.closeDialog, keys: 'Esc' },
  ];

  return (
    <RecordDrawer
      open={open}
      onClose={() => setOpen(false)}
      title={t(sk.title)}
      sub={t(sk.description)}
      content={SHORTCUTS_DRAWER_CONTENT}
      hideFooter
      bodyClassName="bg-canvas"
      testId={KEYBOARD_SHORTCUTS_TEST_ID}
    >
      {/* The settings list's table rows; each key as the design's kbd (mono, 4px). */}
      <SettingsList>
        {rows.map((row) => (
          <SettingsListRow key={row.labelKey} className="justify-between gap-4">
            <span className="text-body">{t(row.labelKey)}</span>
            <kbd
              data-slot="kbd"
              className="bg-canvas text-foreground-soft text-micro rounded-sm border px-1.5 py-0.5 font-mono"
            >
              {row.keys}
            </kbd>
          </SettingsListRow>
        ))}
      </SettingsList>
    </RecordDrawer>
  );
}
