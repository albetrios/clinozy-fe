import type { IconProps } from './icon-types.ts';

/**
 * Instagram mark, drawn as the design prototype draws it (its `insta` glyph,
 * H:3068; KICKOFF §3.4): a rounded square, the lens circle and the flash dot.
 * lucide-react ships no brand icons, so it is vendored like `github-mark.tsx`
 * and rendered lucide-compatible (24×24 viewBox, currentColor stroke,
 * strokeWidth 2) so the registry treats it like any other Lucide glyph;
 * Tabler/Phosphor sets keep their own Instagram marks.
 */
export function InstagramMark(props: IconProps) {
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
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  );
}
