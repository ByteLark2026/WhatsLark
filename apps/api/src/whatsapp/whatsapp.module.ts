import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './webhook.controller';
import { WhatsAppWebhookService } from './webhook.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ContactsModule } from '../contacts/contacts.module';
import { BillingModule } from '../billing/billing.module';
import { RfqModule } from '../rfq/rfq.module';
import { ErpModule } from '../integrations/erp/erp.module';

@Module({
  imports: [HttpModule, ConversationsModule, ContactsModule, BillingModule, forwardRef(() => RfqModule), ErpModule],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppWebhookService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
