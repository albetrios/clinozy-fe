import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Calendar, Receipt } from '@/shared/icons/index.ts';

import type { PatientAddItem } from '../../hooks/usePatientFileActions/index.ts';
import { PatientAddMenu, type PatientAddMenuProps } from './PatientAddMenu.tsx';

function renderMenu(props: Partial<PatientAddMenuProps> = {}) {
  const items: PatientAddItem[] = [
    { id: 'invoice', tone: 'butter', icon: Receipt, run: vi.fn() },
    { id: 'appointment', tone: 'sky', icon: Calendar, run: vi.fn() },
  ];
  const view = render(
    <PatientAddMenu
      variant="file"
      firstName="Dharti"
      items={items}
      trigger={<button type="button">Add to record</button>}
      {...props}
    />,
  );
  return { ...view, items };
}

describe('PatientAddMenu', () => {
  it('lists what may be added for the patient, from the bar’s "+"', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Add to record' }));
    const menu = await screen.findByRole('menu', { name: 'Add to record' });
    expect(menu).toHaveClass('w-61.5');
    expect(within(menu).getByText('Add for Dharti')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Invoice', 'Appointment']);
    expect(await axe(menu)).toHaveNoViolations();
  });

  it('runs the picked item and closes', async () => {
    const user = userEvent.setup();
    const { items } = renderMenu();
    await user.click(screen.getByRole('button', { name: 'Add to record' }));
    await user.click(await screen.findByTestId('patient-file-add-menu-appointment'));
    expect(items[1]?.run).toHaveBeenCalledOnce();
    expect(items[0]?.run).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('says the patient is already chosen from a section’s "⌄"', async () => {
    const user = userEvent.setup();
    renderMenu({ variant: 'section' });
    await user.click(screen.getByRole('button', { name: 'Add to record' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveClass('w-60');
    expect(within(menu).getByText('For Dharti · already selected')).toBeInTheDocument();
    // Each row hovers in its own tone.
    expect(within(menu).getByTestId('patient-file-add-menu-invoice')).toHaveClass(
      'focus:bg-tone-butter',
    );
  });
});
