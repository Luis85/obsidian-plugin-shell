/** Returns a new opaque identifier in the requested namespace. */
export interface IdGenerator { next(prefix: string): string }
