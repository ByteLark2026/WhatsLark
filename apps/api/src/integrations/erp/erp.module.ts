import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase.module';
import { IntegrationConnectionsController } from './integration-connections.controller';
import { IntegrationConnectionsService } from './integration-connections.service';
import { ErpAdapterFactory } from './erp-adapter.factory';

@Module({
  imports: [SupabaseModule],
  controllers: [IntegrationConnectionsController],
  providers: [IntegrationConnectionsService, ErpAdapterFactory],
  exports: [ErpAdapterFactory],
})
export class ErpModule {}
