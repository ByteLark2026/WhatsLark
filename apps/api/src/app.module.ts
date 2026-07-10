import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { LeadsModule } from './leads/leads.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TemplatesModule } from './templates/templates.module';
import { AutomationsModule } from './automations/automations.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SupabaseModule } from './common/supabase.module';
import { EcommerceModule } from './ecommerce/ecommerce.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000,
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    }]),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),

    ScheduleModule.forRoot(),

    SupabaseModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    WhatsAppModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    LeadsModule,
    CampaignsModule,
    TemplatesModule,
    AutomationsModule,
    AiModule,
    DashboardModule,
    SuperAdminModule,
    SupportTicketsModule,
    RealtimeModule,
    EcommerceModule,
  ],
})
export class AppModule {}
