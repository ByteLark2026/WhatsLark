import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { CurrentCompanyId, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CallsService } from './calls.service';

function publicUrl(path: string): string {
  return `${process.env.API_HOST || ''}/api/v1${path}`;
}

@ApiTags('Voice Calls')
@Controller('voice')
export class CallsController {
  constructor(private readonly service: CallsService) {}

  // ── Agent-facing API ────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, CompanyGuard)
  @Post('token')
  async getToken(@CurrentCompanyId() companyId: string, @CurrentUser('id') userId: string) {
    const token = await this.service.generateAccessToken(companyId, userId);
    return { token };
  }

  @UseGuards(JwtAuthGuard, CompanyGuard)
  @Get('calls')
  listCalls(
    @CurrentCompanyId() companyId: string,
    @Query('contact_id') contactId?: string,
    @Query('lead_id') leadId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listCalls(companyId, { contact_id: contactId, lead_id: leadId, page, limit });
  }

  @UseGuards(JwtAuthGuard, CompanyGuard)
  @Patch('agents/availability')
  setAvailability(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Body('is_available') isAvailable: boolean,
  ) {
    return this.service.setAvailability(companyId, userId, isAvailable);
  }

  // ── Twilio webhooks (public, signature-verified) ───────────────────────
  private async verifyOrReject(req: Request, res: Response): Promise<boolean> {
    const authToken = await this.service.resolveAuthTokenForRequest(req.body);
    const signature = req.headers['x-twilio-signature'] as string | undefined;
    const url = publicUrl(req.path.replace(/^\/api\/v1/, ''));
    if (!authToken || !this.service.verifySignature(authToken, signature, url, req.body)) {
      res.status(403).send('Invalid signature');
      return false;
    }
    return true;
  }

  @Public()
  @Post('twiml/outbound')
  async outbound(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, To, agent_user_id, company_id, contact_id, lead_id } = req.body;
    const twiml = await this.service.outboundTwiml(company_id, agent_user_id, CallSid, To, contact_id, lead_id);
    res.set('Content-Type', 'text/xml').send(twiml);
  }

  @Public()
  @Post('twiml/inbound')
  async inbound(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, To, From } = req.body;
    const twiml = await this.service.inboundTwiml(To, From, CallSid);
    res.set('Content-Type', 'text/xml').send(twiml);
  }

  @Public()
  @Post('twiml/inbound-fallback')
  async inboundFallback(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, DialCallStatus } = req.body;
    const twiml = await this.service.inboundFallbackTwiml(CallSid, DialCallStatus);
    res.set('Content-Type', 'text/xml').send(twiml);
  }

  @Public()
  @Post('twiml/ai-agent/start')
  async aiAgentStart(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid } = req.body;
    const twiml = await this.service.aiAgentStartTwiml(CallSid);
    res.set('Content-Type', 'text/xml').send(twiml);
  }

  @Public()
  @Post('twiml/ai-agent/gather')
  async aiAgentGather(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, RecordingUrl } = req.body;
    const twiml = await this.service.aiAgentGatherTwiml(CallSid, RecordingUrl);
    res.set('Content-Type', 'text/xml').send(twiml);
  }

  @Public()
  @Post('twiml/status-callback')
  async statusCallback(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, CallStatus, CallDuration } = req.body;
    await this.service.handleStatusCallback(CallSid, CallStatus, CallDuration);
    res.status(200).send();
  }

  @Public()
  @Post('twiml/recording-callback')
  async recordingCallback(@Req() req: Request, @Res() res: Response) {
    if (!(await this.verifyOrReject(req, res))) return;
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;
    await this.service.handleRecordingCallback(CallSid, RecordingUrl, RecordingSid, RecordingDuration);
    res.status(200).send();
  }

  @Public()
  @Get('tts-audio/:id')
  getTtsAudio(@Param('id') id: string, @Res() res: Response) {
    const buffer = this.service.getCachedAudio(id);
    if (!buffer) return res.status(404).send();
    res.set('Content-Type', 'audio/mpeg').send(buffer);
  }
}
