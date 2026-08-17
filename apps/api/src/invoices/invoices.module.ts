import { Module, forwardRef } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SupabaseModule } from '../common/supabase.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => WhatsAppModule)],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
