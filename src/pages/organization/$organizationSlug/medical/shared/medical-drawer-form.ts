import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/*
 * What the Medical record drawers share around their forms (KICKOFF §6.7
 * Drawers): an optional text as stored, and who may change or delete what
 * (`medical.md:7`). The mobile helpers are the shared phone field's
 * (`clinic-phone-field.ts`), the live values `useFormValues`.
 */

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
