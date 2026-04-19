import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RidersService } from './riders.service';
import { UsersService } from '../users/users.service';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { QueryEarningsDto } from './dto/query-earnings.dto';
import { SendOrderMessageDto } from './dto/send-order-message.dto';
import { UpdateRiderStatusDto } from './dto/update-rider-status.dto';
import { PostRiderLocationDto } from './dto/post-rider-location.dto';
import { UpdateRiderProfileDto } from './dto/update-rider-profile.dto';

interface AuthUser {
  id: string;
  role: UserRole;
}

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

class UploadAvatarBase64Dto {
  dataBase64?: string;
  mimeType?: string;
}

@Controller('rider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly usersService: UsersService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.ridersService.getProfile(user.id);
  }

  @Get('me/profile')
  getFullProfile(@CurrentUser() user: AuthUser) {
    return this.ridersService.getFullProfile(user.id);
  }

  @Patch('me/profile')
  updateFullProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(user.id, dto as unknown as Record<string, unknown>);
  }

  @Get('me/stats/financial')
  getFinancialStats(@CurrentUser() user: AuthUser) {
    return this.ridersService.getFinancialStats(user.id);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_SIZE },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadAvatarBase64Dto,
  ) {
    return this.usersService.uploadAvatar(user.id, file, body);
  }

  @Post('location')
  @HttpCode(HttpStatus.OK)
  postLocation(
    @CurrentUser() user: AuthUser,
    @Body() dto: PostRiderLocationDto,
  ) {
    return this.ridersService.updateLocationLive(user.id, dto.lat, dto.lng, dto.orderId);
  }

  @Get('available-orders')
  getAvailableOrders() {
    return this.ridersService.getAvailableOrders();
  }

  @Post('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ridersService.acceptOrder(id, user.id);
  }

  // Certains clients utilisent PATCH historiquement → on supporte les deux.
  @Patch('orders/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptOrderPatch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ridersService.acceptOrder(id, user.id);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRiderStatusDto,
  ) {
    return this.ridersService.updateRiderStatus(user.id, dto);
  }

  @Patch('deliveries/:id/status')
  @HttpCode(HttpStatus.OK)
  updateDeliveryStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.ridersService.updateDeliveryStatus(id, user.id, dto.status);
  }

  @Get('earnings')
  getEarnings(@CurrentUser() user: AuthUser, @Query() query: QueryEarningsDto) {
    return this.ridersService.getEarnings(user.id, query);
  }

  // ─── Chat livreur ↔ cuisinière ──────────────────────────

  @Get('orders/:orderId/messages')
  listOrderMessages(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ridersService.listOrderMessagesAsRider(orderId, user.id);
  }

  @Post('orders/:orderId/messages')
  @HttpCode(HttpStatus.CREATED)
  postOrderMessage(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendOrderMessageDto,
  ) {
    return this.ridersService.postOrderMessageAsRider(orderId, user.id, dto);
  }
}
