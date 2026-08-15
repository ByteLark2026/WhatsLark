import { Controller, Post, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { RfqService } from './rfq.service';

/** Service-to-service only — called by the WhatsApp webhook process right after it
 *  detects+matches an RFQ, when every item cleared the company's configured
 *  auto-quote confidence threshold. No human triggers this request. */
@Controller('internal/rfq')
@UseGuards(InternalSecretGuard)
export class InternalRfqController {
  constructor(private readonly service: RfqService) {}

  @Post(':id/auto-quote')
  async autoQuote(@Param('id') id: string, @Body() dto: { company_id: string }) {
    if (!dto?.company_id) throw new BadRequestException('company_id is required');
    return this.service.generateQuote(dto.company_id, null, id);
  }
}
