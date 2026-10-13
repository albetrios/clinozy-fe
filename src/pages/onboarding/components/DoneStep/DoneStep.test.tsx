import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import type { OnboardingStep } from '../../onboarding-flow.ts';
import { DoneStep } from './DoneStep.tsx';

/*
 * The step list arrives as a prop now (ONB-9): this component used to re-derive
 * it from its own `useMeContext` + `useDeploymentFlags`, which is why those two
 * had to be mocked here. A missing context would have made that second
 * derivation fall back to the permissive deployment flags and summarise a
 * different flow than the one the user actually walked. One derivation, made by
 * the page from a proven-loaded context, passed down.
 */
const TEAM_ONLY_STEPS: readonly OnboardingStep[] = [
  'welcome',
  'profile',
  'workspace',
  'done',
];
const HYBRID_NO_TEAM_STEPS: readonly OnboardingStep[] = ['welcome', 'profile', 'done'];

describe('DoneStep', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('summarizes the name and the clinic name, and nothing else (team-only flow)', () => {
    useOnboardingStore
      .getState()
      .patch({ firstName: 'Ada', lastName: 'Lovelace', organizationName: 'Acme Inc.' });
    render(<DoneStep steps={TEAM_ONLY_STEPS} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
    // No invitations are collected here any more — inviting is the setup guide's.
    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.queryByText(/invit|pending/i)).not.toBeInTheDocument();
  });

  it('hides the organization row when the flow never collected it (hybrid, no team)', () => {
    // personal-and-team with no team membership: steps are
    // welcome/profile/done — no workspace step.
    useOnboardingStore.getState().patch({ firstName: 'Ada', lastName: 'Lovelace' });
    render(<DoneStep steps={HYBRID_NO_TEAM_STEPS} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    // No dangling "Organization: —" for a value this flow never asked for.
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('hides the organization row in personal-only mode too', () => {
    useOnboardingStore.getState().patch({ firstName: 'Solo' });
    render(<DoneStep steps={HYBRID_NO_TEAM_STEPS} />);
    expect(screen.getByText('Solo')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders only the rows the given step list collected', () => {
    // The prop is the single input: same store data, different flow, different
    // rows — no hidden second derivation to disagree with the page.
    useOnboardingStore
      .getState()
      .patch({ firstName: 'Ada', organizationName: 'Acme Inc.' });

    const { unmount } = render(<DoneStep steps={HYBRID_NO_TEAM_STEPS} />);
    expect(screen.queryByText('Acme Inc.')).not.toBeInTheDocument();
    unmount();

    render(<DoneStep steps={TEAM_ONLY_STEPS} />);
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  it("lays the summary out as a drawer step's peek tiles", () => {
    useOnboardingStore
      .getState()
      .patch({ firstName: 'Ada', organizationName: 'Acme Inc.' });
    render(<DoneStep steps={TEAM_ONLY_STEPS} />);
    const value = screen.getByText('Acme Inc.');
    expect(value.tagName).toBe('DD');
    expect(value).toHaveClass('text-detail', 'text-foreground');
    const tile = value.parentElement;
    expect(tile).toHaveClass('rounded-lg', 'border');
    expect(tile).not.toHaveClass('border-dashed');
    expect(tile?.querySelector('dt')).toHaveClass('uppercase', 'text-tiny');
  });

  it('draws a value not given on a dashed tile in the disabled ink', () => {
    render(<DoneStep steps={TEAM_ONLY_STEPS} />);
    const empties = screen.getAllByText('—');
    expect(empties).toHaveLength(2); // name and organization
    for (const empty of empties) {
      expect(empty).toHaveClass('text-disabled');
      expect(empty.parentElement).toHaveClass('border-dashed');
    }
  });

  it('has no accessibility violations', async () => {
    useOnboardingStore.getState().patch({ firstName: 'Ada' });
    const { container } = render(<DoneStep steps={TEAM_ONLY_STEPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
