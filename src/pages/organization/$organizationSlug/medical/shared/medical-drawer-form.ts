import { type FieldValues, type UseFormReturn, useWatch } from 'react-hook-form';

import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { clinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/*
 * What the Medical record drawers share around their forms (KICKOFF §6.7
 * Drawers): the live values, the mobile as typed and as stored, and who may
 * change or delete what (`medical.md:7`).
 */

/** The form's values as they stand, every key present (the form starts with all of them). */
export function useLiveValues<T extends FieldValues>(form: UseFormReturn<T>): T {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as T;
}

/** A stored mobile as the "+91" field types it: its ten digits, or nothing. */
export const phoneDigitsOf = (phone: string | null): string =>
  phone ? clinicPhoneDigits(phone) : '';

/** The typed digits as the contract stores them (`+919825044120`); empty is none. */
export const storedPhoneOf = (digits: string): string | null =>
  digits ? toClinicPhone(digits) : null;

/** Typed digits that are not a 10-digit Indian mobile ("Enter a 10-digit mobile"). */
export const phoneIsInvalid = (digits: string): boolean =>
  digits !== '' && toClinicPhone(digits) === null;

/** A trimmed text field, or `null` when empty. */
export const textOrNull = (text: string): string | null => text.trim() || null;

/**
 * Who may do what in a Medical drawer (`medical.md:7`; Q-U8): view only
 * without Create (a new record) or Edit (a saved one) — "View only · your
 * role can’t change this"; Delete with Medical Delete.
 */
export function useMedicalDrawerAccess(editing: boolean) {
  const access = useClinicAccess();
  const readOnly =
    access.isResolved && !access.can('medical', editing ? 'edit' : 'create');
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('medical', 'delete'),
  };
}
