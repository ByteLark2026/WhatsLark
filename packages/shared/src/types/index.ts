// ============================================================
// Shared TypeScript types used by both API and Web
// ============================================================

// ----- Enums -----

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
}

export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  CLOSED = 'closed',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  LOCATION = 'location',
  TEMPLATE = 'template',
  INTERACTIVE = 'interactive',
  NOTE = 'note',
}

export enum LeadStage {
  NEW_LEAD = 'new_lead',
  QUALIFIED = 'qualified',
  QUOTATION_SENT = 'quotation_sent',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  FAILED = 'failed',
}

export enum TemplateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

export enum AutomationTrigger {
  MESSAGE_RECEIVED = 'message_received',
  KEYWORD_MATCHED = 'keyword_matched',
  NEW_CONTACT = 'new_contact',
}

export enum AutomationAction {
  SEND_MESSAGE = 'send_message',
  ASSIGN_AGENT = 'assign_agent',
  ADD_TAG = 'add_tag',
  CREATE_LEAD = 'create_lead',
}

// ----- Super Admin: Notifications -----

export enum NotificationAudience {
  ALL = 'all',
  COMPANIES = 'companies',
  USERS = 'users',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// ----- Super Admin: Transactions -----

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum TransactionType {
  SUBSCRIPTION = 'subscription',
  ADDON = 'addon',
  REFUND = 'refund',
  MANUAL = 'manual',
}

// ----- Super Admin: Support Tickets -----

export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum SupportTicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ----- Super Admin: App Versions -----

export enum AppPlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

// ----- Base Entity -----

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// ----- Company / Workspace -----

export interface Company extends BaseEntity {
  name: string;
  slug: string;
  status: CompanyStatus;
  plan: SubscriptionPlan;
  logo_url?: string;
  timezone: string;
  country?: string;
  trial_ends_at?: string;
}

// ----- User -----

export interface User extends BaseEntity {
  email: string;
  full_name: string;
  avatar_url?: string;
  is_super_admin: boolean;
}

export interface CompanyUser extends BaseEntity {
  company_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  user?: User;
  company?: Company;
}

// ----- WhatsApp Channel -----

export interface WhatsAppChannel extends BaseEntity {
  company_id: string;
  name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id: string;
  webhook_verify_token: string;
  meta_app_id?: string;
  is_active: boolean;
  // access_token is never sent to frontend
}

// ----- Contact -----

export interface Contact extends BaseEntity {
  company_id: string;
  phone: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  tags?: string[];
  custom_fields?: Record<string, string>;
  is_blocked: boolean;
  last_seen_at?: string;
}

// ----- Conversation -----

export interface Conversation extends BaseEntity {
  company_id: string;
  contact_id: string;
  channel_id: string;
  assigned_to?: string;
  status: ConversationStatus;
  unread_count: number;
  last_message_at?: string;
  last_message_preview?: string;
  tags?: string[];
  contact?: Contact;
  assigned_agent?: User;
  channel?: WhatsAppChannel;
}

// ----- Message -----

export interface Message extends BaseEntity {
  conversation_id: string;
  company_id: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  media_url?: string;
  media_type?: string;
  status: MessageStatus;
  wa_message_id?: string;
  sender_id?: string;
  is_note: boolean;
  template_id?: string;
  metadata?: Record<string, unknown>;
}

// ----- Lead -----

export interface Lead extends BaseEntity {
  company_id: string;
  contact_id: string;
  conversation_id?: string;
  assigned_to?: string;
  stage: LeadStage;
  title: string;
  deal_value?: number;
  currency?: string;
  expected_close_date?: string;
  notes?: string;
  contact?: Contact;
  assigned_agent?: User;
}

// ----- Campaign -----

export interface Campaign extends BaseEntity {
  company_id: string;
  name: string;
  status: CampaignStatus;
  template_id: string;
  channel_id: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  replied_count: number;
  template?: MessageTemplate;
  channel?: WhatsAppChannel;
}

// ----- Message Template -----

export interface MessageTemplate extends BaseEntity {
  company_id: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  wa_template_id?: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CAROUSEL' | 'LIMITED_TIME_OFFER';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION';
  text?: string;
  buttons?: TemplateButton[];
  limited_time_offer?: {
    text: string;
    has_expiration?: boolean;
  };
  cards?: TemplateCarouselCard[];
}

export interface TemplateCarouselCard {
  components: TemplateComponent[];
  product_retailer_id?: string;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'CATALOG' | 'MPM' | 'SPM' | 'VOICE_CALL';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
  catalog_id?: string;
  product_retailer_id?: string;
  sections?: { title: string; product_retailer_ids: string[] }[];
}

// ----- Quick Reply -----

export interface QuickReply extends BaseEntity {
  company_id: string;
  shortcut: string;
  message: string;
  created_by: string;
}

// ----- Automation -----

export interface AutomationRule extends BaseEntity {
  company_id: string;
  name: string;
  is_active: boolean;
  trigger: AutomationTrigger;
  trigger_config: Record<string, unknown>;
  actions: AutomationActionConfig[];
}

export interface AutomationActionConfig {
  type: AutomationAction;
  config: Record<string, unknown>;
}

// ----- AI Settings -----

export interface AISettings extends BaseEntity {
  company_id: string;
  is_enabled: boolean;
  auto_reply: boolean;
  handover_keyword: string;
  system_prompt?: string;
  model: string;
}

// ----- Subscription -----

export interface Subscription extends BaseEntity {
  company_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
}

// ----- API Response Wrappers -----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ----- Dashboard Stats -----

export interface DashboardStats {
  total_contacts: number;
  open_conversations: number;
  messages_today: number;
  active_campaigns: number;
  leads_by_stage: Record<LeadStage, number>;
  agent_performance: AgentPerformance[];
}

export interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  open_conversations: number;
  closed_today: number;
  avg_response_time_minutes: number;
}

