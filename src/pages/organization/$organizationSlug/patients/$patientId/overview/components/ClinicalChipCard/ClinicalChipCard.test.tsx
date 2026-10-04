import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ClinicalChipCard, type ClinicalChipCardProps } from './ClinicalChipCard.tsx';

const ID = 'clinical-card-complaints';

async function renderCard(props: Partial<ClinicalChipCardProps> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const view = renderWithProviders(
    <ClinicalChipCard
      title="Complaints"
      tone="blush"
      items={['Tanning on face', 'Uneven skin tone']}
      fresh={new Set(['Uneven skin tone'])}
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

  it('removes a chip at once', async () => {
    const { user, onRemove } = await renderCard();
    await user.click(screen.getByRole('button', { name: 'Remove Tanning on face' }));
    expect(onRemove).toHaveBeenCalledWith('Tanning on face');
  });

  it('reads without Patients edit, and says when it is empty', async () => {
    await renderCard({ items: [], fresh: new Set(), canEdit: false });
    const card = screen.getByTestId(ID);
    expect(card).toHaveTextContent('Nothing added yet');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByTestId(`${ID}-new`)).not.toBeInTheDocument();
  });
});
