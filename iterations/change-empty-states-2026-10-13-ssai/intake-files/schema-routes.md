# Schema and routes — change-empty-states

This change is presentation only. It adds, changes and removes **no** entity, field, enum, API route,
permission or background job. Each screen it touches keeps the list read it already makes; the empty
state appears when that read returns no rows.

## Entities

None changed.

## API routes

None changed.

## Frontend routes

None added, changed or removed. The empty states render inside these existing routes:

- `/organization/:organizationSlug/today`
- `/organization/:organizationSlug/leads`
- `/organization/:organizationSlug/appointments`
- `/organization/:organizationSlug/patients`
- `/organization/:organizationSlug/patients/:patientId/:section`
- `/organization/:organizationSlug/medical/:section`
- `/organization/:organizationSlug/stock/:section`
- `/organization/:organizationSlug/payments`, `/payments/pending`, `/payments/day-close`
- `/organization/:organizationSlug/tasks`
- `/organization/:organizationSlug/offerings`, `/offerings/offers`
- `/organization/:organizationSlug/users`, `/users/roles`, `/users/branches`
- the `#settings/*` hash modal (not a route)
