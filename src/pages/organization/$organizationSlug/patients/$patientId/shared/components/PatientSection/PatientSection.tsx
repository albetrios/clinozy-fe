import { Outlet } from '@tanstack/react-router';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import { usePatientFileActions } from '../../hooks/usePatientFileActions/index.ts';
import { PATIENT_FILE_KEYS, PATIENT_FILE_NS } from '../../patient-file.constants.ts';
import { usePatientFileContext } from '../../patient-file-context.ts';
import { PatientAddMenu } from '../PatientAddMenu/index.ts';
import { PATIENT_SECTION_KEYS, PATIENT_SECTION_NS } from './patient-section.constants.ts';

/** A section's own primary, when it is not an Add-menu item (Add package). */
export interface PatientSectionPrimary {
  label: string;
  onSelect: () => void;
}

/** Props of {@link PatientSection}. */
export interface PatientSectionProps {
  section: PatientFileSectionSlug;
  /** The section page's root test id — its manifest's (`patient-section-<slug>`). */
  'data-testid': string;
  /** No header: the Overview and the visit flow (H:4943 `showSecHead`). */
  hideHeader?: boolean;
  /** The Columns button — tables only, hidden on a phone (H:732, H:92). */
  columns?: ReactNode;
  /** A primary the Add menu has no item for; else the section's own item runs. */
  primary?: PatientSectionPrimary | null;
  /** The section's content — it scrolls on its own. */
  children?: ReactNode;
  /** Classes for the scrolling content. */
  className?: string;
}

/** The split "New …" + "⌄" (H:732): the primary, then the Add menu for this patient. */
function SplitPrimary({
  primary,
  firstName,
}: {
  primary: PatientSectionPrimary;
  firstName: string;
}) {
  const { t } = useTranslation(PATIENT_SECTION_NS);
  const { items } = usePatientFileActions();
  const [open, setOpen] = useState(false);
  return (
    <div
      data-slot="split-primary"
      className="bg-primary text-primary-foreground flex h-9 flex-none items-stretch rounded-lg"
    >
      <button
        type="button"
        onClick={primary.onSelect}
        data-testid="patient-section-primary"
        className="hover:bg-primary/90 text-body flex items-center rounded-s-lg ps-3.5 pe-3 font-medium whitespace-nowrap transition-colors"
      >
        {primary.label}
      </button>
      {items.length > 0 ? (
        <PatientAddMenu
          variant="section"
          firstName={firstName}
          items={items}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button
              type="button"
              aria-label={t(PATIENT_SECTION_KEYS.more, { name: firstName })}
              data-testid="patient-section-more"
              className="hover:bg-primary/90 border-primary-foreground/18 flex w-7.5 items-center justify-center rounded-e-lg border-s transition-colors"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform duration-150',
                  open && 'rotate-180',
                )}
              />
            </button>
          }
        />
      ) : null}
    </div>
  );
}

/**
 * One section of the patient file (KICKOFF §6.6 Section header): the 50px
 * header — its title (16px/600), the Columns button for a table, the split
 * "New …" + "⌄" when the member may add one — over the section's own
 * scrolling content; then its dialog routes (`<Outlet />`). The header pads
 * with the table sides (20 / 16 / 14px) and stays in place on a phone.
 */
export function PatientSection({
  section,
  'data-testid': testId,
  hideHeader = false,
  columns,
  primary,
  children,
  className,
}: PatientSectionProps) {
  const { t } = useTranslation([PATIENT_FILE_NS, PATIENT_SECTION_NS]);
  const { file } = usePatientFileContext();
  const { primaryFor } = usePatientFileActions();
  const titleId = useId();
  const item = primaryFor(section);
  const labelKey =
    section in PATIENT_SECTION_KEYS.primary
      ? PATIENT_SECTION_KEYS.primary[section as keyof typeof PATIENT_SECTION_KEYS.primary]
      : null;
  const split =
    primary ??
    (item && labelKey
      ? { label: t(labelKey, { ns: PATIENT_SECTION_NS }), onSelect: item.run }
      : null);
  const firstName = file?.patient.firstName ?? '';
  const title = t(PATIENT_FILE_KEYS.sections[section]);

  return (
    <section
      aria-labelledby={titleId}
      data-testid={testId}
      className="flex min-h-0 flex-1 flex-col"
    >
      {hideHeader ? (
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
      ) : (
        <div className="flex h-12.5 flex-none items-center gap-2.5 px-(--table-pad-x) pt-3.5">
          <h2
            id={titleId}
            className="min-w-0 truncate text-base font-semibold tracking-[-0.01em]"
          >
            {title}
          </h2>
          <span className="flex-1" />
          {columns ? <span className="hidden md:contents">{columns}</span> : null}
          {split && file ? <SplitPrimary primary={split} firstName={firstName} /> : null}
        </div>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>
      <Outlet />
    </section>
  );
}
