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

  /**
   * Menu d'un restaurant (public, pour l'app Client).
   * Par défaut `isAvailable=true`. `?includeUnavailable=true` renvoie tout
   * (utile pour afficher les plats grisés "Indisponible").
   */
  @Get(':id/menu-items')
  listMenuItems(
    @Param('id') id: string,
    @Query('includeUnavailable') includeUnavailable?: string,
  ) {
    const include =
      includeUnavailable === 'true' || includeUnavailable === '1';
    return this.cooksService.getPublicMenuItems(id, include);
  }
}
