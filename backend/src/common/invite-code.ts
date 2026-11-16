import { randomInt } from 'node:crypto';

/**
 * Generates a 6-digit numeric invite code (100000 - 999999).
 */
export function generateInviteCode(): string {
  return randomInt(100000, 1000000).toString();
}
