import { IsBoolean, Equals } from 'class-validator';

export class CancelSubscriptionDto {
  /** Explicit confirmation required — the endpoint refuses to act without confirm:true. */
  @IsBoolean() @Equals(true)
  confirm: boolean;
}
