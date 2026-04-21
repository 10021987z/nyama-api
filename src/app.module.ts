import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CooksModule } from './cooks/cooks.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { RidersModule } from './riders/riders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MarketingModule } from './marketing/marketing.module';
import { SupportModule } from './support/support.module';
import { DisputesModule } from './disputes/disputes.module';
import { PartnersModule } from './partners/partners.module';
import { PartnershipsModule } from './partnerships/partnerships.module';
import { EventsModule } from './events/events.module';
import { UploadsModule } from './uploads/uploads.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AdminLiveModule } from './admin-live/admin-live.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    EventsModule,
    AuthModule,
    UsersModule,
    CooksModule,
    MenuModule,
    OrdersModule,
    PaymentsModule,
    DeliveriesModule,
    RidersModule,
    ReviewsModule,
    NotificationsModule,
    AnalyticsModule,
    MarketingModule,
    SupportModule,
    DisputesModule,
    PartnersModule,
    PartnershipsModule,
    UploadsModule,
    OnboardingModule,
    AdminLiveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
