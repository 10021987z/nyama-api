import { IsDateString, IsEmail, IsOptional } from 'class-validator';

export class DailyReportDto {
  /** ISO date (YYYY-MM-DD). Defaults to today. */
  @IsOptional()
  @IsDateString()
  date?: string;

  /** Optional recipient email (no email is sent in this version — see service). */
  @IsOptional()
  @IsEmail()
  to?: string;
}
