import { BillingRepository } from '../billing.repository';
import { SupabaseService } from '../../common/supabase.service';

/** Minimal fluent mock of the subset of the Supabase query builder this repo uses. */
function fakeSupabaseService(insertResult: { error: any }) {
  const insert = jest.fn().mockResolvedValue(insertResult);
  const from = jest.fn().mockReturnValue({ insert });
  const adminClient = { from };
  return {
    service: { getAdminClient: () => adminClient } as unknown as SupabaseService,
    insert,
  };
}

describe('BillingRepository — webhook idempotency', () => {
  it('returns true (newly recorded) on first delivery of an event id', async () => {
    const { service } = fakeSupabaseService({ error: null });
    const repo = new BillingRepository(service);

    const isNew = await repo.recordWebhookEventIfNew({
      provider: 'razorpay',
      provider_event_id: 'evt_123',
      event_type: 'subscription.activated',
      provider_created_at: null,
    });

    expect(isNew).toBe(true);
  });

  it('returns false (duplicate) when the unique constraint on (provider, provider_event_id) is violated', async () => {
    const { service } = fakeSupabaseService({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const repo = new BillingRepository(service);

    const isNew = await repo.recordWebhookEventIfNew({
      provider: 'razorpay',
      provider_event_id: 'evt_123', // same id delivered twice
      event_type: 'subscription.activated',
      provider_created_at: null,
    });

    expect(isNew).toBe(false);
  });

  it('surfaces a genuine database error instead of silently treating it as a duplicate', async () => {
    const { service } = fakeSupabaseService({ error: { code: '08006', message: 'connection failure' } });
    const repo = new BillingRepository(service);

    await expect(repo.recordWebhookEventIfNew({
      provider: 'razorpay',
      provider_event_id: 'evt_456',
      event_type: 'subscription.activated',
      provider_created_at: null,
    })).rejects.toThrow(/connection failure/);
  });
});
