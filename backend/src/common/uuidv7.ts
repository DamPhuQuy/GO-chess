import { v7 as uuidv7 } from 'uuid';

/**
 * Generates an RFC 9562 compliant UUIDv7 string using the standard uuid library.
 */
export function generateUuidV7(): string {
  return uuidv7();
}
