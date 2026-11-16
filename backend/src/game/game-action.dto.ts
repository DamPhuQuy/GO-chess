import { IsInt, IsString, ValidateIf } from 'class-validator';

export class GameActionDto {
  @ValidateIf((_request, actionType: unknown) => actionType !== undefined && actionType !== null)
  @IsString()
  type?: string;

  @ValidateIf((_request, coordinate: unknown) => coordinate !== undefined && coordinate !== null)
  @IsInt()
  x?: number | null;

  @ValidateIf((_request, coordinate: unknown) => coordinate !== undefined && coordinate !== null)
  @IsInt()
  y?: number | null;
}
