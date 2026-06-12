import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminContentService } from './super-admin-content.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@ApiTags('Super Admin Content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class SuperAdminContentController {
  constructor(private readonly service: SuperAdminContentService) {}

  // Notifications
  @Get('notifications') listNotifications(@Query() q: any) { return this.service.listNotifications(q); }
  @Post('notifications') createNotification(@Body() dto: any) { return this.service.createNotification(dto); }
  @Patch('notifications/:id') updateNotification(@Param('id') id: string, @Body() dto: any) { return this.service.updateNotification(id, dto); }
  @Delete('notifications/:id') deleteNotification(@Param('id') id: string) { return this.service.deleteNotification(id); }

  // Subscription Plans
  @Get('subscription-plans') listSubscriptionPlans() { return this.service.listSubscriptionPlans(); }
  @Post('subscription-plans') createSubscriptionPlan(@Body() dto: any) { return this.service.createSubscriptionPlan(dto); }
  @Patch('subscription-plans/:id') updateSubscriptionPlan(@Param('id') id: string, @Body() dto: any) { return this.service.updateSubscriptionPlan(id, dto); }
  @Delete('subscription-plans/:id') deleteSubscriptionPlan(@Param('id') id: string) { return this.service.deleteSubscriptionPlan(id); }

  // Subscriptions Data (read-only)
  @Get('subscriptions') listSubscriptions(@Query() q: any) { return this.service.listSubscriptions(q); }

  // Transactions
  @Get('transactions') listTransactions(@Query() q: any) { return this.service.listTransactions(q); }
  @Post('transactions') createTransaction(@Body() dto: any) { return this.service.createTransaction(dto); }
  @Patch('transactions/:id') updateTransaction(@Param('id') id: string, @Body() dto: any) { return this.service.updateTransaction(id, dto); }
  @Delete('transactions/:id') deleteTransaction(@Param('id') id: string) { return this.service.deleteTransaction(id); }

  // Support Tickets
  @Get('support-tickets') listSupportTickets(@Query() q: any) { return this.service.listSupportTickets(q); }
  @Get('support-tickets/:id') getSupportTicket(@Param('id') id: string) { return this.service.getSupportTicket(id); }
  @Patch('support-tickets/:id') updateSupportTicket(@Param('id') id: string, @Body() dto: any) { return this.service.updateSupportTicket(id, dto); }
  @Post('support-tickets/:id/replies') addSupportTicketReply(@Param('id') id: string, @Body() dto: any) { return this.service.addSupportTicketReply(id, dto); }
  @Delete('support-tickets/:id') deleteSupportTicket(@Param('id') id: string) { return this.service.deleteSupportTicket(id); }

  // App Versions
  @Get('app-versions') listAppVersions(@Query() q: any) { return this.service.listAppVersions(q); }
  @Post('app-versions') createAppVersion(@Body() dto: any) { return this.service.createAppVersion(dto); }
  @Patch('app-versions/:id') updateAppVersion(@Param('id') id: string, @Body() dto: any) { return this.service.updateAppVersion(id, dto); }
  @Delete('app-versions/:id') deleteAppVersion(@Param('id') id: string) { return this.service.deleteAppVersion(id); }

  // Payment Gateway Settings
  @Get('payment-gateway') listPaymentGatewaySettings() { return this.service.listPaymentGatewaySettings(); }
  @Patch('payment-gateway/:provider') upsertPaymentGatewaySettings(@Param('provider') provider: string, @Body() dto: any) { return this.service.upsertPaymentGatewaySettings(provider, dto); }
}
