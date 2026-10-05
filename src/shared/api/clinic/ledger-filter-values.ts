/**
 * The ledger's Filters values, in the chip order (`payments.md:39`) — Show,
 * What and Mode — read by the Payments ledger's search and Medical ›
 * Payments' (KICKOFF §6.7, §6.9). Declared here, not imported: both search
 * modules ride the entry chunk (`routeTree.tsx`), and the generated schema
 * module is pages of zod. The test pins each list to the contract's enum.
 */
import type { PaymentDirection, PaymentMode } from './clinic-schema.ts';
import type { LedgerKindFilter } from './payments-contracts.ts';

/** Each ledger filter's values, in the chip order. */
export const LEDGER_FILTER_VALUES = {
  direction: ['received', 'paid'],
  kind: ['receipt', 'refund', 'expense', 'money_back'],
  mode: ['cash', 'upi', 'card', 'credit'],
} as const satisfies {
  direction: readonly PaymentDirection[];
  kind: readonly LedgerKindFilter[];
  mode: readonly PaymentMode[];
};
