import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { DocsModule } from './docs/docs.module.js';
import { GameModule } from './game/game.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, UsersModule, GameModule, DocsModule],
})
export class AppModule {}
