import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class ChangePlanDto {
  @IsUUID()
  billing_price_id: string;

  /** true = apply at the end of the current billing cycle; false/omitted = immediately. */
  @IsOptional() @IsBoolean()
  at_cycle_end?: boolean;
}
