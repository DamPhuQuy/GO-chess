import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'invite code must be exactly 6 digits' })
  inviteCode!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  playerId?: string;
}
