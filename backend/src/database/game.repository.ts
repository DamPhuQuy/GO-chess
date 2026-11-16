import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import type { GameRecord, GameStatus } from './database.types.js';

@Injectable()
export class GameRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  create(game: GameRecord): void {
    this.databaseService.db
      .prepare(`
        INSERT INTO games (
          id, invite_code, name, password_game_hash, game_mode,
          board_size, difficulty, status, opponent_type,
          creator_id, black_player_id, white_player_id,
          moves_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        game.id,
        game.invite_code,
        game.name,
        game.password_game_hash,
        game.game_mode,
        game.board_size,
        game.difficulty,
        game.status,
        game.opponent_type,
        game.creator_id,
        game.black_player_id,
        game.white_player_id,
        game.moves_json,
        game.created_at,
        game.updated_at,
      );
  }

  findById(id: string): GameRecord | null {
    const row = this.databaseService.db
      .prepare('SELECT * FROM games WHERE id = ?')
      .get(id) as unknown as GameRecord | undefined;
    return row ?? null;
  }

  findByInviteCode(inviteCode: string): GameRecord | null {
    const row = this.databaseService.db
      .prepare('SELECT * FROM games WHERE invite_code = ?')
      .get(inviteCode) as unknown as GameRecord | undefined;
    return row ?? null;
  }

  findByCreatorId(creatorId: string): GameRecord[] {
    return this.databaseService.db
      .prepare('SELECT * FROM games WHERE creator_id = ? ORDER BY created_at DESC')
      .all(creatorId) as unknown as GameRecord[];
  }

  updateMovesAndStatus(id: string, movesJson: string, status: GameStatus): void {
    const now = Date.now();
    this.databaseService.db
      .prepare(`
        UPDATE games
        SET moves_json = ?, status = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(movesJson, status, now, id);
  }

  joinGame(id: string, whitePlayerId: string | null): void {
    const now = Date.now();
    this.databaseService.db
      .prepare(`
        UPDATE games
        SET white_player_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(whitePlayerId, now, id);
  }

  listPublicActive(): GameRecord[] {
    return this.databaseService.db
      .prepare(`
        SELECT * FROM games
        WHERE game_mode = 'PUBLIC' AND status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 50
      `)
      .all() as unknown as GameRecord[];
  }
}
