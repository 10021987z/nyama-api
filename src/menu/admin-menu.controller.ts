import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminMenuService } from './admin-menu.service';
import { QueryAdminMenuDto } from './dto/query-admin-menu.dto';
import { AdminUpdateMenuItemDto } from './dto/admin-update-menu-item.dto';

interface AuthUser {
  id: string;
  role: UserRole;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMenuController {
  constructor(private readonly adminMenu: AdminMenuService) {}

  @Get('menu/all')
  listAll(@Query() query: QueryAdminMenuDto) {
    return this.adminMenu.listAll(query);
  }

  @Get('menu/by-cook')
  listByCook(@Query() query: QueryAdminMenuDto) {
    return this.adminMenu.listByCook(query);
  }

  @Patch('menu-items/:id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateMenuItemDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.adminMenu.adminUpdate(id, dto, admin.id);
  }

  @Delete('menu-items/:id')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.adminMenu.adminDelete(id, admin.id, body?.reason);
  }
}
