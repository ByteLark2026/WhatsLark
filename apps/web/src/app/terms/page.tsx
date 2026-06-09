import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — WhatsLark',
  description: 'Terms of Service for WhatsLark WhatsApp CRM platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-green-600 font-bold text-xl tracking-tight">WhatsLark</Link>
          <h1 className="text-3xl font-bold mt-6 mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: June 9, 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <p>
              These Terms of Service ("Terms") govern your access to and use of WhatsLark ("Service"),
              operated by ByteLark ("we", "us", or "our"). By creating an account or using WhatsLark,
              you agree to be bound by these Terms.
            </p>
            <p className="mt-3">
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Description of Service</h2>
            <p>
              WhatsLark is a WhatsApp Business CRM platform that allows businesses to manage WhatsApp
              conversations, contacts, campaigns, and automations using their own Meta WhatsApp Business
              API credentials. WhatsLark acts as a software interface — it does not provide WhatsApp
              access itself. You must obtain your own WhatsApp Business API access through Meta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Account Registration</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old and have the legal authority to enter into these Terms.</li>
              <li>One account per person. You may not share accounts.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. WhatsApp Business API Usage</h2>
            <p>By connecting your WhatsApp Business API credentials to WhatsLark, you agree that:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>You have obtained valid WhatsApp Business API access from Meta and comply with Meta's Platform Terms.</li>
              <li>You are solely responsible for all messages sent through your connected WhatsApp number.</li>
              <li>You will not use WhatsLark to send spam, unsolicited messages, or violate WhatsApp's messaging policies.</li>
              <li>You have obtained proper consent from all recipients before messaging them.</li>
              <li>You will not use the Service for any illegal purpose or in violation of applicable law.</li>
              <li>WhatsLark is not responsible for Meta's decisions regarding your WhatsApp Business account, including suspension or termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Acceptable Use</h2>
            <p>You agree not to use WhatsLark to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Send spam, phishing messages, or deceptive communications</li>
              <li>Harass, abuse, or harm any person</li>
              <li>Violate any applicable local, national, or international law or regulation</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to compete with WhatsLark or build a similar product</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these rules without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Your Data</h2>
            <p>
              You retain ownership of all data you input into WhatsLark, including contacts, messages,
              and templates. By using the Service, you grant us a limited license to store and process
              your data solely to provide the Service.
            </p>
            <p className="mt-3">
              You are responsible for ensuring you have the right to store and process any personal data
              of your contacts in compliance with applicable privacy laws (including GDPR, PDPA, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Service Availability</h2>
            <p>
              We strive to maintain high availability of WhatsLark, but we do not guarantee uninterrupted
              or error-free service. We may perform maintenance, updates, or experience outages beyond
              our control. We are not liable for any loss arising from service unavailability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Payment and Billing</h2>
            <p>
              Certain features of WhatsLark may require a paid subscription. Pricing, billing cycles,
              and refund policies will be communicated at the time of purchase. Failure to pay may
              result in suspension of your account.
            </p>
            <p className="mt-3">
              WhatsLark fees are separate from any fees charged by Meta or your WhatsApp messaging provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>
              WhatsLark, its logo, and all platform content are the property of ByteLark. You may not
              copy, modify, or redistribute any part of the Service without our written permission.
            </p>
            <p className="mt-3">
              WhatsApp is a registered trademark of Meta Platforms, Inc. WhatsLark is not affiliated
              with, endorsed by, or sponsored by Meta or WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Disclaimer of Warranties</h2>
            <p>
              WhatsLark is provided "as is" and "as available" without warranties of any kind, either
              express or implied. We do not warrant that the Service will be uninterrupted, secure, or
              free from errors. We disclaim all implied warranties including merchantability, fitness
              for a particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, ByteLark shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the
              Service, including but not limited to loss of revenue, data, or business opportunities.
            </p>
            <p className="mt-3">
              Our total liability to you for any claims arising from these Terms shall not exceed the
              amount you paid to us in the three months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              You may cancel your account at any time by contacting us. We may suspend or terminate
              your account at any time for violation of these Terms or for any other reason at our
              sole discretion.
            </p>
            <p className="mt-3">
              Upon termination, your access to the Service will cease and your data will be deleted
              within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              by email or by posting a notice in the platform. Continued use of WhatsLark after
              changes take effect constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable law.
              Any disputes arising from these Terms shall be resolved through good-faith negotiation,
              followed by binding arbitration if necessary.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Contact Us</h2>
            <p>For questions about these Terms, contact us:</p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">WhatsLark / ByteLark</p>
              <p className="mt-1">Email: <a href="mailto:hello@bytelark.net" className="text-green-600 underline">hello@bytelark.net</a></p>
              <p>Website: <a href="https://whats-lark.vercel.app" className="text-green-600 underline">whats-lark.vercel.app</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t text-xs text-gray-400 flex justify-between">
          <span>© 2026 WhatsLark. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="text-green-600 hover:underline">Privacy Policy</Link>
            <Link href="/" className="text-green-600 hover:underline">Back to WhatsLark</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
