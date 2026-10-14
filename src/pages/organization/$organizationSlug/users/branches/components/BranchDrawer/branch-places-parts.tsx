import { zodResolver } from '@hookform/resolvers/zod';
import { type KeyboardEvent, type ReactNode, useEffect, useId } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { BRANCH_PLACE_LIMITS } from '@/shared/api/app/branch-places-contracts.ts';
import {
  DrawerField,
  drawerFieldErrorId,
  DrawerInput,
} from '@/shared/components/DrawerField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import {
  INLINE_EDIT_ATTRIBUTE,
  type PlaceDraftReport,
  placeNameSchema,
  useReportDraft,
} from './branch-places-form.ts';

const K = USERS_KEYS.branches.drawer.places;

/** One list of the step: its 11px heading with a hint, then the rows and the add row. */
export function PlacesSection({
  title,
  hint,
  testId,
  children,
}: {
  title: string;
  hint: string;
  testId: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
        <h3
          id={headingId}
          className="text-micro text-muted-foreground shrink-0 font-semibold tracking-[0.05em] uppercase"
        >
          {title}
        </h3>
        <span title={hint} className="text-muted-foreground min-w-0 truncate text-xs">
          {hint}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A list with nothing in it yet. */
export function PlacesEmpty({ testId, children }: { testId: string; children: string }) {
  return (
    <p data-testid={testId} className="text-detail text-muted-foreground py-1">
      {children}
    </p>
  );
}

type PlaceNameForm = UseFormReturn<{ name: string }, unknown, { name: string }>;

/** Props of {@link PlaceNameRow}. */
export interface PlaceNameRowProps {
  /** `add`: a labelled field and "Add", cleared after each add; `rename`: in the row, Save and Cancel. */
  mode: 'add' | 'rename';
  initial: string;
  /** The field's name — shown over an add row, read out on a rename row. */
  label: string;
  placeholder?: string;
  /**
   * The write. Resolving is done (an add row clears); throwing keeps the text — the callback has
   * already shown why, at the field (`form.setError`) or as a toast.
   */
  onSubmit: (name: string, form: PlaceNameForm) => Promise<void>;
  /** A rename row's Cancel (and Esc in its field). */
  onCancel?: () => void;
  draftKey: string;
  onDraft: PlaceDraftReport;
  /** `<testId>-name`, `<testId>-submit`, `<testId>-cancel`. */
  testId: string;
}

/**
 * The inline row (as the appointment form's Name · Mobile editor, H:2748): a 36px field and its
 * button side by side, saved on its own — RHF + Zod per row (KICKOFF §5). Enter submits; a rename
 * row opens on its field, and Esc there cancels it without closing the drawer. A name that is
 * missing, too long or already taken is outlined, its reason on the line under the row.
 */
export function PlaceNameRow({
  mode,
  initial,
  label,
  placeholder,
  onSubmit,
  onCancel,
  draftKey,
  onDraft,
  testId,
}: PlaceNameRowProps) {
  const { t } = useTranslation(USERS_NS);
  const inputId = useId();
  const errorId = drawerFieldErrorId(inputId);
  const rename = mode === 'rename';
  const form: PlaceNameForm = useForm({
    resolver: zodResolver(placeNameSchema),
    defaultValues: { name: initial },
  });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  useReportDraft(draftKey, isDirty, onDraft);
  const message = errors.name?.message;
  const error = message ? t(message, { defaultValue: message }) : undefined;

  useEffect(() => {
    // A rename opens on the name, ready to type over.
    if (rename) form.setFocus('name', { shouldSelect: true });
  }, [form, rename]);

  const submit = form.handleSubmit(async ({ name }) => {
    try {
      await onSubmit(name, form);
    } catch {
      return;
    }
    if (!rename) resetFormInPlace(form, { name: '' });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || !onCancel) return;
    // Esc closes the row's editor, not the drawer.
    event.stopPropagation();
    onCancel();
  };

  return (
    <form
      noValidate
      data-testid={testId}
      // The drawer leaves Esc to an open rename (`INLINE_EDIT_ATTRIBUTE`).
      {...(rename ? { [INLINE_EDIT_ATTRIBUTE]: '' } : {})}
      onSubmit={(event) => void submit(event)}
      className={cn('flex min-w-0 flex-col gap-1.5', rename && 'py-1.5')}
    >
      <div
        className={cn(
          'grid min-w-0 items-end gap-2',
          rename
            ? 'grid-cols-[minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]',
        )}
      >
        <DrawerField label={rename ? undefined : label} htmlFor={inputId}>
          <DrawerInput
            id={inputId}
            {...form.register('name')}
            aria-label={rename ? label : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder={placeholder}
            maxLength={BRANCH_PLACE_LIMITS.name}
            autoComplete="off"
            onKeyDown={onKeyDown}
            data-testid={`${testId}-name`}
          />
        </DrawerField>
        <Button
          type="submit"
          variant={rename ? 'default' : 'outline'}
          isLoading={isSubmitting}
          disabled={isSubmitting}
          data-testid={`${testId}-submit`}
          className="h-9"
        >
          {rename ? t(K.save) : t(K.add)}
        </Button>
        {rename ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onCancel}
            data-testid={`${testId}-cancel`}
            className="h-9"
          >
            {t(K.cancel)}
          </Button>
        ) : null}
      </div>
      {error ? (
        <RowError id={errorId} testId={`${testId}-error`} message={error} />
      ) : null}
    </form>
  );
}

/** A row's validation line, under the whole row so its button keeps beside the field. */
export function RowError({
  id,
  testId,
  message,
}: {
  id: string;
  testId: string;
  message: string;
}) {
  return (
    <p id={id} role="alert" data-testid={testId} className="text-destructive text-xs">
      {message}
    </p>
  );
}
