import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AppToaster } from './AppToaster.tsx';
import { notify } from './notify.ts';

describe('toast dismiss integration', () => {
  afterEach(() => {
    act(() => {
      notify.dismiss();
    });
  });

  it('dismisses when the close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppToaster />);

    act(() => {
      notify.success('Hello');
    });

    await waitFor(() => expect(screen.getByTestId('app-toast')).toBeInTheDocument(), {
      timeout: 5000,
    });

    await user.click(screen.getByTestId('toast-dismiss'));

    await waitFor(
      () => expect(screen.queryByTestId('app-toast')).not.toBeInTheDocument(),
      {
        timeout: 5000,
      },
    );
  });
});
