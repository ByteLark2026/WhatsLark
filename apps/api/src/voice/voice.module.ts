import { Module } from '@nestjs/common';
import { VoiceChannelsController } from './voice-channels.controller';
import { VoiceChannelsService } from './voice-channels.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  controllers: [VoiceChannelsController, CallsController],
  providers: [VoiceChannelsService, CallsService],
})
export class VoiceModule {}
