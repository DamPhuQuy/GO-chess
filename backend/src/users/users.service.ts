import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../common/security.js';
import type { GameRecord, UserRecord } from '../database/database.types.js';
import { UserRepository } from '../database/user.repository.js';
import { CreateUserDto } from './create-user.dto.js';

export type UserPublicProfile = Omit<UserRecord, 'password_hash'>;
export type GamePublicRecord = Omit<GameRecord, 'password_game_hash'>;

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  registerUser(dto: CreateUserDto): UserPublicProfile {
    const existing = this.userRepository.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('username is already registered');
    }

    const passwordHash = hashPassword(dto.password);
    const user = this.userRepository.create({
      username: dto.username,
      password_hash: passwordHash,
      role: dto.role,
    });

    const { password_hash: _omitted, ...profile } = user;
    return profile;
  }

  getUser(id: string): UserPublicProfile {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    const { password_hash: _omitted, ...profile } = user;
    return profile;
  }

  getUserWithGames(id: string): { user: UserPublicProfile; games: GamePublicRecord[] } {
    const result = this.userRepository.findWithGames(id);
    if (!result) {
      throw new NotFoundException('user not found');
    }
    const { password_hash: _omitted, ...profile } = result.user;
    const sanitizedGames: GamePublicRecord[] = result.games.map(
      ({ password_game_hash: _hash, ...game }) => game,
    );
    return {
      user: profile,
      games: sanitizedGames,
    };
  }
}
