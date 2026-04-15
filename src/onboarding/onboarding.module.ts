import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingController,
  AdminOnboardingController,
} from './onboarding.controller';

@Module({
  providers: [OnboardingService],
  controllers: [OnboardingController, AdminOnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
