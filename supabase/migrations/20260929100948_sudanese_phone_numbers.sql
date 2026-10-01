-- Maktabi is Sudan-only (owner decision, 2026-09-29): every stored phone number is a
-- Sudanese number in E.164 form, +249 followed by 9 digits. The app and manage-users
-- normalise what people type (0XXXXXXXXX, 9 digits, 00249…, Arabic digits) before saving.
-- No rows were converted: the project had no offices, profiles or clients when this was applied.
alter table public.clients
  drop constraint clients_phone_check,
  drop constraint clients_secondary_phone_check,
  drop constraint clients_whatsapp_check,
  add constraint clients_phone_check check (phone is null or phone ~ '^\+249[1-9][0-9]{8}$'),
  add constraint clients_secondary_phone_check check (secondary_phone is null or secondary_phone ~ '^\+249[1-9][0-9]{8}$'),
  add constraint clients_whatsapp_check check (whatsapp is null or whatsapp ~ '^\+249[1-9][0-9]{8}$');

alter table public.offices
  drop constraint offices_phone_check,
  add constraint offices_phone_check check (phone is null or phone ~ '^\+249[1-9][0-9]{8}$');

alter table public.profiles
  drop constraint profiles_phone_check,
  add constraint profiles_phone_check check (phone is null or phone ~ '^\+249[1-9][0-9]{8}$');
