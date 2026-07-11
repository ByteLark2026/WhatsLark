import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { SupabaseModule } from '../common/supabase.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [SupabaseModule, InvoicesModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
