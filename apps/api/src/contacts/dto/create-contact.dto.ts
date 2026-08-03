import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^\+?[0-9\s\-()]+$/, { message: 'phone must contain only digits and phone formatting characters' })
  phone: string;

  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  avatar_url?: string;

  @IsOptional() @IsObject()
  custom_fields?: Record<string, any>;
}

export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(32)
  @Matches(/^\+?[0-9\s\-()]+$/, { message: 'phone must contain only digits and phone formatting characters' })
  phone?: string;

  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  avatar_url?: string;

  @IsOptional() @IsObject()
  custom_fields?: Record<string, any>;
}
