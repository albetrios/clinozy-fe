import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { CheckCircle, ShieldAlert, ShieldCheck } from '@/shared/icons/index.ts';

export interface SecurityOverviewCardProps {
  mfaEnabled: boolean;
  passkeyCount: number;
}

/**
 * At-a-glance security posture — helps users see what's protecting their account
 * without digging through each card. A settings card headed by the shield and
 * the score pill (sage when every protection is on, butter otherwise), then one
 * 13px line per protection with its check.
 */
export function SecurityOverviewCard({
  mfaEnabled,
  passkeyCount,
}: SecurityOverviewCardProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const keys = SETTINGS_KEYS.security.overview;

  const items = [
    {
      id: 'mfa',
      ok: mfaEnabled,
      label: mfaEnabled ? t(keys.mfaOn) : t(keys.mfaOff),
    },
    {
      id: 'passkeys',
      ok: passkeyCount > 0,
      label:
        passkeyCount > 0
          ? t(keys.passkeysOn, { count: passkeyCount })
          : t(keys.passkeysOff),
    },
    {
      id: 'idle',
      ok: true,
      label: t(keys.idleProtection),
    },
  ] as const;

  const score = items.filter((item) => item.ok).length;
  const strong = score === items.length;

  return (
    <SettingsCard
      data-testid="security-overview"
      title={
        <>
          {strong ? (
            <ShieldCheck className="text-success size-4 shrink-0" aria-hidden />
          ) : (
            <ShieldAlert
              className="text-tone-butter-foreground size-4 shrink-0"
              aria-hidden
            />
          )}
          {t(keys.title)}
        </>
      }
      description={t(keys.description)}
      action={
        <TonePill
          tone={strong ? 'sage' : 'butter'}
          className="tabular-nums"
          data-testid="security-overview-score"
        >
          {t(keys.score, { score, total: items.length })}
        </TonePill>
      }
    >
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="text-body flex items-center gap-2"
            data-testid={`security-overview-${item.id}`}
          >
            <CheckCircle
              className={cn(
                'size-4 shrink-0',
                item.ok ? 'text-success' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
