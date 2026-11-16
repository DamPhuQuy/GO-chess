import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { UserRole } from '../database/database.types.js';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'username may only contain letters, numbers, underscores, and dashes',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 128)
  password!: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: UserRole;
}
