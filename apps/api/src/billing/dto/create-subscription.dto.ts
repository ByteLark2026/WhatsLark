import { IsUUID } from 'class-validator';

/** Frontend only ever sends a local price id — never a trusted amount or Razorpay plan_id. */
export class CreateSubscriptionDto {
  @IsUUID()
  billing_price_id: string;
}
