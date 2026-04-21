import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { SuggestMenuDto } from './dto/suggest-menu.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COOK)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('menu/suggest')
  suggestMenuItem(@Body() dto: SuggestMenuDto) {
    return this.aiService.suggestMenuItem(dto);
  }
}
