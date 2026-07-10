import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { SupabaseModule } from '../common/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}