// ----- Super Admin: Subscription Plans -----

export interface SubscriptionPlanConfig extends BaseEntity {
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_users?: number;
  max_channels?: number;
  max_contacts?: number;
  max_messages_per_month?: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

// ----- Super Admin: Notifications -----

export interface AdminNotification extends BaseEntity {
  title: string;
  message: string;
  severity: NotificationSeverity;
  audience: NotificationAudience;
  target_company_ids?: string[];
  is_published: boolean;
  published_at?: string;
  created_by?: string;
}

// ----- Super Admin: Transactions -----

export interface Transaction extends BaseEntity {
  company_id: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  payment_method?: string;
  gateway_reference?: string;
  description?: string;
  created_by?: string;
  company?: Company;
}

// ----- Super Admin: Support Tickets -----

export interface SupportTicketReply {
  id: string;
  ticket_id: string;
  author_id?: string;
  is_internal_note: boolean;
  message: string;
  created_at: string;
  author?: User;
}

export interface SupportTicket extends BaseEntity {
  company_id?: string;
  user_id?: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigned_to?: string;
  company?: Company;
  user?: User;
  replies?: SupportTicketReply[];
}

// ----- Super Admin: App Versions -----

export interface AppVersion extends BaseEntity {
  platform: AppPlatform;
  version: string;
  build_number?: number;
  release_notes?: string;
  download_url?: string;
  is_force_update: boolean;
  is_published: boolean;
  released_at: string;
}

// ----- Super Admin: Payment Gateway Settings -----

export interface PaymentGatewaySettings extends BaseEntity {
  provider: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  public_key?: string;
  secret_key_masked?: string;
  webhook_secret_masked?: string;
  config: Record<string, unknown>;
}

// ----- Super Admin: Platform Stats & Analytics -----

export interface AdminPlatformStats {
  total_companies: number;
  active_companies: number;
  total_users: number;
  total_conversations: number;
  total_campaigns: number;
  total_channels: number;
  total_messages: number;
  plan_breakdown: Record<string, number>;
}

export interface PlatformAnalytics {
  messages: { created_at: string; status: string; direction: string }[];
  campaigns: {
    status: string;
    total_recipients: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    replied_count: number;
  }[];
  contact_count: number;
}
