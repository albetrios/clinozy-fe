import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

/** Props of {@link PatientStaffPicker}. */
export interface PatientStaffPickerProps {
  value: string | null;
  onChange: (staffId: string | null, person: DirectoryMember | null) => void;
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
 * The record drawers' person picker (KICKOFF §6.6; `patient-file.md:109–129`): the team with
 * their avatars, on the one Picker — the Doctor's and the Therapist's alike, as the team has no
 * doctor or therapist roles to read (M41).
 */
export function PatientStaffPicker({
  value,
  onChange,
  label,
  placeholder,
  clearable = false,
  disabled,
  id,
  testId,
}: PatientStaffPickerProps) {
  const team = useTeamDirectory();
  const options: PickerOption<DirectoryMember>[] = team.members.map((person) => ({
    key: person.id,
    label: person.name,
    tone: person.tone,
    leading: { kind: 'avatar', initials: person.initials },
    keywords: [person.initials],
    data: person,
  }));
  return (
    <Picker<DirectoryMember>
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
