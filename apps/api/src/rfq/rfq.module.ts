import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { ErpModule } from '../integrations/erp/erp.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingRulesService } from './pricing-rules.service';
import { RfqFollowUpService } from './rfq-followup.service';
import { ProductCatalogController } from './product-catalog.controller';
import { ProductCatalogService } from './product-catalog.service';
import { InternalRfqController } from './internal-rfq.controller';

@Module({
  imports: [SupabaseModule, QuotationsModule, ErpModule],
  // Order matters: Nest/Express matches routes in registration order, and RfqController's
  // GET /rfq/:id would otherwise swallow literal-path siblings like GET /rfq/products or
  // GET /rfq/pricing-rules (id='products'/'pricing-rules') if it registered first.
  controllers: [PricingRulesController, ProductCatalogController, InternalRfqController, RfqController],
  providers: [RfqService, PricingRulesService, RfqFollowUpService, ProductCatalogService],
  exports: [RfqService],
})
export class RfqModule {}
