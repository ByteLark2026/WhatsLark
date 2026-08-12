import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AiPosterService } from './ai-poster.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('AI Poster')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('ai-poster')
export class AiPosterController {
  constructor(private readonly service: AiPosterService) {}

  @Post('generate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  generate(@CurrentCompanyId() companyId: string, @Body() dto: { prompt: string; provider?: 'openai' | 'gemini' }) {
    return this.service.generate(companyId, dto.prompt, dto.provider);
  }

  @Post('send')
  send(@CurrentCompanyId() companyId: string, @Body() dto: { contactId: string; channelId: string; imageUrl: string; caption?: string }) {
    return this.service.sendToContact(companyId, dto);
  }

  @Post('save-template')
  saveTemplate(@CurrentCompanyId() companyId: string, @Body() dto: { name: string; imageUrl: string; bodyText: string; language?: string }) {
    return this.service.saveAsTemplate(companyId, dto);
  }
}
