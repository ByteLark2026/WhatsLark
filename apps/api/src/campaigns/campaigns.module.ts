import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignProcessor } from './campaign.processor';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'campaigns' }),
    WhatsAppModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignProcessor, CampaignSchedulerService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
