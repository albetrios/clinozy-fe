import { formatHex, oklch } from 'culori';
import QR from 'qrcode';
import { type HTMLAttributes, useEffect, useState } from 'react';

import { cn } from '@/lib/utils.ts';

export type QrCodeProps = HTMLAttributes<HTMLDivElement> & {
  data: string;
  foreground?: string;
  background?: string;
  robustness?: 'L' | 'M' | 'Q' | 'H';
};

const oklchRegex = /oklch\(([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\)/;

const getOklch = (color: string, fallback: [number, number, number]) => {
  const oklchMatch = oklchRegex.exec(color);

  if (!oklchMatch) {
    return { l: fallback[0], c: fallback[1], h: fallback[2] };
  }

  return {
    l: Number.parseFloat(oklchMatch[1] ?? `${fallback[0]}`),
    c: Number.parseFloat(oklchMatch[2] ?? `${fallback[1]}`),
    h: Number.parseFloat(oklchMatch[3] ?? `${fallback[2]}`),
  };
};

function readThemeColor(token: string, fallback: string): string {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue(token).trim() || fallback;
}

/**
 * Theme-aware QR code (SVG) — reads semantic foreground/background tokens so it
 * stays legible in light and dark mode.
 */
export function QrCode({
  data,
  foreground,
  background,
  robustness = 'M',
  className,
  ...props
}: QrCodeProps) {
  const [svg, setSVG] = useState<string | null>(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const foregroundColor =
          foreground ?? readThemeColor('--color-foreground', 'oklch(0.21 0 0)');
        const backgroundColor =
          background ?? readThemeColor('--color-background', 'oklch(0.985 0 0)');

        const foregroundOklch = getOklch(foregroundColor, [0.21, 0.006, 285.885]);
        const backgroundOklch = getOklch(backgroundColor, [0.985, 0, 0]);

        const nextSvg = await QR.toString(data, {
          type: 'svg',
          color: {
            dark: formatHex(oklch({ mode: 'oklch', ...foregroundOklch })),
            light: formatHex(oklch({ mode: 'oklch', ...backgroundOklch })),
          },
          width: 200,
          errorCorrectionLevel: robustness,
          margin: 0,
        });

        setSVG(nextSvg);
      } catch {
        setSVG(null);
      }
    };

    void generateQR();
  }, [data, foreground, background, robustness]);

  if (!svg) {
    return (
      <div
        className={cn('bg-muted size-full animate-pulse rounded-md', className)}
        data-testid="qr-code-skeleton"
        {...props}
      />
    );
  }

  return (
    <div
      className={cn('size-full', '[&_svg]:size-full', className)}
      data-testid="qr-code"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is generated locally from the otpauth URI, never user input
      dangerouslySetInnerHTML={{ __html: svg }}
      {...props}
    />
  );
}
