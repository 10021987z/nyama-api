import { Module } from '@nestjs/common';
import { CooksService } from './cooks.service';
import { CooksController } from './cooks.controller';
import { CookController } from './cook.controller';

@Module({
  providers: [CooksService],
  controllers: [CooksController, CookController],
})
export class CooksModule {}
