import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — WhatsLark',
  description: 'Privacy Policy for WhatsLark WhatsApp CRM platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-green-600 font-bold text-xl tracking-tight">WhatsLark</Link>
          <h1 className="text-3xl font-bold mt-6 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: June 9, 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <p>
              WhatsLark ("we", "our", or "us") operates a WhatsApp Business CRM platform accessible at{' '}
              <strong>whats-lark.vercel.app</strong>. This Privacy Policy explains how we collect, use, store,
              and protect information when you use our platform.
            </p>
            <p className="mt-3">
              By using WhatsLark, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <h3 className="font-medium text-gray-800 mb-2">1.1 Account Information</h3>
            <p>When you register for WhatsLark, we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Full name and email address</li>
              <li>Company name and business details</li>
              <li>Password (stored in encrypted form)</li>
            </ul>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">1.2 WhatsApp Business Credentials</h3>
            <p>To enable WhatsApp messaging, we collect and store:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>WhatsApp Phone Number ID</li>
              <li>WhatsApp Business Account ID (WABA ID)</li>
              <li>Meta API Access Token (stored encrypted)</li>
              <li>Webhook verification tokens</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              These credentials are provided by you and belong to your Meta Business account. We use them solely to send and receive WhatsApp messages on your behalf.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">1.3 Message and Contact Data</h3>
            <p>As part of operating the CRM, we process:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>WhatsApp messages sent and received through your connected number</li>
              <li>Contact names and phone numbers of people you communicate with</li>
              <li>Conversation history and message metadata</li>
              <li>Campaign data and message templates you create</li>
            </ul>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">1.4 Usage Data</h3>
            <p>We automatically collect certain technical information including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device and operating system information</li>
              <li>Feature usage and interaction data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, operate, and improve the WhatsLark platform</li>
              <li>Send and receive WhatsApp messages on your behalf using your Meta API credentials</li>
              <li>Process and store your contacts, conversations, and campaigns</li>
              <li>Authenticate your account and maintain security</li>
              <li>Send administrative emails (account updates, security alerts)</li>
              <li>Respond to your support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal data or your customers' data to third parties.
              We do <strong>not</strong> use your WhatsApp message content for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. WhatsApp and Meta Platform Data</h2>
            <p>
              WhatsLark integrates with the WhatsApp Business Platform via the Meta Cloud API. When you connect
              your WhatsApp Business number:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your API credentials are stored securely and used only to operate your account</li>
              <li>Incoming and outgoing messages are processed through Meta's infrastructure</li>
              <li>Message content is subject to <a href="https://www.whatsapp.com/legal/privacy-policy" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">WhatsApp's Privacy Policy</a></li>
              <li>You are responsible for obtaining appropriate consent from your contacts before messaging them</li>
            </ul>
            <p className="mt-3">
              We comply with the <a href="https://developers.facebook.com/terms/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a> and{' '}
              <a href="https://www.whatsapp.com/legal/business-data-processing-terms" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">WhatsApp Business Data Processing Terms</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored on <strong>Supabase</strong> infrastructure with the following protections:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Data encrypted at rest and in transit (TLS/SSL)</li>
              <li>Row-level security ensuring each company only accesses its own data</li>
              <li>API credentials stored with restricted access controls</li>
              <li>Regular security audits and access logging</li>
            </ul>
            <p className="mt-3">
              While we implement industry-standard security measures, no method of transmission over the Internet
              is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Sharing</h2>
            <p>We do not sell, trade, or share your personal information except:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Service providers:</strong> Supabase (database), Vercel (hosting), Meta (WhatsApp API) — only as needed to operate the service</li>
              <li><strong>Legal requirements:</strong> If required by law, court order, or governmental authority</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Message and contact data is
              retained to provide the CRM service. You may request deletion of your data at any time by
              contacting us.
            </p>
            <p className="mt-3">
              Upon account termination, your data will be deleted within 30 days, except where retention
              is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Access</strong> the personal data we hold about you</li>
              <li><strong>Correct</strong> inaccurate or incomplete data</li>
              <li><strong>Delete</strong> your account and associated data</li>
              <li><strong>Export</strong> your data in a portable format</li>
              <li><strong>Withdraw consent</strong> for data processing where consent is the legal basis</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <strong>hello@bytelark.net</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              WhatsLark uses essential cookies and local storage for authentication and session management.
              We do not use advertising or tracking cookies. You can disable cookies in your browser settings,
              but this may affect your ability to log in.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Children's Privacy</h2>
            <p>
              WhatsLark is a business platform not intended for children under 13. We do not knowingly collect
              personal information from children. If you believe a child has provided us with personal data,
              contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes
              by email or by posting a notice on the platform. Continued use of WhatsLark after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, contact us:</p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">WhatsLark / ByteLark</p>
              <p className="mt-1">Email: <a href="mailto:hello@bytelark.net" className="text-green-600 underline">hello@bytelark.net</a></p>
              <p>Website: <a href="https://whats-lark.vercel.app" className="text-green-600 underline">whats-lark.vercel.app</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t text-xs text-gray-400 flex justify-between">
          <span>© 2026 WhatsLark. All rights reserved.</span>
          <Link href="/" className="text-green-600 hover:underline">Back to WhatsLark</Link>
        </div>
      </div>
    </div>
  );
}
