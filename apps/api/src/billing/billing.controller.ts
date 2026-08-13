import { Controller, Get, Post, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { VerifySubscriptionDto } from './dto/verify-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.billing.getPublicPlans();
  }

  @Get('subscription')
  getSubscription(@CurrentCompanyId() companyId: string) {
    this.requireCompany(companyId);
    return this.billing.getCompanySubscription(companyId);
  }

  @Get('payments')
  getPayments(
    @CurrentCompanyId() companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireCompany(companyId);
    return this.billing.getCompanyPayments(companyId, Number(page) || 1, Number(limit) || 20);
  }

  @Roles('owner', 'admin')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('subscriptions')
  async createSubscription(
    @CurrentUser('id') userId: string,
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    this.requireCompany(companyId);
    const result = await this.billing.createSubscription(userId, companyId, dto.billing_price_id);
    return {
      local_subscription_id: result.local_subscription_id,
      razorpay_subscription_id: result.razorpay_subscription_id,
      plan: result.plan,
      amount_minor: result.amount_minor,
      currency: result.currency,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID : null,
    };
  }

  @Roles('owner', 'admin')
  @Post('subscriptions/verify')
  verifySubscription(@CurrentCompanyId() companyId: string, @Body() dto: VerifySubscriptionDto) {
    this.requireCompany(companyId);
    return this.billing.verifyCheckout(companyId, {
      localSubscriptionId: dto.local_subscription_id,
      razorpayPaymentId: dto.razorpay_payment_id,
      razorpaySubscriptionId: dto.razorpay_subscription_id,
      razorpaySignature: dto.razorpay_signature,
    });
  }

  @Roles('owner', 'admin')
  @Post('subscriptions/change-plan')
  changePlan(@CurrentCompanyId() companyId: string, @Body() dto: ChangePlanDto) {
    this.requireCompany(companyId);
    return this.billing.changePlan(companyId, dto.billing_price_id, !!dto.at_cycle_end);
  }

  @Roles('owner', 'admin')
  @Post('subscriptions/cancel')
  cancelSubscription(@CurrentCompanyId() companyId: string, @Body() _dto: CancelSubscriptionDto) {
    this.requireCompany(companyId);
    return this.billing.cancelSubscription(companyId);
  }

  @Roles('owner', 'admin')
  @Post('subscriptions/resume')
  resumeSubscription(@CurrentCompanyId() companyId: string) {
    this.requireCompany(companyId);
    return this.billing.resumeSubscription(companyId);
  }

  private requireCompany(companyId: string | undefined): asserts companyId is string {
    if (!companyId) throw new ForbiddenException('No active company found for this user');
  }
}
