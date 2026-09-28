-- Portal accounts for an office's clients (الموكلين). Added in its own migration
-- because a new enum value cannot be used in the transaction that adds it.
alter type public.app_role add value if not exists 'client';
