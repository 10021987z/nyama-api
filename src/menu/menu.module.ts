import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { AdminMenuController } from './admin-menu.controller';
import { AdminMenuService } from './admin-menu.service';

@Module({
  providers: [MenuService, AdminMenuService],
  controllers: [MenuController, AdminMenuController],
})
export class MenuModule {}
