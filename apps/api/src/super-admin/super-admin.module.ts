import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminContentController } from './super-admin-content.controller';
import { SuperAdminContentService } from './super-admin-content.service';
import { PublicPlansController } from './public-plans.controller';

@Module({
  controllers: [SuperAdminController, SuperAdminContentController, PublicPlansController],
  providers: [SuperAdminService, SuperAdminContentService],
})
export class SuperAdminModule {}
