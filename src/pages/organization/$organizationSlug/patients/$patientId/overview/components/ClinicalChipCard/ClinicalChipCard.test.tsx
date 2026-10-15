import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { MessageSquare } from '@/shared/icons/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import {
  installFakeSpeechRecognition,
  lastSpeechRecognition,
} from '@/tests/utils/speech-recognition-doubles.ts';

import type { ClinicalChip } from '../../../shared/patient-clinical.ts';
import { ClinicalChipCard, type ClinicalChipCardProps } from './ClinicalChipCard.tsx';

const ID = 'clinical-card-complaints';

const TANNING: ClinicalChip = {
  id: 'pcn_tanning',
  text: 'Tanning on face',
  pending: false,
  fresh: false,
};
const UNEVEN: ClinicalChip = {
  id: 'pcn_uneven',
  text: 'Uneven skin tone',
  pending: false,
  fresh: true,
};

async function renderCard(props: Partial<ClinicalChipCardProps> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const view = renderWithProviders(
    <ClinicalChipCard
      title="Complaints"
      tone="blush"
      icon={MessageSquare}
      items={[TANNING, UNEVEN]}
      loading={false}
      onAdd={onAdd}
      onRemove={onRemove}
      canEdit
      testId={ID}
      {...props}
    />,
  );
  await view.router.load();
  return { ...view, onAdd, onRemove, user: userEvent.setup() };
}

describe('ClinicalChipCard (H:780; patient-file.md:53)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows its chips, rings the ones added since the last visit and counts them', async () => {
    const { container } = await renderCard();
    const card = screen.getByTestId(ID);
    expect(within(card).getByRole('heading', { name: /Complaints/ })).toBeInTheDocument();
    const chips = within(card).getAllByTestId(`${ID}-chip`);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Tanning on face×',
      'Uneven skin tone×',
    ]);
    expect(chips[1]).toHaveAttribute('data-fresh', 'true');
    expect(chips[0]).not.toHaveAttribute('data-fresh');
    expect(within(card).getByTestId(`${ID}-new`)).toHaveTextContent('1 new');
    expect(within(card).getByTestId(`${ID}-new`)).toHaveAttribute(
      'title',
      'Added since the last visit',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds a chip on Enter, capitalised, and ignores a repeat', async () => {
    const { user, onAdd } = await renderCard();
    const input = screen.getByRole('textbox', { name: 'Add Complaints' });
    expect(input).toHaveAttribute('placeholder', 'Type and press Enter to add');
    expect(input).toHaveAttribute('maxlength', '60');
    await user.type(input, 'dry patches{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Dry patches');
    expect(input).toHaveValue('');
    await user.type(input, 'tanning on face{Enter}');
    await user.type(input, '   {Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('adds a spoken phrase as chips at once, one per part, a repeat ignored', async () => {
    installFakeSpeechRecognition();
    const { onAdd, user } = await renderCard();
    const input = screen.getByTestId(`${ID}-input`);
    await user.type(input, 'Draft');
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}');
    act(() =>
      lastSpeechRecognition()?.say(
        'dryness comma tanning on face comma itching at night full stop dryness',
        true,
      ),
    );
    expect(onAdd.mock.calls.map(([text]) => text)).toEqual([
      'Dryness',
      'Itching at night',
    ]);
    expect(input).toHaveValue('Draft');
  });

  it('removes a chip at once', async () => {
    const { user, onRemove } = await renderCard();
    await user.click(screen.getByRole('button', { name: 'Remove Tanning on face' }));
    expect(onRemove).toHaveBeenCalledWith(TANNING);
  });

  it('keeps a chip that is still saving from being removed', async () => {
    await renderCard({
      items: [TANNING, { id: 'saving:acne', text: 'Acne', pending: true, fresh: true }],
    });
    const chip = screen.getAllByTestId(`${ID}-chip`)[1];
    expect(chip).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Remove Acne' })).toBeDisabled();
    expect(screen.getByTestId(`${ID}-new`)).toHaveTextContent('1 new');
  });

  it('shows bars, and no input, while the notes load', async () => {
    const { container } = await renderCard({ items: [], loading: true });
    const card = screen.getByTestId(ID);
    expect(within(card).getByTestId('skeleton-rows')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(card).not.toHaveTextContent('Nothing added yet');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads without Patients edit, and says when it is empty', async () => {
    await renderCard({ items: [], canEdit: false });
    const card = screen.getByTestId(ID);
    expect(card).toHaveTextContent('Nothing added yet');
    // The compact look in the card's own tone (change-empty-states C2).
    const empty = within(card).getByTestId('empty-state');
    expect(empty).toHaveAttribute('data-variant', 'compact');
    expect(empty).toHaveAttribute('data-tone', 'blush');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByTestId(`${ID}-new`)).not.toBeInTheDocument();
  });
});
