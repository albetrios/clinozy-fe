import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { translateFormMessage } from '@/lib/i18n/translate-form-message.ts';
import {
  type RoleInput,
  roleInputSchema,
  type RoleSummary,
} from '@/shared/api/organization-contracts.ts';
import {
  DrawerField,
  DrawerInput,
  DrawerTextarea,
} from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Checkbox } from '@/shared/components/ui/checkbox.tsx';
import { Label } from '@/shared/components/ui/label.tsx';
import {
  type AssignablePermissions,
  useAssignablePermissions,
} from '@/shared/hooks/useAssignablePermissions/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import {
  useCreateRole,
  useRolePermissions,
  useUpdateRole,
} from '@/shared/hooks/useRoles/index.ts';
import { Plus } from '@/shared/icons/index.ts';

const EMPTY_ROLE: RoleInput = { name: '', description: '', permissions: [] };

/**
 * Name, a description textarea and the permission checklist — heavy fields, so
 * the drawer takes the everyday 680px (`_patterns.md:28`).
 */
const ROLE_FORM_PROFILE = { fieldCount: 3, hasHeavyField: true } as const;

/** Selected permission codes with `perm` added. */
function withPermission(
  current: OrganizationPermission[],
  perm: OrganizationPermission,
): OrganizationPermission[] {
  return current.includes(perm) ? current : [...current, perm];
}

/** Selected permission codes with `perm` removed. */
function withoutPermission(
  current: OrganizationPermission[],
  perm: OrganizationPermission,
): OrganizationPermission[] {
  return current.filter((p) => p !== perm);
}

/** Submit-button label for the create-vs-edit × idle-vs-submitting matrix. */
function roleSubmitLabel(isEdit: boolean, isSubmitting: boolean): string {
  if (isSubmitting) return isEdit ? 'Saving…' : 'Creating…';
  return isEdit ? 'Save changes' : 'Create role';
}

