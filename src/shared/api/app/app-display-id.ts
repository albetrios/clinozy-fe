/**
 * Display ids: the contract's per-organisation `seq` with the schema's prefix
 * (D32 — `#2841`, `PT-0412`, `PAY-`, `INV-` / `S-`, `CN-`, `CR-`, `PO #`). The
 * primary key stays the uuid; these are labels, never lookups.
 */
const padded = (seq: number, width: number) => String(seq).padStart(width, '0');

/** The display id of each entity, from its `seq`. */
export const displayId = {
  /** Lists, pills and the file header: "#3508". */
  patient: (seq: number) => `#${seq}`,
  /** The patient code on print: "PT-0412". */
  patientCode: (seq: number) => `PT-${padded(seq, 4)}`,
  lead: (seq: number) => `#${seq}`,
  /** A person's contact number (`contact_number`): "C-12345". */
  contact: (seq: number) => `C-${seq}`,
  appointment: (seq: number) => `#${seq}`,
  prescription: (seq: number) => `#${seq}`,
  offering: (seq: number) => `#${seq}`,
  user: (seq: number) => `#${seq}`,
  payment: (seq: number) => `PAY-${seq}`,
  /** The printed invoice number ("Invoice #:" on the A4 sheet): "INV-787". */
  invoice: (seq: number) => `INV-${seq}`,
  /** An invoice on screen — "Clinic invoice #787", "Invoice #787 saved" (KICKOFF §6.0, §6.9). */
  invoiceNumber: (seq: number) => `#${seq}`,
  sale: (seq: number) => `S-${seq}`,
  creditNote: (seq: number) => `CN-${padded(seq, 3)}`,
  pendingCredit: (seq: number) => `CR-${seq}`,
  purchaseOrder: (seq: number) => `PO #${seq}`,
  medicine: (seq: number) => `#${seq}`,
  stockItem: (seq: number) => `#${seq}`,
  stockPurchase: (seq: number) => `#${seq}`,
} as const;
