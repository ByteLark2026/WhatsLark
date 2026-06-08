import { Controller, Post, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  logout(@Req() req: any) {
    return this.authService.logout(req.accessToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @ApiBearerAuth()
  resetPassword(@Req() req: any, @Body('password') password: string) {
    return this.authService.resetPassword(req.accessToken, password);
  }

  @Get('profile')
  @ApiBearerAuth()
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Put('profile')
  @ApiBearerAuth()
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: { full_name?: string; avatar_url?: string },
  ) {
    return this.authService.updateProfile(userId, body);
  }
}
