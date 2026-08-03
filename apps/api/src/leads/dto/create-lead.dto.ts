import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const STAGES = ['new_lead', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost'];

export class CreateLeadDto {
  @IsUUID()
  contact_id: string;

  @IsString() @IsNotEmpty()
  title: string;

  @IsOptional() @IsIn(STAGES)
  stage?: string;

  @IsOptional() @IsNumber() @Min(0)
  deal_value?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsDateString()
  expected_close_date?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsUUID()
  assigned_to?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsString() @IsNotEmpty()
  title?: string;

  @IsOptional() @IsIn(STAGES)
  stage?: string;

  @IsOptional() @IsNumber() @Min(0)
  deal_value?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsDateString()
  expected_close_date?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsUUID()
  assigned_to?: string;
}
