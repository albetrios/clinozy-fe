import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TasksPage } from './TasksPage.tsx';

describe('TasksPage', () => {
  it('renders the room with its title', async () => {
    renderWithProviders(<TasksPage />);
    expect(await screen.findByTestId('tasks-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
