import { Controller, Get, Param, Query } from '@nestjs/common';
import { CooksService } from './cooks.service';
import { QueryCooksDto } from './dto/query-cooks.dto';

@Controller('cooks')
export class CooksController {
  constructor(private readonly cooksService: CooksService) {}

  @Get()
  findAll(@Query() query: QueryCooksDto) {
    return this.cooksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cooksService.findById(id);
  }
}
