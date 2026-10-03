import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PersonCard } from './PersonCard.tsx';

interface Person {
  name: string;
}

/** A load whose answer the test decides. */
function deferredLoad() {
  let resolve: (value: Person) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const signals: AbortSignal[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<Person>((res, rej) => {
        signals.push(signal);
        resolve = res;
        reject = rej;
      }),
  );
  return {
    load,
    signals,
    resolve: (value: Person) => act(() => resolve(value)),
    reject: () => act(() => reject(new Error('offline'))),
  };
}

/** `(hover: none)` answers `touch`; every other query is false. */
function stubPointer(touch: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: none)' && touch,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function Card(props: {
  data?: Person;
  load?: (signal: AbortSignal) => Promise<Person>;
  onRowClick?: () => void;
}) {
  return (
    // A table row whose own click opens the record.
    <div role="table" aria-label="Patients">
      <div role="row" tabIndex={-1} onClick={props.onRowClick} onKeyDown={() => {}}>
        <div role="cell">
          <PersonCard<Person>
            data={props.data}
            load={props.load}
            openDelay={20}
            closeDelay={20}
            label={(person) => `Card for ${person.name}`}
            testId="person-card"
            render={(person, close) => (
              <div>
                <p>{person.name} · details</p>
                <button type="button" onClick={close}>
                  Done
                </button>
              </div>
            )}
          >
            <span>Rhea Shah</span>
          </PersonCard>
        </div>
      </div>
    </div>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Rhea Shah' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PersonCard on a pointer that hovers', () => {
  it('fetches first, stays hidden while loading, then shows the card', async () => {
    const user = userEvent.setup();
    const pending = deferredLoad();
    render(<Card load={pending.load} />);

    await user.hover(trigger());
    await waitFor(() => expect(pending.load).toHaveBeenCalledOnce());
    // Never a skeleton popover: nothing shows until the data is in.
    expect(screen.queryByRole('dialog')).toBeNull();

    await pending.resolve({ name: 'Rhea Shah' });
    const card = await screen.findByRole('dialog', { name: 'Card for Rhea Shah' });
    expect(card).toHaveTextContent('Rhea Shah · details');
    expect(card).toHaveAttribute('data-testid', 'person-card');
    expect(card).toHaveClass('w-80', 'rounded-xl');
  });

  it('does not open when the load fails', async () => {
    const user = userEvent.setup();
    const pending = deferredLoad();
    render(<Card load={pending.load} />);

    await user.hover(trigger());
    await waitFor(() => expect(pending.load).toHaveBeenCalledOnce());
    await pending.reject();

    await new Promise((done) => setTimeout(done, 60));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops the load when the pointer leaves before it lands', async () => {
    const user = userEvent.setup();
    const pending = deferredLoad();
    render(<Card load={pending.load} />);

    await user.hover(trigger());
    await waitFor(() => expect(pending.load).toHaveBeenCalledOnce());
    await user.unhover(trigger());
    await waitFor(() => expect(pending.signals[0]?.aborted).toBe(true));

    await pending.resolve({ name: 'Rhea Shah' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens straight away with data in hand, and closes from inside', async () => {
    const user = userEvent.setup();
    render(<Card data={{ name: 'Rhea Shah' }} />);

    await user.hover(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('lets a click reach the row (the row opens the record)', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Card data={{ name: 'Rhea Shah' }} onRowClick={onRowClick} />);
    await user.click(trigger());
    expect(onRowClick).toHaveBeenCalledOnce();
  });

  it('draws the person-chip hover on its trigger', () => {
    render(<Card data={{ name: 'Rhea Shah' }} />);
    expect(trigger()).toHaveAttribute('data-slot', 'person-card-trigger');
    expect(trigger()).toHaveClass('hover:bg-muted', 'rounded-lg');
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<Card data={{ name: 'Rhea Shah' }} />);
    await user.hover(trigger());
    await screen.findByRole('dialog');
    expect(
      await axe(baseElement, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('PersonCard on a touch screen — (hover: none)', () => {
  it('opens the same card on a tap, once loaded, and the tap stays off the row', async () => {
    stubPointer(true);
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const pending = deferredLoad();
    render(<Card load={pending.load} onRowClick={onRowClick} />);

    // A popover trigger, not a hover card.
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger());
    expect(onRowClick).not.toHaveBeenCalled();
    expect(pending.load).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();

    await pending.resolve({ name: 'Rhea Shah' });
    const card = await screen.findByRole('dialog', { name: 'Card for Rhea Shah' });
    expect(card).toHaveClass('w-80');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('never opens on hover', async () => {
    stubPointer(true);
    const user = userEvent.setup();
    render(<Card data={{ name: 'Rhea Shah' }} />);
    await user.hover(trigger());
    await new Promise((done) => setTimeout(done, 60));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a second tap and on a tap outside', async () => {
    stubPointer(true);
    const user = userEvent.setup();
    render(
      <>
        <Card data={{ name: 'Rhea Shah' }} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(trigger());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('forgets a tap the user moved on from before the load landed', async () => {
    stubPointer(true);
    const user = userEvent.setup();
    const pending = deferredLoad();
    render(
      <>
        <Card load={pending.load} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await pending.resolve({ name: 'Rhea Shah' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pending.signals[0]?.aborted).toBe(true);
  });

  it('does not open when the load fails', async () => {
    stubPointer(true);
    const user = userEvent.setup();
    const pending = deferredLoad();
    render(<Card load={pending.load} />);

    await user.click(trigger());
    await pending.reject();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });
});
