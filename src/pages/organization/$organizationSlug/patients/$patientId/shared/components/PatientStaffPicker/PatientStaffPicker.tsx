import type { AppointmentStaff } from '@/shared/api/clinic/appointments-contracts.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';

/** Props of {@link PatientStaffPicker}. */
export interface PatientStaffPickerProps {
  /** Who it lists: the clinic's doctors, or its therapists. */
  staffRole: 'doctor' | 'therapist';
  value: string | null;
  onChange: (staffId: string | null, person: AppointmentStaff | null) => void;
  /** The field's name ("Doctor") and the empty trigger's text ("Pick doctor"). */
  label: string;
  placeholder: string;
  /** A tap on the picked one clears it ("Therapist · tap again to clear"). */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  testId: string;
}

/**
 * The record drawers' person picker (KICKOFF §6.6; `patient-file.md:109–129`):
 * the active doctors or therapists with their avatars, on the one Picker. A
 * picked person who has since left still shows on a saved record.
 */
export function PatientStaffPicker({
  staffRole,
  value,
  onChange,
  label,
  placeholder,
  clearable = false,
  disabled,
  id,
  testId,
}: PatientStaffPickerProps) {
  const staff = useBookableStaff();
  const people = (staff.data ?? []).filter(
    (person) =>
      person.roles.includes(staffRole) && (person.active || person.id === value),
  );
  const options: PickerOption<AppointmentStaff>[] = people.map((person) => ({
    key: person.id,
    label: personFullName(person),
    tone: person.tone,
    leading: { kind: 'avatar', initials: person.initials },
    keywords: [person.initials],
    data: person,
  }));
  return (
    <Picker<AppointmentStaff>
      id={id}
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(key, option) => onChange(key, option?.data ?? null)}
      clearable={clearable}
      disabled={disabled}
      size="md"
      testId={testId}
    />
  );
}
