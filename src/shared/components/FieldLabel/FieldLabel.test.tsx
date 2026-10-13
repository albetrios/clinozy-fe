import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { FieldLabel } from './FieldLabel.tsx';

describe('FieldLabel', () => {
  it('heads a preference control as a drawer field label and can name it by id', () => {
    render(
      <>
        <FieldLabel id="date-style">Date style</FieldLabel>
        <div role="group" aria-labelledby="date-style" />
      </>,
    );
    expect(screen.getByText('Date style')).toHaveClass(
      'text-xs',
      'font-medium',
      'text-muted-foreground-strong',
    );
    expect(screen.getByRole('group')).toHaveAccessibleName('Date style');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<FieldLabel>Time zone</FieldLabel>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
