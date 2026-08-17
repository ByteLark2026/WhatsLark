import { Module, forwardRef } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { SupabaseModule } from '../common/supabase.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SupabaseModule, InvoicesModule, forwardRef(() => WhatsAppModule)],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationPdfService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
