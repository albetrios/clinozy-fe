import { type KeyboardEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { InvoiceType } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
  INVOICE_TYPE_ORDER,
  INVOICE_TYPE_TONES,
} from './invoice-drawer.constants.ts';

/** Props of {@link InvoiceTypeSwitch}. */
export interface InvoiceTypeSwitchProps {
  value: InvoiceType;
  onChange: (type: InvoiceType) => void;
  disabled?: boolean;
}

/**
 * The Invoice drawer's type switch (H:1024; `payments.md:134`): Clinic (sky
 * dot) · Medical (sage) · Consultation (lav) as one full-width segmented group
 * — as the prototype renders it, the room tabs' look: a 3px-padded `muted`
 * track, 30px segments, the picked one on `card` with the control shadow and
 * ring, each dot in its tone's ink. One radio group: ← / → move the pick
 * (mirrored under RTL). Switching clears the items (the drawer's to do).
 */
export function InvoiceTypeSwitch({ value, onChange, disabled }: InvoiceTypeSwitchProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const buttons = useRef(new Map<InvoiceType, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const forward = (event.key === 'ArrowRight') !== rtl;
    const count = INVOICE_TYPE_ORDER.length;
    const index = INVOICE_TYPE_ORDER.indexOf(value);
    const next = INVOICE_TYPE_ORDER[(index + (forward ? 1 : -1) + count) % count];
    if (!next) return;
    onChange(next);
    buttons.current.get(next)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t(INVOICE_DRAWER_KEYS.type)}
      data-testid={INVOICE_DRAWER_TEST_IDS.typeSwitch}
      className="bg-muted border-muted flex gap-0.5 rounded-lg border p-0.75"
    >
      {INVOICE_TYPE_ORDER.map((type) => {
        const on = type === value;
        return (
          <button // NOSONAR(S6819): styled-button radiogroup; a native radio input cannot hold this segment
            key={type}
            ref={(node) => {
              if (node) buttons.current.set(type, node);
              else buttons.current.delete(type);
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (!on) onChange(type);
            }}
            onKeyDown={onKeyDown}
            data-testid={`${INVOICE_DRAWER_TEST_IDS.typeSwitch}-${type}`}
            className={cn(
              'text-body flex h-7.5 flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 disabled:opacity-50',
              on
                ? 'bg-card text-foreground ring-border shadow-(--elevation-control) ring-1'
                : 'text-muted-foreground-strong hover:bg-background/55 hover:text-foreground',
            )}
          >
            <span
              aria-hidden="true"
              data-slot="pill"
              className={cn(
                'size-1.75 flex-none rounded-full',
                TONE_CLASSES[INVOICE_TYPE_TONES[type]].fill,
              )}
            />
            {t(APP_KEYS.invoiceTypes[type])}
          </button>
        );
      })}
    </div>
  );
}
