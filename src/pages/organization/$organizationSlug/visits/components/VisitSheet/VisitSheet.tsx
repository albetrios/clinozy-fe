import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from 'radix-ui';
import { type RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import type { VisitTab } from '@/shared/clinic/visit-access.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

import { useTabStripScroll } from '../../hooks/useTabStripScroll/index.ts';
import { useVisitSave, type VisitSaveState } from '../../hooks/useVisitSave/index.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { VisitCheckout } from '../VisitCheckout/index.ts';
import { VisitConsult } from '../VisitConsult/index.ts';
import { VisitHistory } from '../VisitHistory/index.ts';
import { VisitTreatment } from '../VisitTreatment/index.ts';
import { VisitHeader } from './visit-header.tsx';

const K = VISIT_KEYS;
const ids = VISIT_TEST_IDS;

/** Props of {@link VisitSheet}. */
export interface VisitSheetProps {
  /** Null while the visit loads (a cold deep link). */
  detail: VisitDetail | null;
  /** The read failed and nothing is cached — the body offers Retry. */
  failed: boolean;
  onRetry: () => void;
  /** The open tab — one of `tabs`. */
  tab: VisitTab;
  /** The tabs the member may use (KICKOFF §6.13 Access by tab). */
  tabs: readonly VisitTab[];
  onTab: (tab: VisitTab) => void;
  /** "Close · Esc", Esc, the strip — and after Approve and Receive. */
  onClose: () => void;
  /** "Full profile" — the patient file's Overview; none for a lead's visit. */
  onProfile?: () => void;
}

/**
 * "All changes saved 10:42" · "Saving…" · "Not saved · your changes are kept":
 * at the tab row's inline end, and on a phone on its own line under the tabs,
 * so the four tabs keep the row's whole width (D29).
 */
function SavedLabel({
  state,
  savedAt,
}: {
  state: VisitSaveState;
  savedAt: string | null;
}) {
  const { t } = useTranslation([VISIT_NS, RECORD_DRAWER_NS]);
  const clock = useClinicClock();
  let label = '';
  if (state === 'saving') label = t(RECORD_DRAWER_KEYS.saving, { ns: RECORD_DRAWER_NS });
  else if (state === 'failed')
    label = t(RECORD_DRAWER_KEYS.notSaved, { ns: RECORD_DRAWER_NS });
  else if (savedAt) label = t(K.saved, { time: clock.time(savedAt) });
  return (
    <span
      role="status"
      data-testid={ids.saved}
      data-state={state}
      className={cn(
        'text-caption flex-none self-center ps-3 whitespace-nowrap max-md:self-end max-md:px-3 max-md:py-1.5',
        state === 'failed' ? 'text-destructive' : 'text-muted-foreground-strong',
      )}
    >
      {label}
    </span>
  );
}

/**
 * Focus on the name heading once the visit is read (KICKOFF §6.13: "focus
 * moves to the name heading on open") — a cold deep link opens on bars first.
 */
function useNameFocus(ready: boolean, nameRef: RefObject<HTMLHeadingElement | null>) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    nameRef.current?.focus();
  }, [ready, nameRef]);
}

/**
 * The Visit sheet (KICKOFF §6.13, D18, D29; `today.md` › Popups; H:2467–2666):
 * a fixed, opaque, full-viewport layer over the shell — header and tab bar
 * included — with dialog semantics, no backdrop and no animation. Focus moves
 * to the name; Esc, "Close · Esc" and the 12px "Close visit" strip at the
 * inline start close it (the strip is out of the tab order). The header band,
 * the tab row bound to `?tab=` with the save label at its inline end, and the
 * open tab, each writing its own record. Below `md` it scrolls as one page and
 * every tab's columns stack; the tabs keep the row's width (the save label
 * drops under them), the strip scrolls sideways with a faded edge where more
 * tabs wait, and the open tab is kept in view.
 */
