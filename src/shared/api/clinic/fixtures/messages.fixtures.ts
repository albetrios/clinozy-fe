import { type BranchName, branchRef } from './organization.fixtures.ts';
import { onClinicFixturesReset } from './world.fixtures.ts';

/** A branch's links for message templates: its Google Maps place and its review page. */
export interface BranchMessageLinks {
  mapsLink: string;
  reviewLink: string;
}

/**
 * The prototype's one set of fill-in links (`FILL`, H:5749), given to every
 * branch: the contract's Branch has no maps or review link yet (Appendix F
 * "Branches" — REPLACE_WITH_API), and the composer must read them from the
 * branch, never from a literal (§7.3).
 */
const PROTOTYPE_LINKS: BranchMessageLinks = {
  mapsLink: 'maps.app.goo.gl/cresence',
  reviewLink: 'g.page/r/cresence/review',
};

const BRANCHES: readonly BranchName[] = ['Adajan', 'Vesu', 'Varachha'];

/** Each branch's message links, by branch id. */
export function branchMessageLinksSeed(): Record<string, BranchMessageLinks> {
  return Object.fromEntries(BRANCHES.map((name) => [branchRef(name), PROTOTYPE_LINKS]));
}

/**
 * The design's candidate times for "Offer 2 slots" (H:5741): the first free
 * one per day, over the next four days.
 */
export const FREE_SLOT_TIMES = ['11:00', '12:30', '16:00', '17:30'] as const;

/** How many days ahead "Offer 2 slots" looks (H:5741). */
export const FREE_SLOT_DAYS = 4;

let whatsappDown = false;

onClinicFixturesReset(() => {
  whatsappDown = false;
});

/**
 * Whether the fixture's WhatsApp provider is down (Q-L10; REPLACE_WITH_API: the
 * backend's channel status). While it is, WhatsApp replies stay `queued`.
 */
export function fixtureWhatsAppDown(): boolean {
  return whatsappDown;
}

/**
 * Fixture control — tests and local demos: take WhatsApp down or bring it
 * back. A reset of the fixture world brings it back.
 */
export function setFixtureWhatsAppOutage(down: boolean): void {
  whatsappDown = down;
}
