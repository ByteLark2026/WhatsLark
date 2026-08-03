import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, Ip, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FormsService } from './forms.service';
import { SupabaseService } from '../common/supabase.service';
import { resolveCompanyId } from '../common/company-cache.util';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly service: FormsService,
    private readonly supabase: SupabaseService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    return resolveCompanyId(this.supabase.getAdminClient(), userId);
  }

  // Public endpoints — no auth (MUST be before :id routes)
  @Get('public/:slug')
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  async publicForm(@Param('slug') slug: string) {
    return this.service.getPublicForm(slug);
  }

  @Post('public/:slug/submit')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  async submit(@Param('slug') slug: string, @Body() data: any, @Ip() ip: string) {
    return this.service.submitForm(slug, data, ip);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.listForms(companyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.createForm(companyId, req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async get(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.getForm(companyId, id);
  }

  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard)
  async submissions(@Request() req: any, @Param('id') id: string, @Query() q: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.getSubmissions(companyId, id, {
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 50,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.updateForm(companyId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Request() req: any, @Param('id') id: string) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.service.deleteForm(companyId, id);
  }
}
