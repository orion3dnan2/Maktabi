export type EntityId = string;
export type ISODate = string;
export type ISODateTime = string;
export type CurrencyCode = 'SDG' | 'USD';
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
