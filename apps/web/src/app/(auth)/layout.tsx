import { MessageSquare } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0E1420] via-[#1a2a40] to-[#0E1420] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">WhatsLark</span>
        </div>
        <div>
          <blockquote className="text-2xl font-semibold text-white leading-relaxed mb-4">
            "Turn every WhatsApp conversation into a business opportunity."
          </blockquote>
          <p className="text-white/60">WhatsApp CRM for Sales, Support &amp; Automation</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Messages / day', value: '50K+' },
            { label: 'Active businesses', value: '2,000+' },
            { label: 'Countries', value: '40+' },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {children}
      </div>
      <Toaster />
    </div>
  );
}
