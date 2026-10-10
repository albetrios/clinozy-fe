import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { organizationHome } from '@/lib/routes/index.ts';
import { DrawerField, DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useWorkspaceSwitchStore } from '@/shared/store/useWorkspaceSwitchStore/index.ts';
import { myOrganizationsQueryKey } from '@/shared/tenancy/my-organization-summaries.ts';
import {
  createOrganization,
  type CreateOrganizationInput,
  createOrganizationSchema,
} from '@/shared/tenancy/my-organizations.ts';
import { hydrateSessionContext } from '@/shared/tenancy/session-context.ts';
import { switchToOrganization } from '@/shared/tenancy/switch.ts';

/** Two fields: the light 560px drawer (`_patterns.md:28`). */
const CREATE_ORGANIZATION_PROFILE = { fieldCount: 2 } as const;

interface CreateOrganizationDialogProps {
  /** Whether the drawer is open — the org switcher and the picker own it. */
  open: boolean;
  /** Called when the drawer wants to open or close. */
  onOpenChange: (open: boolean) => void;
}

/** The empty form a new organization starts on — and is restarted on after a create. */
const EMPTY_ORGANIZATION: CreateOrganizationInput = { name: '', slug: '' };
/**
 * The drawer that creates a new organization, from the org switcher or the
 * picker (L-65: every centred modal is a drawer). On success it refreshes the
 * organization list and navigates to the new organization's home — the
 * `$organizationSlug` guard syncs context, persists the choice, and loads
 * permissions. While the create runs, the drawer holds every exit.
 */
