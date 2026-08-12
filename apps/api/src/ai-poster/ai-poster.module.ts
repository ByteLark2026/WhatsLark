import { Module } from '@nestjs/common';
import { AiPosterController } from './ai-poster.controller';
import { AiPosterService } from './ai-poster.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [WhatsAppModule, TemplatesModule],
  controllers: [AiPosterController],
  providers: [AiPosterService],
})
export class AiPosterModule {}
