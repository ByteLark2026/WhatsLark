import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyGuard } from '../common/guards/company.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentCompanyId } from '../common/decorators/current-user.decorator';

@ApiTags('Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyGuard, RolesGuard)
@Controller('team')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()    list(@CurrentCompanyId() c: string) { return this.service.listTeam(c); }

  @Roles('owner', 'admin')
  @Post('invite') invite(@CurrentCompanyId() c: string, @Body() dto: any) { return this.service.invite(c, dto); }

  @Roles('owner', 'admin')
  @Patch(':userId/role') role(@CurrentCompanyId() c: string, @Param('userId') uid: string, @Body('role') role: string) { return this.service.updateRole(c, uid, role); }

  @Roles('owner', 'admin')
  @Patch(':userId/deactivate') deactivate(@CurrentCompanyId() c: string, @Param('userId') uid: string) { return this.service.deactivate(c, uid); }
}
