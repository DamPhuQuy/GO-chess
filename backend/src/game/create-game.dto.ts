import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import type { GameMode, OpponentType } from '../database/database.types.js';
import type { DifficultyLevel } from './go-game.js';

export class CreateGameDto {
  @ValidateIf((_request, boardSize: unknown) => boardSize != null)
  @IsInt()
  boardSize?: number;

  @IsOptional()
  @IsIn(['beginner', 'easy', 'medium', 'hard', 'master', 'custom'])
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  customVisits?: number;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  name?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  gameMode?: GameMode;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  password?: string;

  @IsOptional()
  @IsIn(['BOT', 'HUMAN'])
  opponentType?: OpponentType;

  @IsOptional()
  @IsString()
  creatorId?: string;
}
