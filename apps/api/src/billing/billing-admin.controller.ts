import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingRepository } from './billing.repository';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

/**
 * Super-admin CRUD for the Razorpay billing catalog (billing_plans /
 * billing_prices). Separate from the legacy /admin/subscription-plans
 * endpoints (super-admin-content.controller.ts), which manage the older,
 * unrelated `subscription_plans` table — that one is not wired to Razorpay
 * or /pricing at all.
 */
@ApiTags('Super Admin — Billing Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/billing')
export class BillingAdminController {
  constructor(private readonly repo: BillingRepository) {}

  @Get('plans')
  listPlans() {
    return this.repo.listAllPlansWithPrices();
  }

  @Post('plans')
  createPlan(@Body() dto: {
    code: string;
    name: string;
    description?: string;
    features: Record<string, any>;
    active?: boolean;
    display_order?: number;
  }) {
    return this.repo.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.repo.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.repo.deletePlan(id);
  }

  @Post('prices')
  createPrice(@Body() dto: {
    plan_id: string;
    provider?: string;
    provider_plan_id: string;
    billing_interval: string;
    currency?: string;
    amount_minor: number;
    active?: boolean;
  }) {
    return this.repo.createPrice(dto);
  }

  @Patch('prices/:id')
  updatePrice(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.repo.updatePrice(id, dto);
  }

  @Delete('prices/:id')
  deletePrice(@Param('id') id: string) {
    return this.repo.deletePrice(id);
  }
}
