import { Injectable } from '@nestjs/common';
import { generateUuidV7 } from '../common/uuidv7.js';
import { DatabaseService } from './database.service.js';
import type { GameRecord, UserRecord, UserRole } from './database.types.js';

@Injectable()
export class UserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  create(data: {
    id?: string;
    username: string;
    password_hash: string;
    role?: UserRole;
  }): UserRecord {
    const id = data.id || generateUuidV7();
    const role: UserRole = data.role || 'USER';
    const now = Date.now();

    this.databaseService.db
      .prepare(`
        INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(id, data.username, data.password_hash, role, now, now);

    return {
      id,
      username: data.username,
      password_hash: data.password_hash,
      role,
      created_at: now,
      updated_at: now,
    };
  }

  findById(id: string): UserRecord | null {
    const row = this.databaseService.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as unknown as UserRecord | undefined;
    return row ?? null;
  }

  findByUsername(username: string): UserRecord | null {
    const row = this.databaseService.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as unknown as UserRecord | undefined;
    return row ?? null;
  }

  findWithGames(id: string): { user: UserRecord; games: GameRecord[] } | null {
    const user = this.findById(id);
    if (!user) {
      return null;
    }

    const games = this.databaseService.db
      .prepare('SELECT * FROM games WHERE creator_id = ? ORDER BY created_at DESC')
      .all(id) as unknown as GameRecord[];

    return { user, games };
  }
}
