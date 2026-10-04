import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import type { Role, Section } from '@/shared/api/clinic/clinic-schema.ts';

/** The Visit sheet's tabs (`?tab=`, KICKOFF §6.13). */
export type VisitTab = 'timeline' | 'consult' | 'treatment' | 'checkout';

/** What a tab's access reads of the member: their roles (View-as narrowed) and the matrix. */
export interface VisitAccessSubject {
  roles: readonly Role[];
  can: (section: Section, action: ClinicAction) => boolean;
}

/** The roles a clinical tab is open to — Admin and Owner pass everything (§3.7). */
const TAB_ROLES: Readonly<Record<'consult' | 'treatment', readonly Role[]>> = {
  consult: ['doctor', 'admin', 'owner'],
  treatment: ['doctor', 'therapist', 'admin', 'owner'],
};

/**
 * Whether the member can use a Visit sheet tab (KICKOFF §6.13 Access by tab,
 * from the records each tab writes): History needs Patients View; Consult & Rx
 * is the doctor's (the Rx routes, S:35); Treatment the doctor's or the
 * therapist's (S:38); Checkout needs Payments Create (`billing.create`, S:85,
 * S:92). Today hides a lane action whose tab the member can't use.
 */
export function canUseVisitTab(tab: VisitTab, member: VisitAccessSubject): boolean {
  switch (tab) {
    case 'timeline':
      return member.can('patients', 'view');
    case 'consult':
    case 'treatment':
      return member.roles.some((role) => TAB_ROLES[tab].includes(role));
    case 'checkout':
      return member.can('payments', 'create');
  }
}