export function VisitSheet({
  detail,
  failed,
  onRetry,
  tab,
  tabs,
  onTab,
  onClose,
  onProfile,
}: VisitSheetProps) {
  const { t } = useTranslation(VISIT_NS);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const save = useVisitSave();
  const [stripRef, edges] = useTabStripScroll(tab);
  useNameFocus(detail !== null, nameRef);

  const body = () => {
    if (!detail) {
      return failed ? (
        <RetryError onRetry={onRetry} />
      ) : (
        <div className="p-5.5">
          <SkeletonRows rows={6} label={t(K.loadingName)} rowClassName="h-10" />
        </div>
      );
    }
    switch (tab) {
      case 'timeline':
        return <VisitHistory detail={detail} tabs={tabs} onTab={onTab} />;
      case 'consult':
        return <VisitConsult detail={detail} save={save} onClose={onClose} />;
      case 'treatment':
        return <VisitTreatment detail={detail} save={save} />;
      case 'checkout':
        return <VisitCheckout detail={detail} save={save} onClose={onClose} />;
    }
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          data-testid={VISIT_TEST_IDS.page}
          data-tab={tab}
          onOpenAutoFocus={(event) => {
            // The name once the visit is read; until then the sheet itself.
            event.preventDefault();
            (nameRef.current ?? contentRef.current)?.focus();
          }}
          // Today restores the card's focus itself; the sheet hands nothing back.
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Full screen: nothing outside to click but a toast, which must not close it.
          onInteractOutside={(event) => event.preventDefault()}
          data-slot="dialog-content"
          className="bg-card fixed inset-0 z-50 flex outline-none"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t(K.closeStrip)}
            title={t(K.closeStrip)}
            onClick={onClose}
            data-testid={ids.closeStrip}
            className="w-3 flex-none cursor-default bg-transparent"
          />
          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col max-md:overflow-x-hidden max-md:overflow-y-auto max-md:pb-[env(safe-area-inset-bottom)]">
            <VisitHeader
              detail={detail}
              nameRef={nameRef}
              onClose={onClose}
              onProfile={onProfile}
            />
            <TabsPrimitive.Root
              value={tab}
              onValueChange={(value) => onTab(value as VisitTab)}
              className="flex min-h-0 flex-1 flex-col max-md:flex-none"
            >
              <div className="flex min-w-0 border-b px-5.5 pt-2 max-md:flex-col max-md:border-b-0 max-md:px-0">
                <div className="relative flex min-w-0 flex-1 max-md:border-b">
                  <TabsPrimitive.List
                    ref={stripRef}
                    aria-label={t(K.tabsLabel)}
                    className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1 overflow-x-auto max-md:gap-0 max-md:px-3 [&::-webkit-scrollbar]:hidden"
                  >
                    {tabs.map((value) => (
                      <TabsPrimitive.Trigger
                        key={value}
                        value={value}
                        data-tab={value}
                        data-testid={ids.tab(value)}
                        className="text-field data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground-strong hover:text-foreground -mb-px flex-none border-b-2 border-transparent px-3.5 py-2 whitespace-nowrap transition-colors max-md:px-2"
                      >
                        {t(K.tabs[value])}
                      </TabsPrimitive.Trigger>
                    ))}
                  </TabsPrimitive.List>
                  {/* Edge hints: more tabs wait past a faded end (a long locale on a phone). */}
                  {edges.start ? (
                    <span
                      aria-hidden="true"
                      data-edge="start"
                      className="from-background pointer-events-none absolute inset-y-0 start-0 w-6 bg-gradient-to-r to-transparent rtl:rotate-180"
                    />
                  ) : null}
                  {edges.end ? (
                    <span
                      aria-hidden="true"
                      data-edge="end"
                      className="to-background pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-r from-transparent rtl:rotate-180"
                    />
                  ) : null}
                </div>
                <SavedLabel
                  state={save.state}
                  savedAt={detail?.visit.updatedAt ?? null}
                />
              </div>
              <TabsPrimitive.Content
                value={tab}
                className="min-h-0 flex-1 overflow-hidden outline-none max-md:flex-none max-md:overflow-visible"
              >
                {body()}
              </TabsPrimitive.Content>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
