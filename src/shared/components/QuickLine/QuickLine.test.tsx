import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type {
  QuickLineBrowseConfig,
  QuickLineItem,
  QuickLineParse,
} from './quick-line.types.ts';
import { QuickLine } from './QuickLine.tsx';

/** A tiny grammar: `xN` is a quantity, every other token a word. */
interface Values {
  qty?: number;
}

function parse(text: string): QuickLineParse<Values> {
  const words: string[] = [];
  const values: Values = {};
  for (const token of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    if (/^x\d+$/.test(token)) values.qty = Number(token.slice(1));
    else words.push(token);
  }
  return { words, values, tags: values.qty ? [`×${values.qty}`] : [] };
}

const CATALOG = ['Flubolt 400', 'Sunscreen SPF 50', 'Tranexa 500'].map(
  (name): QuickLineItem<string> => ({
    key: name,
    label: name,
    sub: 'No previous dosage',
    data: name,
  }),
);

const matches = (words: readonly string[]) =>
  CATALOG.filter((item) =>
    words.every((word) => item.label.toLowerCase().includes(word)),
  );

const typedName = (words: readonly string[]) => {
  const term = words.join(' ');
  return term && !CATALOG.some((item) => item.label.toLowerCase() === term) ? term : null;
};

function renderLine({
  browse,
}: { browse?: Partial<QuickLineBrowseConfig<string>> } = {}) {
  const onPick = vi.fn();
  const onCreate = vi.fn();
  const onStep = vi.fn();
  function Host() {
    const [counts, setCounts] = useState<Record<string, number>>({});
    return (
      <QuickLine<string, Values>
        placeholder="Type medicine, dose, timing"
        hint="x8"
        parse={parse}
        matches={matches}
        typedName={typedName}
        onPick={onPick}
        onCreate={onCreate}
        frequent={{ label: 'Often prescribed', items: CATALOG.slice(0, 2) }}
        browse={{
          groups: [
            { id: 'all', label: 'All' },
            { id: 'topical', label: 'Topical' },
          ],
          tiles: (group, words) =>
            matches(words).filter(
              (item) => group === 'all' || item.label.includes('SPF'),
            ),
          count: (item) => counts[item.key] ?? 0,
          added: Object.values(counts).filter((count) => count > 0).length,
          onStep: (item, step) => {
            onStep(item.key, step);
            setCounts((current) => ({
              ...current,
              [item.key]: (current[item.key] ?? 0) + step,
            }));
          },
          newItem: {
            placeholder: 'Medicine not in the list',
            onAdd: (name) => onCreate(name, {}),
          },
          ...browse,
        }}
        testId="rx-line"
      />
    );
  }
  const user = userEvent.setup();
  const view = render(<Host />);
  return { ...view, user, onPick, onCreate, onStep };
}

