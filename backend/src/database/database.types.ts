export type UserRole = 'USER' | 'ADMIN';
export type GameMode = 'PUBLIC' | 'PRIVATE';
export type GameStatus = 'ACTIVE' | 'FINISHED';
export type OpponentType = 'BOT' | 'HUMAN';

export interface UserRecord {
  id: string; // UUIDv7
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: number;
  updated_at: number;
}

export interface GameRecord {
  id: string; // UUIDv7
  invite_code: string; // 6-digit numeric string
  name: string;
  password_game_hash: string | null;
  game_mode: GameMode;
  board_size: number;
  difficulty: string | null;
  status: GameStatus;
  opponent_type: OpponentType;
  creator_id: string | null;
  black_player_id: string | null;
  white_player_id: string | null;
  moves_json: string | null;
  created_at: number;
  updated_at: number;
}
