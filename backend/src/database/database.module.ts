import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { GameRepository } from './game.repository.js';
import { UserRepository } from './user.repository.js';

@Global()
@Module({
  providers: [DatabaseService, UserRepository, GameRepository],
  exports: [DatabaseService, UserRepository, GameRepository],
})
export class DatabaseModule {}
