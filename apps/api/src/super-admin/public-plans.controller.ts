import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { SuperAdminContentService } from './super-admin-content.service';

/** Unauthenticated read of active subscription plans — for the public landing page / signup, not the admin panel. */
@ApiTags('Public')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('plans')
export class PublicPlansController {
  constructor(private readonly service: SuperAdminContentService) {}

  @Get()
  list() {
    return this.service.listActiveSubscriptionPlans();
  }
}
