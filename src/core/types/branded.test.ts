import {
  AppointmentPublicId,
  InvoicePublicId,
  OrganizationPublicId,
  PatientPublicId,
  UserPublicId,
} from './branded.ts';

describe('branded public-id types', () => {
  it('OrganizationPublicId("org_8fK2x") returns the input at runtime', () => {
    expect(OrganizationPublicId('org_8fK2x')).toBe('org_8fK2x');
  });

  it('UserPublicId("usr_9aB3c") returns the input at runtime', () => {
    expect(UserPublicId('usr_9aB3c')).toBe('usr_9aB3c');
  });

  it('factory functions are identity at runtime', () => {
    expect(PatientPublicId('pat_x9Q2m')).toBe('pat_x9Q2m');
    expect(AppointmentPublicId('apt_k4Lp7')).toBe('apt_k4Lp7');
    expect(InvoicePublicId('inv_t2Rw8')).toBe('inv_t2Rw8');
  });
});