export function CreateOrganizationDialog({
  open,
  onOpenChange: setOpen,
}: CreateOrganizationDialogProps) {
  const { t: tLayout } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const beginSwitch = useWorkspaceSwitchStore((state) => state.beginSwitch);
  const endSwitch = useWorkspaceSwitchStore((state) => state.endSwitch);
  // Synchronous twin of react-hook-form's `isSubmitting` — see onSubmit.
  const submittingRef = useRef(false);
  // The name takes focus on open, as it did when this was a dialog.
  const nameRef = useRef<HTMLInputElement | null>(null);
  /** The form the footer's Create submits — Enter in either field creates too. */
  const formId = `create-organization-${useId().replace(/:/g, '')}`;

  const form = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: EMPTY_ORGANIZATION,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const { ref: registerNameRef, ...nameField } = register('name');

  const onSubmit = async (data: CreateOrganizationInput) => {
    // `isSubmitting` only disables the button after React re-renders, so the
    // submit stays live for the frame after the first click — and this handler
    // CREATES AN ORGANIZATION. The ref flips synchronously, so a double-click
    // (or a second Enter) is dropped before a second one can be provisioned.
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const requestedSlug = data.slug?.trim();
      let org: Awaited<ReturnType<typeof createOrganization>>;
      try {
        org = await createOrganization({
          name: data.name,
          slug: requestedSlug === '' ? undefined : requestedSlug,
        });
      } catch (error) {
        // ONLY the create is a form-level failure — a taken slug, a rejected
        // name. Surface what actually went wrong instead of a generic "check
        // the form", and keep the user here so they can correct it.
        notify.error(mapApiError(error));
        return;
      }

      // The organization EXISTS from here on. Nothing below may route the user
      // back to this form: they would "fix" a form that was never wrong and
      // submit again, creating a SECOND organization. Close first, then run the
      // follow-up steps — each failure is recoverable and reported as itself.
      resetFormInPlace(form, EMPTY_ORGANIZATION);
      setOpen(false);
      notify.success(
        i18n.t(ERRORS_KEYS.frontend.organization.createSuccess, {
          ns: ERRORS_NS,
          name: org.name,
        }),
      );

      try {
        /*
         * Four awaits — a context re-read, a token re-mint, a cache
         * invalidation and a navigation — with the drawer already closed. The
         * screen underneath for that whole stretch is the workspace the user is
         * LEAVING, with its own name still ticked in the switcher, so creating
         * an organization looked like it had silently failed and then
         * auto-switched on its own some seconds later (QA-V3-2).
         *
         * The same overlay the switcher raises for the same hop: it names the
         * destination, so what is on screen and what is happening finally agree.
         * Cleared in `finally`, on both outcomes.
         */
        beginSwitch(org.name);
        await hydrateSessionContext();
        await switchToOrganization(org.id);
        await queryClient.invalidateQueries({ queryKey: myOrganizationsQueryKey });
        // PUSH, never replace. This drawer is opened from inside an
        // organization (the switcher) as well as from the picker; replacing
        // overwrote the organization the user was in, so Back from the new one
        // skipped straight past it. Switching through the switcher or the command
        // palette already pushes — creating is a switch too.
        await navigate(organizationHome(org.slug));
      } catch {
        // Created, but the hop into it failed. Say exactly that — the new
        // organization is already in the switcher, so the user is one click
        // away rather than one duplicate away.
        notify.warning(
          i18n.t(ERRORS_KEYS.frontend.organization.createdSwitchFailed, {
            ns: ERRORS_NS,
            name: org.name,
          }),
        );
      } finally {
        endSwitch();
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <RecordDrawer
      open={open}
      onClose={() => setOpen(false)}
      title={tLayout(LAYOUT_KEYS.app.orgCreate.title)}
      sub="Spin up a new workspace. You can invite teammates afterwards."
      content={CREATE_ORGANIZATION_PROFILE}
      initialFocusRef={nameRef}
      dismissLabel={tLayout(LAYOUT_KEYS.app.orgCreate.cancel)}
      saveLabel={tLayout(LAYOUT_KEYS.app.orgCreate.submit)}
      savingLabel={tLayout(LAYOUT_KEYS.app.orgCreate.submitting)}
      saveFormId={formId}
      saveState={isSubmitting ? 'saving' : 'idle'}
      saveTestId="create-organization-dialog-submit"
      testId="create-organization-dialog"
    >
      <form
        id={formId}
        // Bound at submit time, not during render: `onSubmit` reads
        // `submittingRef`, and handing a ref-reading callback to
        // `handleSubmit()` during render is what react-hooks/refs forbids.
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="space-y-4"
        data-testid="create-organization-dialog-form"
      >
        <DrawerField
          label={tLayout(LAYOUT_KEYS.app.orgCreate.nameLabel)}
          htmlFor="new-org-name"
          error={errors.name?.message}
          errorTestId="create-organization-dialog-name-error"
        >
          <DrawerInput
            id="new-org-name"
            autoComplete="organization"
            placeholder={tLayout(LAYOUT_KEYS.app.orgCreate.namePlaceholder)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'new-org-name-error' : undefined}
            data-testid="create-organization-dialog-name"
            {...nameField}
            ref={(node) => {
              registerNameRef(node);
              nameRef.current = node;
            }}
          />
        </DrawerField>
        <DrawerField
          label={tLayout(LAYOUT_KEYS.app.orgCreate.slugLabel)}
          htmlFor="new-org-slug"
          error={errors.slug?.message}
          errorTestId="create-organization-dialog-slug-error"
        >
          {/*
            Optional, but not unvalidated: the schema rejects anything outside
            `[a-z0-9-]`. This field used to render no error at all — no
            `aria-invalid`, no message — so a user who typed their
            organization's NAME here (the natural thing to do under a label
            reading "Workspace URL") pressed Create and watched nothing
            happen: the form stayed open, the page did not move, and not one
            `role="alert"` existed anywhere on it. The name field beside it has
            always said why it refused; this one now does too.
          */}
          <DrawerInput
            id="new-org-slug"
            capitalize={false}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={tLayout(LAYOUT_KEYS.app.orgCreate.slugPlaceholder)}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? 'new-org-slug-error' : undefined}
            data-testid="create-organization-dialog-slug"
            {...register('slug')}
          />
        </DrawerField>
      </form>
    </RecordDrawer>
  );
}
