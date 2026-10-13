/*
 * Supplier credit from returned expiring stock (`medical.md:297–309`). The
 * schema has no operation or record for it (Appendix F), so the fixture server
 * keeps it beside the world — cleared with the world's reset — until clinozy-be
 * does (REPLACE_WITH_API). A credit lowers what the room owes that supplier and
 * shows as "Credit · 026-312" in its Account.
 */

/** One credit a supplier gave for stock sent back. */
export interface SupplierCredit {
  id: string;
  supplierId: string;
  medicineId: string;
  batchNo: string;
  qty: number;
  /** Paise — qty × the batch's purchase rate. */
  amount: number;
  /** When it was taken (ISO). */
  at: string;
}

let credits: SupplierCredit[] = [];
let resetHooked = false;

/**
 * The credits store, registered once with the world's reset so a test — or the
 * fixture server's "start over" — forgets them with everything else.
 */
export function supplierCreditStore(onReset: (hook: () => void) => void) {
  if (!resetHooked) {
    resetHooked = true;
    onReset(() => {
      credits = [];
    });
  }
  return {
    list: (): readonly SupplierCredit[] => credits,
    add: (credit: Omit<SupplierCredit, 'id' | 'at'>): SupplierCredit => {
      const saved: SupplierCredit = {
        ...credit,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      };
      credits = [...credits, saved];
      return saved;
    },
  };
}
