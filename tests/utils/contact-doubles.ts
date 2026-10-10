/**
 * Test data for a person as clinozy-be answers it (`/app/contacts`): the profile a contact keeps
 * beyond the name and the reach — empty, as a contact the front desk just added has it.
 */
import type { ContactProfile } from '@/shared/api/clinic/contacts-contracts.ts';

/** A contact's profile with nothing filled in: no gender, birth date, address, referral or patient file. */
export const EMPTY_CONTACT_PROFILE: ContactProfile = {
  gender: null,
  dateOfBirth: null,
  address: null,
  referralSource: null,
  referredByContactId: null,
  referredByName: null,
  hasMarketingConsent: false,
  patientNumber: null,
};
