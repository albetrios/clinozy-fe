import type { MedicalStack } from '../../hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_STACKED_SUFFIX,
} from '../../medical-drawers.constants.ts';
import { ManufacturerDrawer } from '../ManufacturerDrawer/index.ts';
import { MedicineDrawer } from '../MedicineDrawer/index.ts';
import { MrDrawer } from '../MrDrawer/index.ts';
import { SupplierDrawer } from '../SupplierDrawer/index.ts';

/**
 * The Medical drawers' stacked child (KICKOFF §6.7 Stacked child drawers;
 * `medical.md:343–355`): the record a picker's "New <thing> · “q”" + "full
 * details" asked for — a manufacturer, supplier or MR at 560px, a medicine at
 * 840px — on top of the open drawer with its own backdrop, named from the
 * picker's text. "Back", ×, the backdrop and Esc close only the child (the
 * child is the top layer, so Esc reaches it first); its save selects the new
 * record in the parent's field. It offers no "full details" of its own.
 */
export function MedicalStackHost({ stack }: { stack: MedicalStack }) {
  const child = stack.last;
  if (!child) return null;
  const testId = `${MEDICAL_DRAWER_TEST_IDS[child.kind]}${MEDICAL_STACKED_SUFFIX}`;
  const common = {
    open: stack.child !== null,
    onClose: stack.close,
    stacked: true,
    testId,
  } as const;
  switch (child.kind) {
    case 'manufacturer':
      return (
        <ManufacturerDrawer
          {...common}
          mode="create"
          prefill={{ name: child.query }}
          onSaved={stack.complete}
        />
      );
    case 'supplier':
      return (
        <SupplierDrawer
          {...common}
          mode="create"
          prefill={{ name: child.query, manufacturerIds: child.manufacturerIds }}
          onSaved={stack.complete}
        />
      );
    case 'mr':
      return (
        <MrDrawer
          {...common}
          mode="create"
          prefill={{ name: child.query }}
          onSaved={stack.complete}
        />
      );
    default:
      return (
        <MedicineDrawer
          {...common}
          mode="create"
          prefill={{ name: child.query }}
          onSaved={stack.complete}
        />
      );
  }
}
