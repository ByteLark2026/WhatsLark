# WhatsLark — WhatsApp CRM for Sales, Support & Automation

Multi-tenant WhatsApp CRM SaaS. Built with Next.js 15 + NestJS + Supabase.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your Supabase, WhatsApp, Redis, OpenAI values

# 3. Run database migrations
npm run db:migrate

# 4. Start dev servers (API :3001 + Web :3000)
npm run dev
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Realtime | Socket.IO |
| Queue | BullMQ + Redis |
| WhatsApp | Meta Cloud API |
| AI | OpenAI API |

## Deployment

- **Frontend** → Vercel (root: `apps/web`)
- **Backend** → Render (Docker, `apps/api/Dockerfile`)
- **Database** → Supabase
- **Redis** → Redis Cloud / Render Redis

## WhatsApp Webhook (local dev)

```bash
npx ngrok http 3001
# Copy the https URL
# Go to Meta App → WhatsApp → Configuration → Webhook URL
# Set: https://xxxx.ngrok-free.app/whatsapp/webhook
# Verify token: your WHATSAPP_WEBHOOK_VERIFY_TOKEN from .env
```

## Monorepo structure

```
whatslark/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Shared TypeScript types
└── supabase/
    └── migrations/   # Database schema
```
