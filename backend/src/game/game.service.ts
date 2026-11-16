import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { generateInviteCode } from '../common/invite-code.js';
import { hashPassword, verifyPassword } from '../common/security.js';
import { generateUuidV7 } from '../common/uuidv7.js';
import type { GameMode, GameRecord, OpponentType } from '../database/database.types.js';
import { GameRepository } from '../database/game.repository.js';
import { UserRepository } from '../database/user.repository.js';
import { ComputerPlayer } from './computer-player.js';
import type { CreateGameDto } from './create-game.dto.js';
import { GameActionDto } from './game-action.dto.js';
import {
  GameRuleError,
  GoGame,
  Stone,
  type DifficultyLevel,
  type GameMove,
  type GameSnapshot,
} from './go-game.js';
import type { JoinGameDto } from './join-game.dto.js';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly gamesById = new Map<string, GoGame>();
  private readonly computerPlayer = new ComputerPlayer();

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly userRepository: UserRepository,
  ) {}

  createGame(dto: CreateGameDto): GameSnapshot {
    const gameId = generateUuidV7();
    const boardSize = dto.boardSize ?? 19;
    const difficulty: DifficultyLevel = dto.difficulty ?? 'medium';
    const opponentType: OpponentType = dto.opponentType ?? 'BOT';
    const gameMode: GameMode = dto.gameMode ?? 'PUBLIC';

    // Verify creator existence if specified (null for guest/anonymous play)
    let creatorId: string | null = null;
    if (dto.creatorId) {
      const existingUser = this.userRepository.findById(dto.creatorId);
      if (existingUser) {
        creatorId = existingUser.id;
      } else {
        throw new NotFoundException(`Creator user with id '${dto.creatorId}' does not exist`);
      }
    }

    // Password requirement check for PRIVATE games
    let passwordGameHash: string | null = null;
    if (gameMode === 'PRIVATE') {
      if (!dto.password || dto.password.trim().length === 0) {
        throw new BadRequestException('A password is required for PRIVATE games');
      }
      passwordGameHash = hashPassword(dto.password);
    }

    // Generate unique 6-digit numeric invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (this.gameRepository.findByInviteCode(inviteCode) && attempts < 10) {
      inviteCode = generateInviteCode();
      attempts++;
    }

    const gameName = dto.name?.trim() || `Game #${inviteCode}`;

    let game: GoGame;
    try {
      game = new GoGame(gameId, boardSize, difficulty, dto.customVisits);
    } catch (error) {
      if (error instanceof GameRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    game.setMetadata({
      name: gameName,
      inviteCode,
      gameMode,
      opponentType,
      creatorId,
      blackPlayerId: creatorId,
      whitePlayerId: opponentType === 'BOT' ? null : null,
    });

    const now = Date.now();
    const gameRecord: GameRecord = {
      id: gameId,
      invite_code: inviteCode,
      name: gameName,
      password_game_hash: passwordGameHash,
      game_mode: gameMode,
      board_size: game.getSize(),
      difficulty: opponentType === 'BOT' ? difficulty : null,
      status: 'ACTIVE',
      opponent_type: opponentType,
      creator_id: creatorId,
      black_player_id: creatorId,
      white_player_id: null,
      moves_json: JSON.stringify(game.getMoveHistory()),
      created_at: now,
      updated_at: now,
    };

    this.gameRepository.create(gameRecord);
    this.gamesById.set(gameId, game);

    return game.getSnapshot();
  }

  getGame(gameId: string): GameSnapshot {
    const game = this.findGame(gameId);
    return game.getSnapshot();
  }

  getGameByInviteCode(inviteCode: string): GameSnapshot {
    const record = this.gameRepository.findByInviteCode(inviteCode);
    if (!record) {
      throw new NotFoundException(`Game not found with invite code '${inviteCode}'`);
    }
    const game = this.findGame(record.id);
    return game.getSnapshot();
  }

  joinGame(dto: JoinGameDto): GameSnapshot {
    const record = this.gameRepository.findByInviteCode(dto.inviteCode);
    if (!record) {
      throw new NotFoundException(`Game with invite code '${dto.inviteCode}' was not found`);
    }

    if (record.status === 'FINISHED') {
      throw new BadRequestException('This game has already finished');
    }

    if (record.opponent_type === 'BOT') {
      throw new BadRequestException('Cannot join a single-player game versus bot');
    }

    if (record.white_player_id != null) {
      throw new BadRequestException('Game room is already full (2 players are joined)');
    }

    if (record.game_mode === 'PRIVATE') {
      if (!dto.password || !record.password_game_hash) {
        throw new BadRequestException('Password is required to enter this private game');
      }
      if (!verifyPassword(dto.password, record.password_game_hash)) {
        throw new BadRequestException('Incorrect game password');
      }
    }

    let joiningPlayerId: string | null = null;
    if (dto.playerId) {
      const user = this.userRepository.findById(dto.playerId);
      if (user) {
        joiningPlayerId = user.id;
      } else {
        throw new NotFoundException(`User with id '${dto.playerId}' does not exist`);
      }
    }

    this.gameRepository.joinGame(record.id, joiningPlayerId);

    const game = this.findGame(record.id);
    game.setMetadata({ whitePlayerId: joiningPlayerId });

    return game.getSnapshot();
  }

  async playAction(
    gameId: string,
    submittedAction: GameActionDto,
    actingPlayerId?: string,
  ): Promise<GameSnapshot> {
    const game = this.findGame(gameId);
    const record = this.gameRepository.findById(gameId);
    const move = this.toGameMove(submittedAction);

    if (record?.opponent_type === 'HUMAN') {
      if (!record.white_player_id) {
        throw new BadRequestException('Waiting for second player to join before moves can be played');
      }

      const currentTurn = game.getSnapshot().toMove;
      const expectedPlayerId =
        currentTurn === 'black' ? record.black_player_id : record.white_player_id;

      if (actingPlayerId && expectedPlayerId && actingPlayerId !== expectedPlayerId) {
        throw new BadRequestException(`It is ${currentTurn}'s turn`);
      }

      const stoneColor = currentTurn === 'black' ? Stone.Black : Stone.White;
      this.playMove(game, stoneColor, move);
    } else {
      // Versus BOT: human plays Black, then bot plays White
      this.playMove(game, Stone.Black, move);
      if (game.getStatus() === 'active') {
        const computerMove = await this.computerPlayer.chooseMove(game);
        try {
          game.play(Stone.White, computerMove);
        } catch (error) {
          if (error instanceof GameRuleError) {
            throw new InternalServerErrorException('computer could not make a legal move');
          }
          throw error;
        }
      }
    }

    // Persist latest moves and status to SQLite
    const status = game.getStatus() === 'active' ? 'ACTIVE' : 'FINISHED';
    this.gameRepository.updateMovesAndStatus(
      gameId,
      JSON.stringify(game.getMoveHistory()),
      status,
    );

    return game.getSnapshot();
  }

  private findGame(gameId: string): GoGame {
    const cachedGame = this.gamesById.get(gameId);
    if (cachedGame) {
      return cachedGame;
    }

    const record = this.gameRepository.findById(gameId);
    if (!record) {
      throw new NotFoundException('game not found');
    }

    const difficulty = (record.difficulty as DifficultyLevel) || 'medium';
    const game = new GoGame(record.id, record.board_size, difficulty);

    game.setMetadata({
      name: record.name,
      inviteCode: record.invite_code,
      gameMode: record.game_mode,
      opponentType: record.opponent_type,
      creatorId: record.creator_id,
      blackPlayerId: record.black_player_id,
      whitePlayerId: record.white_player_id,
    });

    if (record.moves_json) {
      try {
        const history = JSON.parse(record.moves_json) as Array<{
          color: Stone;
          move: GameMove;
        }>;
        for (const entry of history) {
          game.play(entry.color, entry.move);
        }
      } catch (error) {
        this.logger.error(`Could not replay history for game ${gameId}`, error);
      }
    }

    this.gamesById.set(gameId, game);
    return game;
  }

  private playMove(game: GoGame, color: Stone, move: GameMove): void {
    try {
      game.play(color, move);
    } catch (error) {
      if (error instanceof GameRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private toGameMove(submittedAction: GameActionDto): GameMove {
    switch (submittedAction.type) {
      case 'move':
        if (submittedAction.x == null || submittedAction.y == null) {
          throw new BadRequestException('move action requires x and y coordinates');
        }
        return {
          kind: 'move',
          position: { x: submittedAction.x, y: submittedAction.y },
        };
      case 'pass':
        if (submittedAction.x != null || submittedAction.y != null) {
          throw new BadRequestException('pass action does not accept coordinates');
        }
        return { kind: 'pass' };
      case 'resign':
        if (submittedAction.x != null || submittedAction.y != null) {
          throw new BadRequestException('resign action does not accept coordinates');
        }
        return { kind: 'resign' };
      default:
        throw new BadRequestException('move type must be move, pass, or resign');
    }
  }
}
