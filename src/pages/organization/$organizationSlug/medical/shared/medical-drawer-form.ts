import { z } from 'zod';

import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';

/*
 * What the Medical record drawers share around their forms (KICKOFF §6.7
 * Drawers): an optional text as stored, and who may change or delete what
 * (`medical.md:7`). The mobile helpers are the shared phone field's
 * (`app-phone-field.ts`), the live values `useFormValues`.
 */

/** A trimmed text field, or `null` when empty. */
export const textOrNull = (text: string): string | null => text.trim() || null;

const EMAIL = z.email();

/** A typed email that does not read as one (an empty one is no email) — clinozy-be's 400. */
export function emailIsInvalid(text: string): boolean {
  const email = text.trim();
  return email.length > 0 && !EMAIL.safeParse(email).success;
}

/**
 * Who may do what in a Medical drawer (`medical.md:7`; Q-U8): view only
 * without Create (a new record) or Edit (a saved one) — "View only · your
 * role can’t change this"; Delete with Medical Delete.
 */
export function useMedicalDrawerAccess(editing: boolean) {
  const access = useAppAccess();
  const readOnly =
    access.isResolved && !access.can('medical', editing ? 'edit' : 'create');
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('medical', 'delete'),
  };
}
