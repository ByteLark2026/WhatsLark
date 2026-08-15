import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';

@Module({
  imports: [SupabaseModule, QuotationsModule],
  controllers: [RfqController],
  providers: [RfqService],
})
export class RfqModule {}
