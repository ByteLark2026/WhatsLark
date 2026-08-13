import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class VerifySubscriptionDto {
  /** Our local billing_subscriptions.id — used to look up the expected provider subscription id. Never trust razorpay_subscription_id from the browser as the source of truth. */
  @IsUUID()
  local_subscription_id: string;

  @IsString() @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString() @IsNotEmpty()
  razorpay_subscription_id: string;

  @IsString() @IsNotEmpty()
  razorpay_signature: string;
}
