import { cn } from '@/lib/utils.ts';
import { ProductMark, ProductWordmark } from '@/shared/components/ProductMark/index.ts';

interface BrandLoaderProps {
  className?: string;
}

/**
 * The product's loading visual — the boot splash's resting frame (KICKOFF §6.1):
 * the 64px mark, the wordmark at 34px, and a 180 × 2px bar that sweeps, since
 * here nothing knows how far along the work is. NOT a rotating spinner. Reduced
 * motion is honoured globally.
 *
 * It is the React side of the boot surface: when the HTML splash gives up its
 * hold, {@link FullPageSpinner} shows this in its place, so the screen keeps the
 * same mark and wordmark.
 *
 * This component is **in flow**: it occupies only the space it needs, so it can sit
 * inside a card or panel alongside other controls. {@link FullPageSpinner} is this
 * same visual pinned as a `fixed inset-0` overlay for app bootstrap — use that one
 * only when the loader owns the entire viewport. Anywhere the loader shares a
 * surface with siblings, use this: an overlay there paints over its own neighbours
 * (that is what hid the auth screen's cancel button in LOGIN-1).
 */
export function BrandLoader({ className }: BrandLoaderProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-5.5', className)}
      data-testid="brand-loader"
    >
      <ProductMark className="size-[64px]" />
      <ProductWordmark className="text-[34px]" />
      <span
        data-slot="pill"
        className="bg-muted-strong block h-[2px] w-[180px] overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <span
          data-slot="pill"
          className="bg-primary animate-boot-progress block h-full w-1/2 rounded-full"
        />
      </span>
    </div>
  );
}
