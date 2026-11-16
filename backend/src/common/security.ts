import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using BCrypt.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a BCrypt hash.
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!password || !hash) {
    return false;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
