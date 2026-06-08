import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { parse } from 'csv-parse/sync';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  list(
    @CurrentCompanyId() companyId: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.list(companyId, { search, tag, page, limit });
  }

  @Get(':id')
  get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.get(companyId, id);
  }

  @Post()
  create(@CurrentCompanyId() companyId: string, @Body() dto: any) {
    return this.service.create(companyId, dto);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@CurrentCompanyId() companyId: string, @UploadedFile() file: Express.Multer.File) {
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true });
    return this.service.importCsv(companyId, rows);
  }

  @Get(':id/timeline')
  timeline(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.getTimeline(companyId, id);
  }

  @Post(':id/tags')
  addTag(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body('tag_id') tagId: string) {
    return this.service.addTag(companyId, id, tagId);
  }

  @Delete(':id/tags/:tagId')
  removeTag(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.service.removeTag(companyId, id, tagId);
  }

  @Post(':id/notes')
  addNote(
    @CurrentCompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.service.addNote(companyId, id, userId, content);
  }
}
