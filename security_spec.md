# Security Specification - Refueling App

## Data Invariants
1. A refueling record must have a valid staff ID from the authenticated user.
2. Timestamps must be validated against the server time.
3. Once a record is created, it cannot be modified (Immutable records for audit).
4. Amounts must be positive numbers.

## The Dirty Dozen Payloads
1. Create a record with a different user's `staffId`.
2. Create a record with a future `timestamp`.
3. Create a record with a negative `amount`.
4. Update an existing record's `amount`.
5. Delete a record.
6. Create a record without a `department`.
7. Create a record with a very large string in `department`.
8. Inject script tag into `staffName`.
9. Set `staffId` to null.
10. Attempt to list records of other departments (if restricted).
11. Update `meterImageUrl` after creation.
12. Create a record with non-numeric `amount`.