interface CreateRoleDialogProps {
  /** When provided, the drawer edits this role (controlled) instead of creating. */
  role?: RoleSummary;
  /** Controlled open state — required in edit mode (the parent owns the trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The permission checkboxes, plus the catalog's own loading and error states.
 *
 * Split out of {@link CreateRoleDialog} so those two extra states do not push the drawer past
 * the complexity ceiling — and because "render the grants this caller may delegate" is a
 * coherent unit on its own.
 */
function PermissionChecklist({
  assignable,
  selected,
  onToggle,
}: {
  assignable: AssignablePermissions;
  selected: OrganizationPermission[];
  onToggle: (next: OrganizationPermission[]) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);

  if (assignable.isPending) {
    return (
      <p className="text-muted-foreground text-xs">
        {t(SETTINGS_KEYS.panels.roles.permissionsLoading)}
      </p>
    );
  }
  if (assignable.isError) {
    return (
      <p className="text-destructive text-xs" role="alert">
        {t(SETTINGS_KEYS.panels.roles.permissionsLoadFailed)}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {assignable.rows.map((entry) => (
        <div key={entry.code} className="flex items-center gap-2">
          <Checkbox
            id={`role-perm-${entry.code}`}
            checked={selected.includes(entry.code)}
            onCheckedChange={(value) =>
              onToggle(
                value === true
                  ? withPermission(selected, entry.code)
                  : withoutPermission(selected, entry.code),
              )
            }
            data-testid={`role-perm-${entry.code}`}
          />
          <Label
            htmlFor={`role-perm-${entry.code}`}
            className="text-muted-foreground text-xs font-normal"
            title={entry.code}
          >
            {entry.name}
          </Label>
        </div>
      ))}
    </div>
  );
}

/**
 * Drawer + form for creating OR editing a custom role (name, description, and a
 * checklist of assignable permissions) — a child drawer stacked on Settings ›
 * Roles (L-65), whose Back returns there. In **create** mode it renders its own
 * "New role" trigger (a fresh org has only the system Owner role, so this is the
 * entry point for the Admin/Member/Viewer roles that make inviting possible). In
 * **edit** mode (`role` given) it is controlled by the parent — no trigger — and
 * saves via `useUpdateRole`. Gated by the caller (render only for `role:manage`).
 */
export function CreateRoleDialog({
  role,
  open: controlledOpen,
  onOpenChange,
}: CreateRoleDialogProps = {}) {
  const { t } = useTranslation(SETTINGS_NS);
  const isEdit = role !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  // The roles list omits permissions, so an edit must fetch the role's real
  // grants to pre-fill — otherwise saving would wipe them.
  const rolePermissions = useRolePermissions(role?.id);
  // The catalog clinozy-be enforces, narrowed to what this caller may actually grant —
  // `assertCallerCanGrantPermissionCodes` refuses anything else.
  const assignable = useAssignablePermissions();
  // The name takes focus on open, as it did when this was a dialog.
  const nameRef = useRef<HTMLInputElement | null>(null);
  /** The form the footer's primary submits — Enter in the name saves too. */
  const formId = `role-form-${useId().replace(/:/g, '')}`;

  const initialValues: RoleInput = role
    ? { name: role.name, description: role.description, permissions: role.permissions }
    : EMPTY_ROLE;

  const form = useForm<RoleInput>({
    resolver: zodResolver(roleInputSchema),
    defaultValues: initialValues,
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const { ref: registerNameRef, ...nameField } = register('name');

  /**
   * Which role this form has already been pre-filled for. The permissions query
   * key is a DESCENDANT of the roles prefix, so every other role mutation
   * invalidates it: keying the pre-fill on `rolePermissions.data` re-ran `reset`
   * on each refetch and wiped whatever the user had typed or ticked (SET-10).
   * Pre-fill once per role, on the success transition, and never again.
   */
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!role) {
      hydratedFor.current = null;
      return;
    }
    if (!rolePermissions.isSuccess || hydratedFor.current === role.id) return;
    hydratedFor.current = role.id;
    resetFormInPlace(form, {
      name: role.name,
      description: role.description,
      permissions: rolePermissions.data,
    });
  }, [role, rolePermissions.isSuccess, rolePermissions.data, form]);

  // In edit mode, don't allow a save before the real permissions load.
  const permissionsPending = isEdit && !rolePermissions.isSuccess;

  const onSubmit = async (data: RoleInput) => {
    if (isEdit && role) {
      await updateRole.mutateAsync({ id: role.id, ...data });
    } else {
      await createRole.mutateAsync(data);
    }
    resetFormInPlace(form, isEdit ? data : EMPTY_ROLE);
    setOpen(false);
  };

  return (
    <>
      {isEdit ? null : (
        <Button size="sm" onClick={() => setOpen(true)} data-testid="role-create-open">
          <Plus className="size-4" />
          New role
        </Button>
      )}
      <RecordDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? 'Edit role' : 'Create a role'}
        sub={
          isEdit
            ? 'Update the name, description, and permissions.'
            : 'Define a permission set you can assign to members.'
        }
        content={ROLE_FORM_PROFILE}
        stacked
        initialFocusRef={nameRef}
        saveLabel={roleSubmitLabel(isEdit, false)}
        savingLabel={roleSubmitLabel(isEdit, true)}
        saveFormId={formId}
        saveState={isSubmitting ? 'saving' : 'idle'}
        // The drawer keeps its action, disabled, while the grants load.
        saveDisabled={permissionsPending}
        saveTestId="role-create-submit"
        testId="role-create-dialog"
      >
        <form
          id={formId}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          data-testid="role-create-form"
        >
          {permissionsPending ? (
            // The checklist is a statement about what this role can do. Rendered
            // from the list row — which carries no permissions — it opens with
            // every box unchecked and then visibly ticks itself. The name, the
            // description and the checklist as the design's flat bars.
            <div className="flex flex-col gap-3" data-testid="role-edit-loading">
              <SkeletonBar shape="field" />
              <SkeletonBar shape="field" className="h-20" />
              <SkeletonBar shape="field" className="h-24" />
            </div>
          ) : (
            <>
              <DrawerField
                label="Name"
                htmlFor="role-name"
                error={translateFormMessage(errors.name?.message)}
              >
                <DrawerInput
                  id="role-name"
                  placeholder={t(SETTINGS_KEYS.panels.roles.namePlaceholder)}
                  aria-invalid={!!errors.name}
                  data-testid="role-create-name"
                  {...nameField}
                  ref={(node) => {
                    registerNameRef(node);
                    nameRef.current = node;
                  }}
                />
              </DrawerField>

              <DrawerField
                label="Description"
                htmlFor="role-description"
                error={translateFormMessage(errors.description?.message)}
              >
                <DrawerTextarea
                  id="role-description"
                  placeholder={t(SETTINGS_KEYS.panels.roles.descriptionPlaceholder)}
                  aria-invalid={!!errors.description}
                  data-testid="role-create-description"
                  {...register('description')}
                />
              </DrawerField>

              <DrawerField
                label="Permissions"
                error={translateFormMessage(errors.permissions?.message)}
              >
                <Controller
                  control={control}
                  name="permissions"
                  render={({ field }) => (
                    <PermissionChecklist
                      assignable={assignable}
                      selected={field.value}
                      onToggle={field.onChange}
                    />
                  )}
                />
              </DrawerField>
            </>
          )}
        </form>
      </RecordDrawer>
    </>
  );
}
