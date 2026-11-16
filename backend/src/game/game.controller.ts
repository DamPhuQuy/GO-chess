import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateGameDto } from './create-game.dto.js';
import { GameActionDto } from './game-action.dto.js';
import { GameService } from './game.service.js';
import type { GameSnapshot } from './go-game.js';
import { JoinGameDto } from './join-game.dto.js';

@Controller('api/games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  createGame(@Body() request: CreateGameDto): GameSnapshot {
    if (request == null) {
      throw new BadRequestException('request body must contain valid JSON');
    }
    return this.gameService.createGame(request);
  }

  @Post('join')
  @HttpCode(200)
  joinGame(@Body() request: JoinGameDto): GameSnapshot {
    if (request == null) {
      throw new BadRequestException('request body must contain valid JSON');
    }
    return this.gameService.joinGame(request);
  }

  @Get('code/:inviteCode')
  getGameByInviteCode(@Param('inviteCode') inviteCode: string): GameSnapshot {
    return this.gameService.getGameByInviteCode(inviteCode);
  }

  @Get(':gameId')
  getGame(@Param('gameId') gameId: string): GameSnapshot {
    return this.gameService.getGame(gameId);
  }

  @Post(':gameId/actions')
  @HttpCode(200)
  async playAction(
    @Param('gameId') gameId: string,
    @Body() submittedAction: GameActionDto,
    @Query('playerId') playerId?: string,
  ): Promise<GameSnapshot> {
    if (submittedAction == null) {
      throw new BadRequestException('request body must contain valid JSON');
    }
    return this.gameService.playAction(gameId, submittedAction, playerId);
  }
}
