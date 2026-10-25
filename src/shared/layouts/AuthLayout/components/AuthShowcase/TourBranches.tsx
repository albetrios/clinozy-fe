import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';

import {
  AUTH_SHOWCASE_KEYS as K,
  AUTH_SHOWCASE_NS,
  TOUR_BRANCHES,
  TOUR_HOME_BRANCH,
  type TourBranch,
  type TourBranchId,
} from './auth-showcase.constants.ts';
import {
  TOUR_BRANCH_LIST,
  tourBranchHours,
  useTourBranchWords,
} from './tour-branches.ts';
import { tourBranchState } from './tour-day.ts';
import type { TourFormat } from './tour-format.ts';

/*
 * The Branches chapter (the tour's eighth): Riya's Today sheet is the front of a deck, one sheet
 * per branch. As the chapter arrives the deck fans out — each branch's sheet named with its state
 * on the viewer's clock — then folds back into one sheet for every branch: the header's chip turns
 * from Vesu to "All branches" and each row is tagged with its branch. The motion is CSS
 * (`auth-showcase.css` › Branches), timed by one `--deck-fold-at`; each piece here remounts on
 * every arrival (`run`), so the chapter replays. Still, or under reduced motion, it is drawn
 * folded.
 */

/** A branch's tone dot. */
export function TourBranchDot({ branch }: { branch: TourBranch }) {
  return <span className={cn('tour-branch-dot', TONE_CLASSES[branch.tone].dot)} />;
}

/** The three branches' dots, overlapping: "every branch". */
export function TourBranchDots() {
  return (
    <span className="tour-branch-dots">
      {TOUR_BRANCH_LIST.map((branch) => (
        <TourBranchDot key={branch.id} branch={branch} />
      ))}
    </span>
  );
}

/**
 * The deck behind Riya's sheet: the other branches' sheets, the main one at the back. Fanned out,
 * each names itself and its state on the viewer's clock; folded, two edges above the sheet.
 */
export function TourBranchDeck({
  hours,
  now,
  playing,
  format,
}: {
  hours: BranchHours;
  now: Date;
  playing: boolean;
  format: TourFormat;
}) {
  const words = useTourBranchWords(format);
  const behind = TOUR_BRANCH_LIST.filter((branch) => branch.id !== TOUR_HOME_BRANCH);
  return (
    <div className={cn('tour-deck', playing && 'is-playing')}>
      {behind.map((branch, depth) => {
        const state = tourBranchState(tourBranchHours(branch, hours), now);
        return (
          <div key={branch.id} className="tour-deck-card" data-depth={depth}>
            <span className="tour-deck-name">
              <TourBranchDot branch={branch} />
              {branch.name}
            </span>
            <span className={cn('tour-live', state.kind !== 'open' && 'is-closed')}>
              <span className="tour-live-dot" />
              {words.state(state)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The sheet header's branch chip, as the header picker reads it: Riya's branch while the deck is
 * fanned, then "All branches" (the end state, still or under reduced motion). Its motion follows
 * the sheet's `.is-playing`, as every piece inside the sheet does.
 */
export function TourBranchChip() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const home = TOUR_BRANCHES[TOUR_HOME_BRANCH];
  return (
    <span data-slot="pill" className="tour-branch-chip">
      <span className="tour-branch-chip-label tour-deck-before">
        <TourBranchDot branch={home} />
        {home.name}
      </span>
      <span className="tour-branch-chip-label tour-deck-after">
        <TourBranchDots />
        {t(K.sheet.allBranches)}
      </span>
    </span>
  );
}

/**
 * A row's staff cell at Branches: its person while the sheet is one branch's, then its branch
 * once it is every branch's — with a bar of the branch's tone at the row's start.
 */
export function TourBranchTag({
  branchId,
  staff,
}: {
  branchId: TourBranchId;
  /** The person the cell named before (the row's `TourStaffCell`). */
  staff: ReactNode;
}) {
  const branch = TOUR_BRANCHES[branchId];
  return (
    <>
      <span className="tour-row-branch">
        <span
          className={cn(
            'tour-row-branch-bar tour-deck-after',
            TONE_CLASSES[branch.tone].dot,
          )}
        />
      </span>
      <span className="tour-staff-swap">
        <span className="tour-deck-before">{staff}</span>
        <span className="tour-staff tour-deck-after">
          <TourBranchDot branch={branch} />
          <span className="truncate">{branch.name}</span>
        </span>
      </span>
    </>
  );
}
