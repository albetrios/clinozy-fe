import { afterEach, describe, expect, it } from 'vitest';

import { isEditableElementFocused, isEditableTarget } from './editable-focus.ts';

function mountFocused(html: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild as HTMLElement;
  el.focus();
  return el;
}

describe('isEditableElementFocused', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is false when nothing is focused', () => {
    document.body.innerHTML = '';
    expect(isEditableElementFocused()).toBe(false);
  });

  it.each([
    ['input', '<input />'],
    ['textarea', '<textarea></textarea>'],
    ['select', '<select><option>a</option></select>'],
  ])('is true for a focused %s', (_name, html) => {
    mountFocused(html);
    expect(isEditableElementFocused()).toBe(true);
  });

  it('is true for a focused contenteditable host', () => {
    mountFocused('<div contenteditable="true" tabindex="0"></div>');
    expect(isEditableElementFocused()).toBe(true);
  });

  it('is false for a focused button', () => {
    mountFocused('<button type="button">go</button>');
    expect(isEditableElementFocused()).toBe(false);
  });
});

describe('isEditableTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the element an event went to, focused or not', () => {
    document.body.innerHTML =
      '<input /><div contenteditable="true"><span>text</span></div><button>go</button>';
    const [input, host, button] = [
      document.querySelector('input'),
      document.querySelector('span'),
      document.querySelector('button'),
    ];
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(host)).toBe(true);
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
