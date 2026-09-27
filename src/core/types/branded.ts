/**
 * Branded public-ID types — prevent accidental ID swaps at the type level.
 *
 * These brand the **public** IDs that appear in URLs and API payloads
 * (`org_8fK2x`, `pat_x9Q2m`, …). Internal database IDs never reach the
 * frontend. Suffixes are random, never sequential (sequential IDs leak
 * volume). See docs/reference/routing-and-tenancy.md §8.
 *
 * Usage:
 *   const organizationId: OrganizationPublicId = OrganizationPublicId('org_8fK2x');
 *   // Error: Type 'UserPublicId' is not assignable to type 'OrganizationPublicId'
 *   const wrong: OrganizationPublicId = UserPublicId('usr_9aB3c');
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { [__brand]: B };

export type OrganizationPublicId = Brand<string, 'OrganizationPublicId'>;
export type UserPublicId = Brand<string, 'UserPublicId'>;
export type PatientPublicId = Brand<string, 'PatientPublicId'>;
export type AppointmentPublicId = Brand<string, 'AppointmentPublicId'>;
export type InvoicePublicId = Brand<string, 'InvoicePublicId'>;

/** Brand a validated string as an OrganizationPublicId. */
export const OrganizationPublicId = (id: string) => id as OrganizationPublicId;

/** Brand a validated string as a UserPublicId. */
export const UserPublicId = (id: string) => id as UserPublicId;

/** Brand a validated string as a PatientPublicId. */
export const PatientPublicId = (id: string) => id as PatientPublicId;

/** Brand a validated string as an AppointmentPublicId. */
export const AppointmentPublicId = (id: string) => id as AppointmentPublicId;

/** Brand a validated string as an InvoicePublicId. */
export const InvoicePublicId = (id: string) => id as InvoicePublicId;
