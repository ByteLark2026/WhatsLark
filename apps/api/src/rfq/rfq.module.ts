import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { ErpModule } from '../integrations/erp/erp.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingRulesService } from './pricing-rules.service';
import { RfqFollowUpService } from './rfq-followup.service';

@Module({
  imports: [SupabaseModule, QuotationsModule, ErpModule],
  controllers: [RfqController, PricingRulesController],
  providers: [RfqService, PricingRulesService, RfqFollowUpService],
})
export class RfqModule {}
