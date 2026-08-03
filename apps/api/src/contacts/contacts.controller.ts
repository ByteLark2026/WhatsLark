import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { CurrentUser, CurrentCompanyId } from '../common/decorators/current-user.decorator';
import { parse } from 'csv-parse/sync';
import { CreateContactDto, UpdateContactDto } from './dto/create-contact.dto';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard)
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
  create(@CurrentCompanyId() companyId: string, @Body() dto: CreateContactDto) {
    return this.service.create(companyId, dto);
  }

  @Put(':id')
  update(@CurrentCompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  delete(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.service.delete(companyId, id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } })) // 5MB cap
  async importCsv(@CurrentCompanyId() companyId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true });
    const MAX_ROWS = 5000;
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`CSV has ${rows.length} rows — max ${MAX_ROWS} per import. Split into smaller files.`);
    }
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
