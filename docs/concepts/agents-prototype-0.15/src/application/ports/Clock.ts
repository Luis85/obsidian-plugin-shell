/** Supplies an ISO-8601 UTC timestamp. The application never consults system time. */
export interface Clock { now(): string }
