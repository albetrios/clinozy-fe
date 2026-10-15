import { platformShortcutKeys, type ShortcutKeys } from '@/lib/apple-platform.ts';

const VOICE_KEYS = {
  apple: { label: '⌘ ⇧ Space', aria: 'Meta+Shift+Space' },
  other: { label: 'Ctrl Shift Space', aria: 'Control+Shift+Space' },
} as const satisfies Record<'apple' | 'other', ShortcutKeys>;

/**
 * This device's keys for speaking into the field in use: "⌘ ⇧ Space" (`Meta+Shift+Space`) on Apple
 * devices, "Ctrl Shift Space" (`Control+Shift+Space`) elsewhere.
 */
export function voiceShortcutKeys(): ShortcutKeys {
  return platformShortcutKeys(VOICE_KEYS);
}

/** The slice of a key press the voice shortcut reads. */
type VoiceKeyPress = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'metaKey'
  | 'ctrlKey'
  | 'shiftKey'
  | 'altKey'
  | 'defaultPrevented'
  | 'isComposing'
>;

/**
 * ⌘ ⇧ Space or Ctrl Shift Space — not with Alt, not mid-composition, not already taken by the
 * field: it starts and stops the microphone of the field in use.
 *
 * @param event - The key press.
 * @returns True for the voice shortcut.
 */
export function isVoiceShortcut(event: VoiceKeyPress): boolean {
  const space = event.code === 'Space' || event.key === ' ';
  const modified = event.shiftKey && (event.metaKey || event.ctrlKey) && !event.altKey;
  return space && modified && !event.defaultPrevented && !event.isComposing;
}
