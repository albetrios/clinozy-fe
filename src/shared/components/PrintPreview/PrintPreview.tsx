import { useQuery } from '@tanstack/react-query';
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { cn } from '@/lib/utils.ts';
import { printDocument } from '@/shared/components/PrintTemplate/index.ts';
import {
  PRINT_LANGUAGE,
  PRINT_TEMPLATE_NS,
} from '@/shared/components/PrintTemplate/print-template.constants.ts';
import {
  DRAWER_WIDTH_CLASS,
  RECORD_DRAWER_OVERLAY_CLASS,
  RECORD_DRAWER_PANEL_CLASS,
  useDrawerTitleFocus,
} from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet.tsx';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
import { Printer } from '@/shared/icons/index.ts';

import { PRINT_PREVIEW_KEYS, PRINT_PREVIEW_NS } from './print-preview.constants.ts';

/**
 * The sheet's copy — the `print` namespace in the print language (Q-X2) —
 * loaded before the sheet shows, as `printDocument` loads it before printing.
 */
function usePrintCopy(): boolean {
  return useQuery({
    queryKey: ['i18n', PRINT_LANGUAGE, PRINT_TEMPLATE_NS],
    queryFn: async () => {
      await ensureNamespace(PRINT_LANGUAGE, PRINT_TEMPLATE_NS);
      return true;
    },
    staleTime: Number.POSITIVE_INFINITY,
  }).isSuccess;
}

/** The A4 sheet's width on screen at 96dpi (210mm), before it is fitted. */
const SHEET_WIDTH_PX = (210 / 25.4) * 96;

/** Props of {@link PrintPreview}. */
export interface PrintPreviewProps {
  /** What is previewed: "Invoice #787" — the header reads "Print preview · Invoice #787". */
  title: string;
  /** The A4 sheet (`InvoicePrint`, `PrescriptionPrint`) — shown, and what Print prints. */
  sheet: ReactElement;
  /** Close, the backdrop, Esc. */
  onClose: () => void;
  /** Root test id; `-close` and `-print` derive from it. */
  testId: string;
}

/**
 * A printed document's viewer (KICKOFF §6.6 Print preview, §6.9 Preview;
 * `patient-file.md:301–315`; H:948–957): a side panel of 820px on the muted
 * ground — "Print preview · Invoice #787" with "Close" and "Print / Save PDF"
 * in its header — holding the shared A4 sheet (L-22, the clinic's own
 * identity), fitted to the panel's width. A phone gets the full screen, the
 * header keeping 56px clear at its end. The backdrop and Esc close it; focus
 * starts on the title and goes back where it was, as on the record drawers.
 */
export function PrintPreview({ title, sheet, onClose, testId }: PrintPreviewProps) {
  const { t } = useTranslation(PRINT_PREVIEW_NS);
  const copyReady = usePrintCopy();
  const [bodyRef, bodyWidth] = useElementWidth<HTMLDivElement>();
  const { titleRef, onOpenAutoFocus, onCloseAutoFocus } = useDrawerTitleFocus();
  // The body's own 20px inset on each side; the sheet never grows past its size.
  const fit = bodyWidth ? Math.min(1, (bodyWidth - 40) / SHEET_WIDTH_PX) : 1;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="end"
        showCloseButton={false}
        overlayClassName={RECORD_DRAWER_OVERLAY_CLASS}
        aria-describedby={undefined}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        data-testid={testId}
        className={cn(RECORD_DRAWER_PANEL_CLASS, DRAWER_WIDTH_CLASS[820])}
      >
        <div className="flex h-15 flex-none items-center gap-2.5 border-b ps-(--drawer-pad-x) pe-(--drawer-pad-x) max-md:pe-14">
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.01em] outline-none"
          >
            {t(PRINT_PREVIEW_KEYS.title, { title })}
          </SheetTitle>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid={`${testId}-close`}
            className="h-9 flex-none"
          >
            {t(PRINT_PREVIEW_KEYS.close)}
          </Button>
          <Button
            type="button"
            onClick={() => void printDocument(sheet)}
            data-testid={`${testId}-print`}
            className="h-9 flex-none"
          >
            <Printer aria-hidden="true" className="size-4" />
            {t(PRINT_PREVIEW_KEYS.print)}
          </Button>
        </div>
        <div ref={bodyRef} className="bg-muted min-h-0 flex-1 overflow-auto px-5 py-6">
          <div
            data-slot="print-preview"
            style={{ '--sheet-fit': fit } as CSSProperties}
            className="bg-background mx-auto w-fit [zoom:var(--sheet-fit)] overflow-hidden rounded-md shadow-(--elevation-card)"
          >
            {copyReady ? sheet : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
