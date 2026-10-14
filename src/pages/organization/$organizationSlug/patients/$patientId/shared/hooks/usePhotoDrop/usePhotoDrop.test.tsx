import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePhotoDrop } from './usePhotoDrop.ts';

function Target({ onFiles }: { onFiles: ((files: FileList) => void) | null }) {
  const drop = usePhotoDrop(onFiles);
  return (
    <div data-testid="target" data-over={drop.over || undefined} {...drop.handlers}>
      <span data-testid="child">photos</span>
    </div>
  );
}

const files = [new File(['x'], 'cheek.jpg', { type: 'image/jpeg' })];

describe('usePhotoDrop', () => {
  it('marks the target while files hover it and hands the drop to onFiles', () => {
    const onFiles = vi.fn();
    render(<Target onFiles={onFiles} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: { types: ['Files'] } });
    expect(target).toHaveAttribute('data-over', 'true');
    fireEvent.drop(target, { dataTransfer: { files } });
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(target).not.toHaveAttribute('data-over');
  });

  it('clears the mark when the files leave the target', () => {
    render(<Target onFiles={vi.fn()} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(target);
    expect(target).not.toHaveAttribute('data-over');
  });

  it('ignores a drag of text or a link', () => {
    render(<Target onFiles={vi.fn()} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: { types: ['text/plain'] } });
    expect(target).not.toHaveAttribute('data-over');
  });

  it('is off without onFiles', () => {
    render(<Target onFiles={null} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: { types: ['Files'] } });
    expect(target).not.toHaveAttribute('data-over');
  });
});
