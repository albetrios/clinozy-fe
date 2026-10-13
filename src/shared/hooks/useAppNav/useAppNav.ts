import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type { Section } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APP_SECTION_ICONS } from '@/shared/app/app-section-icons.ts';
import { APP_SECTION_ORDER, isAppSection } from '@/shared/app/app-sections.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import {
  type AccessCheck,
  useAccessResolved,
  useVisibleNav,
} from '@/shared/hooks/useCan/index.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

/** One primary-nav destination — a clinic room, built from its route's manifest. */
export interface AppNavEntry extends AccessCheck {
  /** The `nav-<id>` test id. */
  id: string;
  /** The route's full path — a TanStack `to`, with `organizationSlug` its only param. */
  to: string;
  /** The room's clinic section. */
  section: Section;
  icon: AppIcon;
  labelNs: string;
  labelKey: string;
}

/** A manifest-backed route, as the route tree holds it. */
export interface NavRoute {
  fullPath: string;
  manifest: PageManifest;
}

const ORGANIZATION_PREFIX = '/organization/$organizationSlug/';

function toEntry({ fullPath, manifest }: NavRoute): AppNavEntry[] {
  const nav = manifest.nav;
  if (!(nav && isAppSection(nav.section))) return [];
  const section = nav.section;
  return [
    {
      permission: manifest.permission ?? undefined,
      id: nav.id,
      to: fullPath,
      section,
      icon: APP_SECTION_ICONS[section],
      labelNs: APP_NS,
      labelKey: APP_KEYS.sections[section].label,
    },
  ];
}

/**
 * The nav's candidates, before access: the clinic rooms of the organization
 * shell whose module the deployment enables, in section order (Q-T1, D25).
 * With every room's module off (D8) there are none — the org home shows its
 * "nothing is switched on" state instead.
 */
export function navCandidates(
  routes: readonly NavRoute[],
  moduleEnabled: (moduleKey: string) => boolean,
): AppNavEntry[] {
  return routes
    .filter(
      ({ fullPath, manifest }) =>
        fullPath.startsWith(ORGANIZATION_PREFIX) &&
        (manifest.module === undefined || moduleEnabled(manifest.module)),
    )
    .flatMap(toEntry)
    .sort(
      (a, b) =>
        APP_SECTION_ORDER.indexOf(a.section) - APP_SECTION_ORDER.indexOf(b.section),
    );
}

/** The primary nav and whether the access it filters on has answered. */
export interface AppNav {
  entries: AppNavEntry[];
  /**
   * False while the permission set or the clinic access is unknown — draw a
   * placeholder, not a nav that grows a beat later.
   */
  isResolved: boolean;
}

const PENDING: AppNav = { entries: [], isResolved: false };

/**
 * The primary nav, built from the route manifests (L-12): the candidates,
 * filtered by each manifest's platform permission (`useVisibleNav`) and by View
 * in `useAppAccess` — so it follows a View-as preview too. The org shell's
 * nav and the ⌘K "Go to" group read this.
 */
export function useAppNav(): AppNav {
  const router = useRouter();
  const candidates = useMemo(() => {
    const routes = Object.values(router.routesById).flatMap((route) => {
      const manifest = route.options.staticData?.manifest;
      return manifest ? [{ fullPath: route.fullPath, manifest }] : [];
    });
    return navCandidates(routes, isModuleEnabled);
  }, [router]);
  const permissionsResolved = useAccessResolved();
  const permitted = useVisibleNav(candidates);
  const access = useAppAccess();

  return useMemo(() => {
    if (!permissionsResolved) return PENDING;
    if (permitted.length === 0) return { entries: permitted, isResolved: true };
    if (!access.isResolved) return PENDING;
    return {
      entries: permitted.filter((entry) => access.can(entry.section, 'view')),
      isResolved: true,
    };
  }, [permissionsResolved, permitted, access]);
}