describe('QuickLine', () => {
  it('suggests on focus, then narrows to the typed words', async () => {
    const { user } = renderLine();
    await user.click(screen.getByRole('combobox', { name: 'Quick add' }));
    const list = await screen.findByRole('listbox', { name: 'Matches' });
    expect(within(list).getByText('Suggested · click to add')).toBeVisible();
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    await user.type(screen.getByRole('combobox'), 'tran');
    const narrowed = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(narrowed.map((option) => option.textContent)).toEqual([
      'Tranexa 500No previous dosage',
      'tranNot in the list · add as typed',
    ]);
    expect(screen.getByRole('listbox')).not.toHaveTextContent('Suggested');
  });

  it('adds the active match with the shorthand, clears the line and keeps the focus', async () => {
    const { user, onPick } = renderLine();
    const input = screen.getByRole('combobox');
    await user.type(input, 'sun x2');
    expect(screen.getByText('×2')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('Sunscreen SPF 50', { qty: 2 });
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('moves through the matches with the arrows', async () => {
    const { user, onPick } = renderLine();
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith('Tranexa 500', {});
  });

  it('offers a name the list lacks “as typed”', async () => {
    const { user, onCreate } = renderLine();
    await user.type(screen.getByRole('combobox'), 'minoxin x3');
    const typed = await screen.findByTestId('rx-line-typed');
    expect(typed).toHaveTextContent('Not in the list · add as typed');
    await user.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith('minoxin', { qty: 3 });
  });

  it('says so when nothing matches and nothing can be added', async () => {
    function NoCreate() {
      return (
        <QuickLine<string, Values>
          placeholder="Type"
          parse={parse}
          matches={matches}
          onPick={() => undefined}
          testId="line"
        />
      );
    }
    const user = userEvent.setup();
    render(<NoCreate />);
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(await screen.findByTestId('line-no-match')).toHaveTextContent(
      'No match. Check the spelling or try fewer letters.',
    );
  });

  it('clears a typed line on Escape, then closes the list', async () => {
    const { user } = renderLine();
    const input = screen.getByRole('combobox');
    await user.type(input, 'flu');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.getByRole('listbox')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('adds a frequent chip as it stands', async () => {
    const { user, onPick } = renderLine();
    const chips = screen.getByTestId('rx-line-frequent');
    expect(chips).toHaveTextContent('Often prescribed');
    await user.click(within(chips).getByRole('button', { name: /Flubolt 400/ }));
    expect(onPick).toHaveBeenCalledWith('Flubolt 400', {});
  });

  it('browses the groups, adds from a tile and steps it', async () => {
    const { user, onStep } = renderLine();
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    const panel = await screen.findByTestId('rx-line-browse-panel');
    expect(within(panel).getByText('Tap a tile to add')).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: 'Topical' }));
    expect(within(panel).getAllByTestId('rx-line-browse-tile')).toHaveLength(1);
    await user.click(
      within(panel).getByRole('button', { name: 'Add one · Sunscreen SPF 50' }),
    );
    expect(onStep).toHaveBeenLastCalledWith('Sunscreen SPF 50', 1);
    expect(within(panel).getByText('1 added')).toBeVisible();
    await user.click(
      within(panel).getByRole('button', { name: 'Remove one · Sunscreen SPF 50' }),
    );
    expect(onStep).toHaveBeenLastCalledWith('Sunscreen SPF 50', -1);
    await user.click(within(panel).getByTestId('rx-line-browse-done'));
    expect(screen.queryByTestId('rx-line-browse-panel')).not.toBeInTheDocument();
  });

  it('adds a name from Browse’s own field, and says when a group is empty', async () => {
    const { user, onCreate } = renderLine({ browse: { tiles: () => [] } });
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    const panel = await screen.findByTestId('rx-line-browse-panel');
    expect(within(panel).getByText('Nothing in this group matches.')).toBeVisible();
    await user.type(
      within(panel).getByRole('textbox', { name: 'Medicine not in the list' }),
      'Kojic gel{Enter}',
    );
    expect(onCreate).toHaveBeenCalledWith('Kojic gel', {});
  });

  it('counts past sixty tiles', async () => {
    const many = Array.from({ length: 64 }, (_, index): QuickLineItem<string> => ({
      key: `m${index}`,
      label: `Medicine ${index}`,
      data: `m${index}`,
    }));
    const { user } = renderLine({ browse: { tiles: () => many } });
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    const panel = await screen.findByTestId('rx-line-browse-panel');
    expect(within(panel).getAllByTestId('rx-line-browse-tile')).toHaveLength(60);
    expect(panel).toHaveTextContent('Showing 60 of 64 · type to narrow');
  });

  it('has no axe violations, open or closed', async () => {
    const { user, container } = renderLine();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('combobox'));
    const list = screen
      .getByTestId('rx-line-matches')
      .closest<HTMLElement>('[data-slot="popover-content"]');
    expect(await axe(list as HTMLElement)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    expect(
      await axe(await screen.findByTestId('rx-line-browse-panel')),
    ).toHaveNoViolations();
  });
});
