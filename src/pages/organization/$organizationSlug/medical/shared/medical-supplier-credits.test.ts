import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh copy of the module: its credits and its "reset hooked" flag start over. */
async function freshModule() {
  vi.resetModules();
  return import('./medical-supplier-credits.ts');
}

/** A world reset the store can hook: `run()` is the world's "start over". */
function worldReset() {
  const hooks: (() => void)[] = [];
  return {
    onReset: vi.fn((hook: () => void) => {
      hooks.push(hook);
    }),
    run: () => {
      for (const hook of hooks) hook();
    },
  };
}

const credit = {
  supplierId: 'sup_shree',
  medicineId: 'med_glycolac',
  batchNo: 'GL-2611',
  qty: 3,
  amount: 48_600,
};

describe('supplierCreditStore — a supplier’s credit for stock sent back (fixture world)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T05:30:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty and keeps each credit with its own id and the time it was taken', async () => {
    const { supplierCreditStore } = await freshModule();
    const store = supplierCreditStore(worldReset().onReset);
    expect(store.list()).toEqual([]);

    const first = store.add(credit);
    const second = store.add({ ...credit, qty: 1, amount: 16_200 });

    expect(first).toEqual({
      ...credit,
      id: expect.any(String),
      at: '2026-10-12T05:30:00.000Z',
    });
    expect(second.id).not.toBe(first.id);
    expect(store.list()).toEqual([first, second]);
  });

  it('keeps a zero-amount credit as it was given', async () => {
    const { supplierCreditStore } = await freshModule();
    const store = supplierCreditStore(worldReset().onReset);
    expect(store.add({ ...credit, qty: 0, amount: 0 })).toMatchObject({
      qty: 0,
      amount: 0,
    });
    expect(store.list()).toHaveLength(1);
  });

  it('never changes a list already read — a new credit makes a new list', async () => {
    const { supplierCreditStore } = await freshModule();
    const store = supplierCreditStore(worldReset().onReset);
    const before = store.list();
    store.add(credit);
    expect(before).toEqual([]);
    expect(store.list()).toHaveLength(1);
  });

  it('shares one set of credits across every store it hands out', async () => {
    const { supplierCreditStore } = await freshModule();
    const reset = worldReset();
    supplierCreditStore(reset.onReset).add(credit);
    expect(supplierCreditStore(reset.onReset).list()).toHaveLength(1);
  });

  it('hooks the world’s reset once, and forgets every credit when the world starts over', async () => {
    const { supplierCreditStore } = await freshModule();
    const reset = worldReset();
    const store = supplierCreditStore(reset.onReset);
    supplierCreditStore(reset.onReset);
    supplierCreditStore(reset.onReset);
    expect(reset.onReset).toHaveBeenCalledOnce();

    store.add(credit);
    store.add({ ...credit, batchNo: 'GL-2612' });
    reset.run();
    expect(store.list()).toEqual([]);

    // The store still takes credits after a reset.
    store.add(credit);
    expect(store.list()).toHaveLength(1);
  });
});
