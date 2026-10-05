import './print-template.css';

import type { ReactNode } from 'react';

import { localeDirection } from '@/lib/i18n/locales.ts';
import { cn } from '@/lib/utils.ts';
import type { Branch, Organization } from '@/shared/api/clinic/clinic-schema.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';

import { usePrintTranslation } from './print-format.ts';
import {
  PRINT_LANGUAGE,
  PRINT_TEMPLATE_KEYS,
  PRINT_TEMPLATE_TEST_IDS,
} from './print-template.constants.ts';

/**
 * The shared A4 sheet the print templates are built on (KICKOFF §3.5; H:434–514):
 * 210 × 297mm, Arial 3.25mm, a content box that leaves the top band and the
 * inline start blank for the clinic's printed letterhead, titled boxes and the
 * footer with the clinic's identity. Physical units throughout — paper does not
 * follow the Density axis. The sheet keeps the light tokens in print (the
 * preset's dark block is screen-only, KICKOFF §3.1).
 */

/** Which sheet — each leaves its own letterhead space. */
export type PrintSheetKind = 'invoice' | 'prescription' | 'purchaseOrder';

// H:436 — 169.5mm wide, 38.1mm from the top, 23.3mm from the inline start.
const INVOICE_SPACE = { sheet: 'pt-[38.1mm] ps-[23.3mm]', content: 'w-[169.5mm]' };

const SHEET_SPACE: Record<PrintSheetKind, { sheet: string; content: string }> = {
  invoice: INVOICE_SPACE,
  // H:456 — 178.1mm wide, 42.3mm from the top, 19mm from the inline start.
  prescription: { sheet: 'pt-[42.3mm] ps-[19mm]', content: 'w-[178.1mm]' },
  // No design draws it (Q-M7): the invoice sheet's letterhead space.
  purchaseOrder: INVOICE_SPACE,
};

const INVOICE_FOOTER = {
  footer: 'mt-[4.55mm] gap-[2.6mm] pt-[2mm]',
  thanks: 'text-[3.6mm] leading-[4.2mm]',
};

const FOOTER_STYLE: Record<PrintSheetKind, { footer: string; thanks: string }> = {
  invoice: INVOICE_FOOTER,
  prescription: {
    footer: 'mt-[4.4mm] gap-[1.45mm] pt-[1.3mm]',
    thanks: 'leading-[3.9mm]',
  },
  purchaseOrder: INVOICE_FOOTER,
};

/**
 * One A4 sheet: the page, its letterhead space and the content box. It grows
 * past one page rather than clip a long bill.
 */
export function PrintSheet({
  kind,
  testId,
  children,
}: {
  kind: PrintSheetKind;
  testId: string;
  children: ReactNode;
}) {
  const space = SHEET_SPACE[kind];
  return (
    <section
      data-slot="print-sheet"
      data-testid={testId}
      lang={PRINT_LANGUAGE}
      dir={localeDirection(PRINT_LANGUAGE)}
      className={cn(
        'bg-background text-foreground min-h-[297mm] w-[210mm] font-[Arial,Helvetica,sans-serif] text-[3.25mm] leading-[1.2]',
        space.sheet,
      )}
    >
      <div className={cn('flex flex-col', space.content)}>{children}</div>
    </section>
  );
}

/** A titled, bordered box of the sheet. Callers set its height and padding. */
export function PrintBox({
  title,
  className,
  titleClassName,
  children,
}: {
  title: string;
  className?: string;
  /** The title's bottom padding differs per box (1.6mm invoice, 1.45mm Rx). */
  titleClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('border-border-strong rounded-md border px-[2.3mm]', className)}>
      <div
        className={cn(
          'border-border-strong box-content h-[3.9mm] border-b-[0.3mm] leading-[3.9mm] font-bold',
          titleClassName,
        )}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** One "Label: value" row of a box (inside a `<dl>`). */
export function PrintField({
  label,
  value,
  strong = false,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  /** The value in bold (names, dates and numbers are). */
  strong?: boolean;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('flex justify-between leading-[5.29mm]', className)}>
      <dt>{label}</dt>
      <dd className={cn('text-end', strong && 'font-bold', valueClassName)}>{value}</dd>
    </div>
  );
}

/**
 * The footer: the thank-you line, the branch phone and its GSTIN — from the
 * organization and the branch, never the design's sample clinic (H:453,
 * H:510–511). The thank-you follows the clinic's first specialty; a Medical
 * sheet thanks for "medicine needs". A purchase order goes to a supplier, not
 * a patient: its first line names the clinic it is from.
 */
export function PrintFooter({
  kind,
  organization,
  branch,
  medical = false,
}: {
  kind: PrintSheetKind;
  organization: Pick<Organization, 'name' | 'specialties'>;
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
  medical?: boolean;
}) {
  const { t } = usePrintTranslation();
  const style = FOOTER_STYLE[kind];
  let thanksKey: string =
    PRINT_TEMPLATE_KEYS.thanks[organization.specialties[0] ?? 'general'];
  if (medical) thanksKey = PRINT_TEMPLATE_KEYS.thanksMedicine;
  if (kind === 'purchaseOrder') thanksKey = PRINT_TEMPLATE_KEYS.purchaseOrder.issuedBy;
  return (
    <footer
      data-testid={PRINT_TEMPLATE_TEST_IDS.footer}
      className={cn(
        'border-border-strong flex flex-col items-center border-t text-center',
        style.footer,
      )}
    >
      <p className={style.thanks}>{t(thanksKey, { clinic: organization.name })}</p>
      <p className="text-muted-foreground leading-[3.9mm]">
        {t(PRINT_TEMPLATE_KEYS.contact, { phone: formatClinicPhone(branch.phone) })}
      </p>
      {branch.gstNumber ? (
        <p className="text-muted-foreground leading-[3.9mm]">
          {t(PRINT_TEMPLATE_KEYS.gstin, { gstin: branch.gstNumber })}
        </p>
      ) : null}
    </footer>
  );
}
