import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { DrawerFilesField, type PickedFile } from './drawer-files-field.tsx';

/** A bill field that takes images and PDFs. */
function Field({ disabled = false }: { disabled?: boolean }) {
  const [files, setFiles] = useState<PickedFile[]>([]);
  return (
    <DrawerFilesField
      id="files"
      files={files}
      onChange={setFiles}
      accept="image/*,application/pdf"
      takes={(file) => file.type.startsWith('image/') || file.type === 'application/pdf'}
      title="Drop the bill photo or browse"
      hint="Optional · JPG, PNG or PDF"
      removeLabel={(name) => `Remove ${name}`}
      disabled={disabled}
      testId="bill"
    />
  );
}

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('DrawerFilesField', () => {
  it('takes picked files it accepts as chips, each removable', async () => {
    const user = userEvent.setup();
    const { container } = render(<Field />);
    expect(screen.getByTestId('bill')).toHaveTextContent(
      'Drop the bill photo or browseOptional · JPG, PNG or PDF',
    );
    await user.upload(screen.getByTestId('bill-input'), [
      file('bill-1.jpg', 'image/jpeg'),
      file('bill.pdf', 'application/pdf'),
    ]);
    expect(screen.getByText('bill-1.jpg')).toBeInTheDocument();
    expect(screen.getByText('bill.pdf')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Remove bill-1.jpg' }));
    expect(screen.queryByText('bill-1.jpg')).toBeNull();
  });

  it('takes a dropped file it accepts, never one it does not', () => {
    render(<Field />);
    fireEvent.drop(screen.getByTestId('bill'), {
      dataTransfer: {
        files: [file('notes.txt', 'text/plain'), file('bill-2.png', 'image/png')],
      },
    });
    expect(screen.getByText('bill-2.png')).toBeInTheDocument();
    expect(screen.queryByText('notes.txt')).toBeNull();
  });

  it('takes nothing while disabled', () => {
    render(<Field disabled />);
    expect(screen.getByTestId('bill')).toBeDisabled();
    fireEvent.drop(screen.getByTestId('bill'), {
      dataTransfer: { files: [file('bill-3.png', 'image/png')] },
    });
    expect(screen.queryByText('bill-3.png')).toBeNull();
  });
});
