import { act, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import {
  AUTH_SHOWCASE_TEST_IDS as IDS,
  TOUR_CHAPTER_MS,
  TOUR_CHAPTERS,
  TOUR_END_REST_MS,
} from './auth-showcase.constants.ts';
import { AuthShowcasePrivacy, AuthShowcaseStage } from './AuthShowcase.tsx';

/** 24 October 2026, 17:22 local: inside clinic hours. */
const AFTERNOON = new Date(2026, 9, 24, 17, 22);

function renderStage(autoplay = true) {
  return render(<AuthShowcaseStage autoplay={autoplay} />);
}

/** Which step is current (`aria-current="step"`), by index. */
function currentStep(root: HTMLElement): number {
  return TOUR_CHAPTERS.findIndex(
    (_, index) =>
      within(root).getByTestId(IDS.step(index)).getAttribute('aria-current') === 'step',
  );
}

/** Runs `body` with the viewer asking for reduced motion. */
async function withReducedMotion(body: () => Promise<void>) {
  const matchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...matchMedia(query),
    matches: query.includes('reduce'),
  })) as typeof window.matchMedia;
  try {
    await body();
  } finally {
    window.matchMedia = matchMedia;
  }
}

/** Lets the tour's frame loop run for `ms`. */
async function play(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('AuthShowcaseStage — the tour', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
    vi.setSystemTime(AFTERNOON);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the stage, the clinics it is for and the promise', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    expect(within(stage).getByRole('heading', { level: 2 })).toHaveTextContent(
      'The whole clinic day, in one calm place.',
    );
    expect(stage).toHaveTextContent('For skin, hair & aesthetic clinics');
    expect(stage).toHaveAccessibleName('The whole clinic day, in one calm place.');
  });

  it('is one named image for the sheet, with seven named steps and a pause button', async () => {
    const { getByTestId, getByRole } = renderStage();
    const stage = getByTestId(IDS.stage);
    expect(
      getByRole('img', {
        name: `A preview of ${PRODUCT_NAME}’s Today view, following one patient from enquiry to follow-up.`,
      }),
    ).toBeInTheDocument();
    const group = within(stage).getByRole('group', { name: 'Product tour, 7 steps' });
    expect(within(group).getAllByRole('button')).toHaveLength(7);
    expect(
      within(group).getByRole('button', { name: 'Step 4 of 7: Patient file' }),
    ).toBeInTheDocument();
    expect(
      within(stage).getByRole('button', { name: 'Pause the product tour' }),
    ).toBeInTheDocument();
  });

  it('opens on Leads: Riya’s message at the viewer’s own time, her row still an open slot', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    expect(within(stage).getByTestId(IDS.narration)).toHaveTextContent(
      /Riya messages on Instagram at 5:22\s?PM/i,
    );
    const story = within(stage).getByTestId(IDS.story);
    expect(story).toHaveTextContent('Open slot');
    expect(story).toHaveTextContent('Free for booking');
    expect(within(stage).getByTestId(IDS.lens)).toHaveAttribute('data-chapter', 'leads');
  });

  it('moves on every chapter, rests on the last, and loops', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    expect(currentStep(stage)).toBe(0);
    await play(TOUR_CHAPTER_MS + 50);
    expect(currentStep(stage)).toBe(1);
    expect(within(stage).getByTestId(IDS.story)).toHaveTextContent('Riya Sharma');
    expect(within(stage).getByTestId(IDS.narration)).toHaveTextContent(
      /Booked into the 5:30\s?PM slot/i,
    );
    await play(TOUR_CHAPTER_MS * 5 + 50);
    expect(currentStep(stage)).toBe(6);
    await play(TOUR_CHAPTER_MS + 50);
    expect(currentStep(stage), 'the last chapter rests longer').toBe(6);
    await play(TOUR_END_REST_MS);
    expect(currentStep(stage)).toBe(0);
  });

  it('never narrates an automatic change, and does narrate a picked one', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    const narration = within(stage).getByTestId(IDS.narration);
    expect(narration).toHaveAttribute('aria-live', 'off');
    await play(TOUR_CHAPTER_MS + 50);
    expect(narration).toHaveAttribute('aria-live', 'off');
    fireEvent.click(within(stage).getByTestId(IDS.step(5)));
    expect(narration).toHaveAttribute('aria-live', 'polite');
    expect(narration).toHaveTextContent('Payments');
    expect(narration).toHaveTextContent(/₹4,500 paid by UPI/);
    expect(within(stage).getByTestId(IDS.lens)).toHaveAttribute(
      'data-chapter',
      'payments',
    );
  });

  it('holds still while paused, and goes on from where it was', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    fireEvent.click(within(stage).getByTestId(IDS.toggle));
    expect(within(stage).getByTestId(IDS.toggle)).toHaveAccessibleName(
      'Play the product tour',
    );
    await play(TOUR_CHAPTER_MS * 3);
    expect(currentStep(stage)).toBe(0);
    fireEvent.click(within(stage).getByTestId(IDS.toggle));
    await play(TOUR_CHAPTER_MS + 50);
    expect(currentStep(stage)).toBe(1);
  });

  it('holds still while the pointer is over it, or the viewer types elsewhere', async () => {
    const { getByTestId } = renderStage();
    const stage = getByTestId(IDS.stage);
    fireEvent.pointerEnter(stage);
    await play(TOUR_CHAPTER_MS * 2);
    expect(currentStep(stage)).toBe(0);
    fireEvent.pointerLeave(stage);

    const field = document.createElement('input');
    document.body.append(field);
    act(() => field.focus());
    await play(TOUR_CHAPTER_MS * 2);
    expect(currentStep(stage)).toBe(0);
    act(() => field.blur());
    await play(TOUR_CHAPTER_MS + 50);
    expect(currentStep(stage)).toBe(1);
    field.remove();
  });

  it('never plays on its own where autoplay is off — every step still answers a click', async () => {
    const { getByTestId } = renderStage(false);
    const stage = getByTestId(IDS.stage);
    expect(within(stage).queryByTestId(IDS.toggle)).toBeNull();
    await play(TOUR_CHAPTER_MS * 2);
    expect(currentStep(stage)).toBe(0);
    fireEvent.click(within(stage).getByTestId(IDS.step(2)));
    expect(currentStep(stage)).toBe(2);
    expect(within(stage).getByTestId(IDS.story)).toHaveTextContent('Checked in');
  });

  it('never plays on its own under reduced motion', async () => {
    await withReducedMotion(async () => {
      const { getByTestId } = renderStage();
      const stage = getByTestId(IDS.stage);
      expect(within(stage).queryByTestId(IDS.toggle)).toBeNull();
      await play(TOUR_CHAPTER_MS * 2);
      expect(currentStep(stage)).toBe(0);
    });
  });

  it('after hours shows tomorrow’s sheet, the clinic closed, and Riya booking into it', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 22, 40));
    const { getByTestId } = renderStage(false);
    const stage = getByTestId(IDS.stage);
    const sheet = within(stage).getByTestId(IDS.sheet);
    expect(sheet).toHaveTextContent('Tomorrow');
    expect(sheet).toHaveTextContent('Clinic closed');
    expect(sheet).toHaveTextContent('Free tomorrow');
    fireEvent.click(within(stage).getByTestId(IDS.step(1)));
    expect(within(stage).getByTestId(IDS.narration)).toHaveTextContent(
      /Booked into tomorrow’s 10:45\s?AM slot/i,
    );
  });

  it('draws every chapter’s scene — at its end under reduced motion', async () => {
    await withReducedMotion(async () => {
      const { getByTestId } = renderStage(false);
      const stage = getByTestId(IDS.stage);
      const scenes: Record<string, RegExp> = {
        leads: /Do you treat acne scars\?/,
        appointments: /Riya gets the earliest free slot/,
        frontDesk: /Dr\. Iyer is notified/,
        patientFile: /Adapalene 0\.1% gel · at night · 8 weeks/,
        treatment: /1 of 4 used/,
        payments: /Nothing due/,
        tasks: /Call Riya: how is her skin settling\?/,
      };
      for (const [index, chapter] of TOUR_CHAPTERS.entries()) {
        fireEvent.click(within(stage).getByTestId(IDS.step(index)));
        const lens = within(stage).getByTestId(IDS.lens);
        expect(lens).toHaveAttribute('data-chapter', chapter.id);
        expect(lens).toHaveTextContent(scenes[chapter.id] ?? /./);
      }
    });
  });

  it('plays a picked chapter’s scene: the message types in, then arrives', async () => {
    const { getByTestId } = renderStage(false);
    const stage = getByTestId(IDS.stage);
    fireEvent.click(within(stage).getByTestId(IDS.step(0)));
    const lens = within(stage).getByTestId(IDS.lens);
    expect(lens).not.toHaveTextContent(/Do you treat acne scars\?/);
    await play(1200);
    expect(within(stage).getByTestId(IDS.lens)).toHaveTextContent(
      /Do you treat acne scars\?/,
    );
  });

  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    const { container } = renderStage(false);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AuthShowcasePrivacy', () => {
  it('says each clinic sees only its own records', async () => {
    const { getByTestId } = render(<AuthShowcasePrivacy />);
    expect(getByTestId(IDS.privacy)).toHaveTextContent(
      'Private by design. Each clinic sees only its own records.',
    );
  });
});
