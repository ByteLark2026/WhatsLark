import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingRulesService } from './pricing-rules.service';

@Module({
  imports: [SupabaseModule, QuotationsModule],
  controllers: [RfqController, PricingRulesController],
  providers: [RfqService, PricingRulesService],
})
export class RfqModule {}
