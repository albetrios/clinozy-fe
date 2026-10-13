import { cn } from '@/lib/utils.ts';

import type { IconProps } from './icon-types.ts';

/**
 * WhatsApp mark, drawn as the design prototype draws it (its `wa` glyph, H:3069;
 * KICKOFF §3.4): Lucide's message-circle outline (ISC license) with a handset
 * inside. lucide-react ships no brand icons, so it is vendored like
 * `github-mark.tsx` and rendered lucide-compatible (24×24 viewBox, currentColor
 * stroke, strokeWidth 2) so the registry treats it like any other Lucide glyph;
 * Tabler/Phosphor sets keep their own WhatsApp marks.
 */
export function WhatsAppMark({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // `lucide`: the Icon weight / Icon colour axes target `svg.lucide`.
      className={cn('lucide', className)}
      {...props}
    >
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M8.6 8.4c.2-.5.6-.6 1-.5l.9 1.6c.1.3 0 .6-.2.8l-.5.5c.5 1.1 1.4 2 2.5 2.5l.5-.5c.2-.2.5-.3.8-.2l1.6.9c.1.4 0 .8-.5 1-2.9 1.1-7.2-3.2-6.1-6.1z" />
    </svg>
  );
}
