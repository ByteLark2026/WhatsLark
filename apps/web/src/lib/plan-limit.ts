export interface PlanLimitError extends Error {
  code?: string;
  feature?: string;
  current?: number;
  limit?: number;
  upgradeRequired?: boolean;
}

export function isPlanLimitError(err: unknown): err is PlanLimitError {
  return !!err && typeof err === 'object' && (err as any).code === 'PLAN_LIMIT_REACHED';
}

const FEATURE_LABEL: Record<string, string> = {
  whatsapp_channels: 'WhatsApp channels',
  team_members: 'team members',
  automations: 'active automations',
  contacts: 'contacts',
  ai_credits_monthly: 'AI credits',
  api_access: 'API access',
};

export function planLimitMessage(err: PlanLimitError): string {
  const label = FEATURE_LABEL[err.feature || ''] || err.feature || 'this feature';
  if (err.feature === 'api_access') return `API access isn't included on your current plan.`;
  return `You've reached your plan's limit for ${label} (${err.current}/${err.limit}). Upgrade to add more.`;
}
