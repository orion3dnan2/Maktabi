-- Trial office requests: an office requested from the sign-in screen waits as 'pending'
-- until the platform owner approves it ('active') or rejects it ('rejected').
-- Added in its own migration because a new enum value cannot be used in the
-- transaction that adds it.
alter type public.office_status add value if not exists 'pending';
alter type public.office_status add value if not exists 'rejected';
