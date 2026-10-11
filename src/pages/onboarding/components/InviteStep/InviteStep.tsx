import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { toneForLabel } from '@/shared/app/app-tones.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/drawer-text-controls.tsx';
// The field and its input by their own modules: onboarding stays free of the drawer controls.
import { DrawerField } from '@/shared/components/DrawerField/DrawerField.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { Plus, X } from '@/shared/icons/index.ts';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import {
  ONBOARDING_KEYS,
  ONBOARDING_NS,
  ONBOARDING_TEST_IDS,
} from '../../onboarding.constants.ts';

const inviteEmailSchema = z.string().trim().pipe(z.email());

/** Collects optional teammate emails; the final step sends the invitations. */
export function InviteStep() {
  const { t } = useTranslation(ONBOARDING_NS);
  /*
   * Field-level selectors (ONB-13). `useOnboardingStore()` with no selector
   * subscribes to the whole store, and `patch` replaces the entire `data`
   * object, so this component re-rendered on every keystroke anywhere in the
   * wizard. `patch` is a stable store closure.
   */
  const invites = useOnboardingStore((s) => s.data.invites);
  const patch = useOnboardingStore((s) => s.patch);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const parsed = inviteEmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(t(ONBOARDING_KEYS.invite.invalidEmail));
      return;
    }
    const trimmed = parsed.data.toLowerCase();
    if (invites.includes(trimmed)) {
      setError(t(ONBOARDING_KEYS.invite.duplicateEmail));
      return;
    }
    patch({ invites: [...invites, trimmed] });
    setEmail('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <DrawerField
          label={t(ONBOARDING_KEYS.invite.emailLabel)}
          htmlFor="ob-invite"
          className="flex-1"
        >
          <DrawerInput
            id="ob-invite"
            type="email"
            capitalize={false}
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'onboarding-invite-error' : undefined}
            placeholder={t(ONBOARDING_KEYS.invite.emailPlaceholder)}
            data-testid={ONBOARDING_TEST_IDS.inviteEmail}
          />
        </DrawerField>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          data-testid={ONBOARDING_TEST_IDS.inviteAdd}
        >
          <Plus className="size-4" />
          {t(ONBOARDING_KEYS.invite.addButton)}
        </Button>
      </div>
      {error && (
        <p
          id="onboarding-invite-error"
          className="text-destructive text-xs"
          role="alert"
          data-testid={ONBOARDING_TEST_IDS.inviteError}
        >
          {error}
        </p>
      )}
      {invites.length > 0 && (
        // The design's item rows (`_patterns.md:139`): one 12px-cornered frame,
        // rows split by hairlines — each invitee as a person row (the 26px
        // avatar in their name's hashed tone) with the remove "×" at the end.
        <ul
          className="divide-y overflow-hidden rounded-xl border"
          data-testid={ONBOARDING_TEST_IDS.inviteList}
        >
          {invites.map((invite) => (
            <li key={invite} className="text-body flex items-center gap-2.5 px-3 py-2">
              <PersonAvatar
                size="option"
                initials={personInitials(
                  invite.split('@')[0]?.replaceAll(/[._-]+/g, ' ') ?? invite,
                )}
                tone={toneForLabel(invite)}
              />
              <span
                dir="ltr"
                className="min-w-0 flex-1 truncate [text-align:match-parent]"
              >
                {invite}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t(ONBOARDING_KEYS.invite.removeAriaLabel, { email: invite })}
                onClick={() => patch({ invites: invites.filter((i) => i !== invite) })}
                className="text-muted-foreground hover:bg-destructive-tint dark:hover:bg-destructive-tint hover:text-destructive size-6.5 rounded-md"
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
