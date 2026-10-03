import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import type { PageManifest } from '@/lib/routes/page-manifest.ts';
import type { Section } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { CLINIC_SECTION_ICONS } from '@/shared/clinic/clinic-section-icons.ts';
import {
  CLINIC_SECTION_ORDER,
  isClinicSection,
} from '@/shared/clinic/clinic-sections.ts';
import {
  type AccessCheck,
  useAccessResolved,
  useVisibleNav,
} from '@/shared/hooks/useCan/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { type AppIcon, LayoutDashboard } from '@/shared/icons/index.ts';
import { APP_NAV_SEGMENT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';

/** One primary-nav destination, built from a route's manifest. */
export interface AppNavEntry extends AccessCheck {
  /** The `nav-<id>` test id. */
  id: string;
  /** The route's full path — a TanStack `to`, with `organizationSlug` its only param. */
  to: string;
  /** The clinic section, for a room; null for a template page. */
  section: Section | null;
  icon: AppIcon;
  labelNs: string;
  labelKey: string;
}

/** A manifest-backed route, as the route tree holds it. */
export interface NavRoute {
  fullPath: string;
  manifest: PageManifest;
}

/** Which half of the route tree the shell is in. */
export type NavScope = 'organization' | 'personal';

const ORGANIZATION_PREFIX = '/organization/$organizationSlug/';

/** Template pages (no clinic section) the nav knows how to draw. */
const TEMPLATE_PRESENTATION: Readonly<
  Record<string, Pick<AppNavEntry, 'icon' | 'labelNs' | 'labelKey'>>
> = {
  dashboard: {
    icon: LayoutDashboard,
    labelNs: LAYOUT_NS,
    labelKey: APP_NAV_SEGMENT_KEYS.dashboard,
  },
};

function toEntry({ fullPath, manifest }: NavRoute): AppNavEntry[] {
  const nav = manifest.nav;
  if (!nav) return [];
  const access = { permission: manifest.permission ?? undefined };
  if (nav.section !== undefined) {
    if (!isClinicSection(nav.section)) return [];
    const section = nav.section;
    return [
      {
        ...access,
        id: nav.id,
        to: fullPath,
        section,
        icon: CLINIC_SECTION_ICONS[section],
        labelNs: CLINIC_NS,
        labelKey: CLINIC_KEYS.sections[section].label,
      },
    ];
  }
  const presentation = Object.hasOwn(TEMPLATE_PRESENTATION, nav.id)
    ? TEMPLATE_PRESENTATION[nav.id]
    : undefined;
  return presentation
    ? [{ ...access, ...presentation, id: nav.id, to: fullPath, section: null }]
    : [];
}

/**
 * The nav's candidates for a scope, before access: the manifest-backed routes
 * of that half of the tree whose module the deployment enables. Clinic rooms in
 * section order when there are any; otherwise the template pages (Q-T1, D25 —
 * the Dashboard leaves the clinic nav and stays for personal mode).
 */
export function navCandidates(
  routes: readonly NavRoute[],
  scope: NavScope,
  moduleEnabled: (moduleKey: string) => boolean,
): AppNavEntry[] {
  const entries = routes
    .filter(
      ({ fullPath, manifest }) =>
        fullPath.startsWith(ORGANIZATION_PREFIX) === (scope === 'organization') &&
        (manifest.module === undefined || moduleEnabled(manifest.module)),
    )
    .flatMap(toEntry);
  const rooms = entries
    .filter((entry) => entry.section !== null)
    .sort(
      (a, b) =>
        CLINIC_SECTION_ORDER.indexOf(a.section as Section) -
        CLINIC_SECTION_ORDER.indexOf(b.section as Section),
    );
  return rooms.length > 0 ? rooms : entries.filter((entry) => entry.section === null);
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
 * The primary nav, built from the route manifests (L-12): the candidates for
 * the scope, filtered by each manifest's platform permission (`useVisibleNav`)
 * and, for a clinic room, by View in `useClinicAccess` — so it follows a
 * View-as preview too. Every shell's nav and the ⌘K nav group read this.
 */
export function useAppNav(scope: NavScope): AppNav {
  const router = useRouter();
  const candidates = useMemo(() => {
    const routes = Object.values(router.routesById).flatMap((route) => {
      const manifest = route.options.staticData?.manifest;
      return manifest ? [{ fullPath: route.fullPath, manifest }] : [];
    });
    return navCandidates(routes, scope, isModuleEnabled);
  }, [router, scope]);
  const permissionsResolved = useAccessResolved();
  const permitted = useVisibleNav(candidates);
  const access = useClinicAccess();

  return useMemo(() => {
    if (!permissionsResolved) return PENDING;
    if (!permitted.some((entry) => entry.section !== null)) {
      return { entries: permitted, isResolved: true };
    }
    if (!access.isResolved) return PENDING;
    return {
      entries: permitted.filter(
        (entry) => entry.section === null || access.can(entry.section, 'view'),
      ),
      isResolved: true,
    };
  }, [permissionsResolved, permitted, access]);
}
