import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import {
  REJECT_ALL_CONSENT_PREFERENCES,
  selectConsentCardOpen,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import {
  answerConsentForTests,
  resetConsentForTests,
} from '@/tests/utils/consent-cookie.ts';

import { PublicCard, PublicCardHeader, PublicFrame } from './PublicFrame.tsx';

describe('PublicFrame', () => {
  it('lays the signed-out canvas: the logo, the controls and a centred main', () => {
    render(
      <PublicFrame
        testId="frame"
        mainId="frame-main"
        controls={<button type="button">Theme</button>}
      >
        <p>Content</p>
      </PublicFrame>,
    );
    const frame = screen.getByTestId('frame');
    expect(frame).toHaveClass('bg-canvas', 'min-h-dvh');
    // The logo where the clinic header draws it — the wordmark shown at every width.
    const logo = within(frame).getByRole('img', { name: PRODUCT_NAME });
    expect(logo).toHaveAttribute('data-testid', 'brand-logo');
    expect(within(logo).getByTestId('product-wordmark').parentElement).toHaveClass(
      'inline-flex',
    );
    expect(
      within(screen.getByTestId('public-frame-controls')).getByRole('button'),
    ).toHaveTextContent('Theme');
    // The header at the app header's metrics; the footer matches it, so main centres.
    expect(screen.getByRole('banner')).toHaveClass(
      'min-h-13',
      'md:min-h-15',
      'px-(--room-header-pad-x)',
    );
    expect(screen.getByRole('contentinfo')).toHaveClass('min-h-13', 'md:min-h-15');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'frame-main');
    expect(main).toHaveClass('items-center', 'justify-center', 'py-2');
    expect(within(main).getByText('Content')).toBeInTheDocument();
  });

  it('reopens the cookie card from "Privacy choices" in its footer (claude.com)', async () => {
    resetConsentForTests();
    answerConsentForTests(REJECT_ALL_CONSENT_PREFERENCES);
    const user = userEvent.setup();
    render(
      <PublicFrame>
        <p>Content</p>
      </PublicFrame>,
    );
    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(false);

    await user.click(
      within(screen.getByRole('contentinfo')).getByRole('button', {
        name: 'Privacy choices',
      }),
    );

    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(true);
    resetConsentForTests();
  });

  it('skips to its own main', () => {
    render(
      <PublicFrame mainId="somewhere">
        <p>Content</p>
      </PublicFrame>,
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#somewhere',
    );
  });

  it('draws no controls slot without controls, and defaults the main id', () => {
    render(
      <PublicFrame>
        <p>Content</p>
      </PublicFrame>,
    );
    expect(screen.queryByTestId('public-frame-controls')).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PublicFrame controls={<button type="button">Theme</button>}>
        <PublicCard>
          <PublicCardHeader title="Welcome back" description="Pick a method below." />
        </PublicCard>
      </PublicFrame>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PublicCard', () => {
  it('is the "Signed out" card: 360px, the card slot, 12px corners, the drawer inset', () => {
    render(<PublicCard data-testid="card">Body</PublicCard>);
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('data-slot', 'card');
    expect(card).toHaveClass(
      'w-full',
      'max-w-90',
      'rounded-xl',
      'px-(--drawer-pad-x)',
      'py-7',
    );
  });

  it('widens to 480px for the wizard and takes extra classes', () => {
    render(
      <PublicCard data-testid="card" width="wizard" className="gap-0 p-0">
        Body
      </PublicCard>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('max-w-120', 'gap-0', 'p-0');
    expect(card).not.toHaveClass('max-w-90', 'py-7');
  });
});

describe('PublicCardHeader', () => {
  it('heads the page: an h1 in the drawer title anatomy over the 13px line', () => {
    render(
      <PublicCardHeader
        title="Check your email"
        description="We sent a code."
        titleTestId="title"
      />,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Check your email' });
    expect(heading).toHaveAttribute('data-testid', 'title');
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'tracking-[-0.01em]');
    expect(screen.getByText('We sent a code.')).toHaveClass(
      'text-body',
      'text-muted-foreground',
    );
  });

  it('leaves the line out without a description', () => {
    const { container } = render(<PublicCardHeader title="Session expired" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('draws the sign-in screen’s larger heading at display size', () => {
    render(<PublicCardHeader title="Welcome back" size="display" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Welcome back' });
    expect(heading).toHaveClass('text-2xl', 'xl:text-3xl', 'font-semibold');
    expect(heading).not.toHaveClass('text-lg');
  });
});
