import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activateItem,
  activeItem,
  enabledItems,
  itemByValue,
  keepFocus,
  revealItem,
} from './picker-dom.ts';

function row(
  value: string,
  label: string,
  attributes: Record<string, string>,
): HTMLElement {
  const item = document.createElement('div');
  item.setAttribute('cmdk-item', '');
  item.setAttribute('data-value', value);
  for (const [name, attribute] of Object.entries(attributes)) {
    item.setAttribute(name, attribute);
  }
  item.textContent = label;
  return item;
}

function list(): HTMLElement {
  const root = document.createElement('div');
  const scroller = document.createElement('div');
  scroller.setAttribute('data-picker-scroll', '');
  scroller.append(
    row('all:a', 'A', { 'aria-selected': 'false' }),
    row('all:b', 'B', { 'aria-disabled': 'true' }),
    row('all:c', 'C', { 'aria-selected': 'true' }),
  );
  root.append(scroller);
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('picker DOM helpers', () => {
  it('finds the enabled rows, the active row and a row by value', () => {
    const root = list();
    expect(enabledItems(root).map((item) => item.textContent)).toEqual(['A', 'C']);
    expect(activeItem(root)?.textContent).toBe('C');
    expect(itemByValue(root, 'all:a')?.textContent).toBe('A');
    expect(itemByValue(root, 'all:b')).toBeUndefined();
    expect(enabledItems(null)).toEqual([]);
    expect(activeItem(null)).toBeNull();
  });

  it('activates a row through a pointermove and scrolls only the panel', () => {
    const root = list();
    const [item] = enabledItems(root);
    if (!item) throw new Error('no item');
    const scroller = root.querySelector<HTMLElement>('[data-picker-scroll]');
    if (!scroller) throw new Error('no scroller');
    Object.defineProperty(item, 'offsetTop', { value: 120 });
    Object.defineProperty(item, 'offsetHeight', { value: 36 });
    Object.defineProperty(scroller, 'clientHeight', { value: 100 });
    const moved = vi.fn();
    item.addEventListener('pointermove', moved);

    activateItem(item);
    expect(moved).toHaveBeenCalledTimes(1);
    expect(scroller.scrollTop).toBe(56);

    scroller.scrollTop = 200;
    revealItem(item);
    expect(scroller.scrollTop).toBe(120);
    activateItem(undefined);
  });

  it('leaves a row outside any panel where it is', () => {
    const loose = document.createElement('div');
    expect(() => revealItem(loose)).not.toThrow();
  });

  it('keeps focus where it is when a row is pressed', () => {
    const preventDefault = vi.fn();
    keepFocus({ preventDefault } as unknown as Parameters<typeof keepFocus>[0]);
    expect(preventDefault).toHaveBeenCalled();
  });
});
