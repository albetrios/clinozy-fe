import { useEffect } from 'react';

import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { applyOrgBrand } from '@/shared/theme/org-brand.ts';

/**
 * Applies the active organization's brand accent (FE-57) to `--color-brand`
 * whenever it changes, and clears it on unmount. No-op until an org carries a
 * `brandColor`. Mount once in the authenticated shell.
 */
export function useOrgBrand(): void {
  const { data: ctx } = useMeContext();
  const brandColor = ctx?.activeOrganization?.brandColor ?? null;
  useEffect(() => {
    applyOrgBrand(brandColor);
    return () => applyOrgBrand(null);
  }, [brandColor]);
}
