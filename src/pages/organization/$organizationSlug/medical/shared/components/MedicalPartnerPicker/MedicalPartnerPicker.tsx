import { useTranslation } from 'react-i18next';

import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';

import type { MedicalPickers } from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.pickers;

/** The partners a drawer field picks. */
export type MedicalPartnerKind = 'manufacturer' | 'supplier' | 'mr';

interface PartnerPickerBaseProps {
  kind: MedicalPartnerKind;
  /** The field's label: the trigger's and the list's accessible name. */
  label: string;
  /** The room's pickers: options, quick records and the stacked list. */
  pickers: MedicalPickers;
  /** Opens a stacked child for "full details"; a stacked drawer passes none. */
  openChild?: OpenMedicalChild;
  /** The maker whose distributors list first ("Distributes ALVI") and a new supplier carries. */
  makerId?: string | null;
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  disabled?: boolean;
  testId: string;
}

/** A one-pick partner field (a medicine's Manufacturer). */
interface PartnerPickerSingleProps extends PartnerPickerBaseProps {
  multiple?: false;
  value: string | null;
  onChange: (id: string | null) => void;
}

/** A pick-any partner field (a supplier's Manufacturers, a manufacturer's Suppliers and MRs). */
interface PartnerPickerMultipleProps extends PartnerPickerBaseProps {
  multiple: true;
  value: readonly string[];
  onChange: (ids: string[]) => void;
}

/** Props of {@link MedicalPartnerPicker}. */
export type MedicalPartnerPickerProps =
  PartnerPickerSingleProps | PartnerPickerMultipleProps;

/** Each kind's search placeholder (`medical.md:175, 197, 214–215, 231`). */
const PLACEHOLDERS = {
  manufacturer: { single: K.searchManufacturer, multiple: K.searchManufacturers },
  supplier: { single: K.searchSupplier, multiple: K.searchSuppliers },
  mr: { single: K.searchMrs, multiple: K.searchMrs },
} as const;

/** Each kind's create row ("Add supplier “q”") and footer ("New supplier · “q”"). */
const CREATE_LABELS = {
  manufacturer: { quick: K.addManufacturer, full: K.newManufacturer },
  supplier: { quick: K.addSupplier, full: K.newSupplier },
  mr: { quick: K.addMr, full: K.newMr },
} as const;

/**
 * A Medical drawer's partner field (`medical.md:175, 197, 214–215, 231,
 * 311–325`): the one picker over the makers, suppliers or MRs, with the quick
 * record ("Add manufacturer “acme”" — created, toasted and picked) and, unless
 * the drawer is itself stacked, the "New manufacturer · “acme”" + "full
 * details" footer that opens the record's own drawer on top; its save picks
 * the new record here.
 */
export function MedicalPartnerPicker(props: MedicalPartnerPickerProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { kind, pickers, openChild, makerId } = props;

  let options: PickerOption[] = pickers.mrs;
  if (kind === 'manufacturer') options = pickers.manufacturers;
  else if (kind === 'supplier') options = pickers.suppliers(makerId);

  /** Pick a record the drawer just created, alongside what is picked. */
  const select = (id: string) => {
    if (props.multiple) {
      if (!props.value.includes(id)) props.onChange([...props.value, id]);
      return;
    }
    props.onChange(id);
  };

  const quickCreate = async (query: string) => {
    let id: string;
    if (kind === 'manufacturer') id = await pickers.addManufacturer(query);
    else if (kind === 'supplier') {
      id = await pickers.addSupplier(query, makerId ? [makerId] : []);
    } else id = await pickers.addMr(query);
    select(id);
  };

  const fullCreate = (query: string) => {
    if (!openChild) return;
    if (kind === 'manufacturer') {
      openChild({
        kind,
        query,
        onCreated: (maker) => {
          pickers.remember.manufacturer(maker);
          select(maker.id);
        },
      });
    } else if (kind === 'supplier') {
      openChild({
        kind,
        query,
        manufacturerIds: makerId ? [makerId] : [],
        onCreated: (supplier) => {
          pickers.remember.supplier(supplier);
          select(supplier.id);
        },
      });
    } else {
      openChild({
        kind,
        query,
        onCreated: (rep) => {
          pickers.remember.mr(rep);
          select(rep.id);
        },
      });
    }
  };

  const shared = {
    label: props.label,
    options,
    placeholder: t(PLACEHOLDERS[kind][props.multiple ? 'multiple' : 'single']),
    searchPlaceholder: t(PLACEHOLDERS[kind][props.multiple ? 'multiple' : 'single']),
    searchable: true,
    size: 'md' as const,
    id: props.id,
    invalid: props.invalid,
    'aria-describedby': props['aria-describedby'],
    disabled: props.disabled,
    onCreate: (query: string) => {
      // The quick record reports its own failure (`useAppMutation` toasts it).
      quickCreate(query).catch(() => undefined);
    },
    createLabel: t(CREATE_LABELS[kind].quick),
    onCreateFull: openChild ? fullCreate : undefined,
    createFullLabel: t(CREATE_LABELS[kind].full),
    testId: props.testId,
  };

  return props.multiple ? (
    <Picker {...shared} multiple value={props.value} onChange={props.onChange} />
  ) : (
    <Picker {...shared} value={props.value} onChange={(id) => props.onChange(id)} />
  );
}
