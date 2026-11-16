import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './create-user.dto.js';
import { UsersService, type GamePublicRecord, type UserPublicProfile } from './users.service.js';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  register(@Body() request: CreateUserDto): UserPublicProfile {
    return this.usersService.registerUser(request);
  }

  @Get(':id')
  getUser(@Param('id') id: string): UserPublicProfile {
    return this.usersService.getUser(id);
  }

  @Get(':id/games')
  getUserGames(@Param('id') id: string): { user: UserPublicProfile; games: GamePublicRecord[] } {
    return this.usersService.getUserWithGames(id);
  }
}
