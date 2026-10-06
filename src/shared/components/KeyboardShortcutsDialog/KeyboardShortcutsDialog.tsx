import { useTranslation } from 'react-i18next';

import { SettingsList, SettingsListRow } from '@/shared/components/SettingsCard/index.ts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog.tsx';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return true;
  const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  return /Mac|iPhone|iPad|iPod/i.test(uaData?.platform ?? navigator.userAgent);
}

/**
 * Keyboard shortcuts reference — opened via `?` or Cmd/Ctrl+/ from anywhere in the app shell.
 */
export function KeyboardShortcutsDialog() {
  const { t } = useTranslation(LAYOUT_NS);
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  const mac = isMacPlatform();
  const sk = LAYOUT_KEYS.app.shortcuts;

  const rows: { labelKey: string; keys: string }[] = [
    { labelKey: sk.commandPalette, keys: mac ? '⌘ K' : 'Ctrl K' },
    { labelKey: sk.showShortcuts, keys: '?' },
    { labelKey: sk.showShortcutsAlt, keys: mac ? '⌘ /' : 'Ctrl /' },
    { labelKey: sk.allSections, keys: 'G' },
    { labelKey: sk.jumpToSection, keys: '1–9 · 0' },
    { labelKey: sk.listSearch, keys: '/' },
    { labelKey: sk.leadRows, keys: 'j · k' },
    { labelKey: sk.closeDialog, keys: 'Esc' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" data-testid="keyboard-shortcuts-dialog">
        <DialogHeader>
          <DialogTitle>{t(sk.title)}</DialogTitle>
          <DialogDescription>{t(sk.description)}</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
