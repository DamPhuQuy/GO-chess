import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private database: DatabaseSync | null = null;

  get db(): DatabaseSync {
    if (!this.database) {
      throw new Error('Database is not initialized yet');
    }
    return this.database;
  }

  onModuleInit(): void {
    const dbPath = process.env.DATABASE_PATH || 'data/goban.sqlite';

    if (dbPath !== ':memory:') {
      const fullPath = resolve(process.cwd(), dbPath);
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.database = new DatabaseSync(fullPath);
      this.logger.log(`SQLite database opened at: ${fullPath}`);
    } else {
      this.database = new DatabaseSync(':memory:');
      this.logger.log('SQLite in-memory database opened');
    }

    this.configurePragmas();
    this.migrateTables();
  }

  onModuleDestroy(): void {
    if (this.database) {
      try {
        this.database.close();
        this.logger.log('SQLite database connection closed');
      } catch (error) {
        this.logger.error('Failed to close SQLite connection cleanly', error);
      } finally {
        this.database = null;
      }
    }
  }

  private configurePragmas(): void {
    if (!this.database) return;
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA busy_timeout = 5000;');
  }

  private migrateTables(): void {
    if (!this.database) return;

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        invite_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_game_hash TEXT,
        game_mode TEXT NOT NULL,
        board_size INTEGER NOT NULL,
        difficulty TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        opponent_type TEXT NOT NULL,
        creator_id TEXT,
        black_player_id TEXT,
        white_player_id TEXT,
        moves_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (black_player_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (white_player_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_games_invite_code ON games(invite_code);
      CREATE INDEX IF NOT EXISTS idx_games_creator_id ON games(creator_id);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    `);
  }
}
