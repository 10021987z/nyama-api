import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuService } from './menu.service';
import { QueryMenuDto } from './dto/query-menu.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('items')
  findAll(@Query() query: QueryMenuDto) {
    return this.menuService.findItems(query);
  }

  @Get('items/:id')
  findOne(@Param('id') id: string) {
    return this.menuService.findItemById(id);
  }
}
