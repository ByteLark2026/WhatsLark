import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nbmmfsqqkvzbtrjidhqm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibW1mc3Fxa3Z6YnRyamlkaHFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkxNTYxNiwiZXhwIjoyMDk2NDkxNjE2fQ.4YBuQN5ufgvbhS2VEea2uROUVN_jVsAZu467xAoozcU'
);

// Get all company IDs to seed for every tenant
const { data: companies } = await supabase.from('companies').select('id');
const companyIds = (companies || []).map(c => c.id);

if (companyIds.length === 0) {
  console.error('No companies found');
  process.exit(1);
}

console.log(`Seeding templates for ${companyIds.length} company(s): ${companyIds.join(', ')}`);

// ── Helper builders ──────────────────────────────────────────────────────────

const text = (body, footer = null, buttons = []) => {
  const c = [{ type: 'BODY', text: body }];
  if (footer) c.push({ type: 'FOOTER', text: footer });
  if (buttons.length) c.push({ type: 'BUTTONS', buttons });
  return c;
};

const image = (body, footer = null, buttons = []) => {
  const c = [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: body }];
  if (footer) c.push({ type: 'FOOTER', text: footer });
  if (buttons.length) c.push({ type: 'BUTTONS', buttons });
  return c;
};

const video = (body, footer = null, buttons = []) => {
  const c = [{ type: 'HEADER', format: 'VIDEO' }, { type: 'BODY', text: body }];
  if (footer) c.push({ type: 'FOOTER', text: footer });
  if (buttons.length) c.push({ type: 'BUTTONS', buttons });
  return c;
};

const doc = (body, footer = null, buttons = []) => {
  const c = [{ type: 'HEADER', format: 'DOCUMENT' }, { type: 'BODY', text: body }];
  if (footer) c.push({ type: 'FOOTER', text: footer });
  if (buttons.length) c.push({ type: 'BUTTONS', buttons });
  return c;
};

const carousel = (body, options = []) => {
  const buttons = options.map(o => ({ type: 'QUICK_REPLY', text: o }));
  return [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: body },
    { type: 'BUTTONS', buttons },
  ];
};

const urlBtn = (text, url) => ({ type: 'URL', text, url });
const phoneBtn = (text, phone) => ({ type: 'PHONE_NUMBER', text, phone_number: phone });
const replyBtn = (text) => ({ type: 'QUICK_REPLY', text });

// ── 100 Templates ────────────────────────────────────────────────────────────

const templates = [

  // ── SALES (25) ──────────────────────────────────────────────────────────────

  { name: 'sales_welcome_offer', category: 'MARKETING', type: 'text',
    components: text(
      "👋 Hi {{1}}! Welcome to {{2}}.\n\nAs a new customer, enjoy *15% OFF* your first order!\n\nUse code: *WELCOME15* at checkout.\n\nValid for 7 days only. Don't miss out! 🛍️",
      'Terms & conditions apply.',
      [urlBtn('Shop Now', 'https://shop.example.com'), replyBtn('Learn More')]
    )},

  { name: 'sales_flash_sale_image', category: 'MARKETING', type: 'image',
    components: image(
      "🔥 *FLASH SALE ALERT!* 🔥\n\nHi {{1}}, our biggest sale of the year is LIVE!\n\n✅ Up to *70% OFF* selected items\n✅ Free shipping on orders above $50\n✅ Ends in 24 hours!\n\nHurry — limited stocks available.",
      'Sale ends midnight tonight.',
      [urlBtn('Shop the Sale', 'https://shop.example.com/sale')]
    )},

  { name: 'sales_product_demo_video', category: 'MARKETING', type: 'video',
    components: video(
      "🎬 Hi {{1}}, see *{{2}}* in action!\n\nWatch this short demo to discover how {{2}} can transform your {{3}}.\n\n✨ Real results, real customers.\n\nReady to try it yourself?",
      'Free trial available — no credit card required.',
      [urlBtn('Start Free Trial', 'https://example.com/trial'), replyBtn('Book a Demo')]
    )},

  { name: 'sales_quote_followup', category: 'MARKETING', type: 'text',
    components: text(
      "Hi {{1}}, 👋\n\nJust following up on the quote we sent you on *{{2}}*.\n\nYour quote for *{{3}}* is still valid until {{4}}.\n\nAny questions? We're happy to help!",
      null,
      [replyBtn('Yes, I\'m Interested'), replyBtn('Need More Time'), replyBtn('Not Interested')]
    )},

  { name: 'sales_abandoned_cart', category: 'MARKETING', type: 'image',
    components: image(
      "🛒 Hi {{1}}, you left something behind!\n\nYour cart is waiting:\n• {{2}} × {{3}}\n• {{4}} × {{5}}\n\nTotal: *${{6}}*\n\nComplete your purchase before items sell out!",
      'Your cart is saved for 48 hours.',
      [urlBtn('Complete Purchase', 'https://shop.example.com/cart'), replyBtn('View Cart')]
    )},

  { name: 'sales_upsell_upgrade', category: 'MARKETING', type: 'text',
    components: text(
      "Hi {{1}}! 🚀\n\nYou're currently on our *{{2}} Plan*. Upgrade to *{{3}} Plan* and unlock:\n\n✅ {{4}}\n✅ {{5}}\n✅ {{6}}\n\nUpgrade now and save *20%* for the first 3 months!",
      null,
      [urlBtn('Upgrade Now', 'https://example.com/upgrade'), replyBtn('Tell Me More')]
    )},

  { name: 'sales_seasonal_promo_image', category: 'MARKETING', type: 'image',
    components: image(
      "🌟 *{{1}} SPECIAL SALE* 🌟\n\nHello {{2}}!\n\nCelebrate {{1}} with exclusive deals:\n🎁 Buy 2 Get 1 FREE\n🎁 Extra 10% with code *{{3}}*\n🎁 Gift wrapping available\n\nShop now before stocks run out!",
      'Offer valid while stocks last.',
      [urlBtn('Shop Now', 'https://shop.example.com'), replyBtn('View Catalogue')]
    )},

  { name: 'sales_referral_program', category: 'MARKETING', type: 'text',
    components: text(
      "💰 Hi {{1}}, earn money by referring friends!\n\nJoin our *Referral Program*:\n\n👉 Share your link: {{2}}\n💵 You earn: *${{3}}* per referral\n🎉 Your friend gets: *${{4}}* discount\n\nNo limit on earnings!",
      'Referral credits expire after 90 days.',
      [urlBtn('Get My Link', 'https://example.com/refer'), replyBtn('How It Works')]
    )},

  { name: 'sales_limited_stock_alert', category: 'MARKETING', type: 'image',
    components: image(
      "⚠️ *LOW STOCK ALERT* — {{1}}\n\nHi {{2}}, the item in your wishlist is almost gone!\n\n📦 Only *{{3}} left* in stock\n💰 Price: *${{4}}*\n\nOrder now to avoid disappointment.",
      null,
      [urlBtn('Buy Now', 'https://shop.example.com/product'), replyBtn('Add to Cart')]
    )},

  { name: 'sales_loyalty_reward', category: 'MARKETING', type: 'text',
    components: text(
      "🏆 Congratulations {{1}}!\n\nYou've earned *{{2}} loyalty points* — enough to redeem for:\n\n🎁 ${{3}} store credit\n🎁 Free shipping voucher\n🎁 Exclusive member gift\n\nRedeem before *{{4}}*.",
      'Points expire in 6 months.',
      [urlBtn('Redeem Points', 'https://example.com/rewards'), replyBtn('Check Balance')]
    )},

  { name: 'sales_product_launch', category: 'MARKETING', type: 'video',
    components: video(
      "🚀 *NEW LAUNCH: {{1}}*\n\nHi {{2}}, we've been working on something special just for you!\n\nIntroducing *{{1}}* — {{3}}\n\n🔥 Launch price: *${{4}}* (Regular: ${{5}})\n⏰ Offer ends {{6}}",
      'Limited launch pricing. Get it before it\'s gone!',
      [urlBtn('Get It Now', 'https://shop.example.com/new'), replyBtn('Remind Me Later')]
    )},

  { name: 'sales_winback_inactive', category: 'MARKETING', type: 'text',
    components: text(
      "💔 Hi {{1}}, we miss you!\n\nIt's been a while since your last order. Here's a special *COME BACK* offer just for you:\n\n🎁 *${{2}} OFF* your next order\n✅ Free shipping included\n🗓️ Valid until: {{3}}\n\nWe'd love to have you back!",
      null,
      [urlBtn('Claim Offer', 'https://shop.example.com/winback'), replyBtn('Not Interested')]
    )},

  { name: 'sales_bundle_deal', category: 'MARKETING', type: 'image',
    components: image(
      "🎯 *BUNDLE & SAVE — {{1}}*\n\nHi {{2}}! Get more, spend less:\n\n📦 Bundle includes:\n• {{3}}\n• {{4}}\n• {{5}}\n\nBundle price: *${{6}}* (Save ${{7}}!)\n\nPerfect for {{8}}.",
      'Bundle deal available while stocks last.',
      [urlBtn('Get Bundle', 'https://shop.example.com/bundles')]
    )},

  { name: 'sales_invoice_payment', category: 'UTILITY', type: 'doc',
    components: doc(
      "📄 *Invoice Ready — {{1}}*\n\nHi {{2}},\n\nYour invoice *#{{3}}* for *${{4}}* is attached.\n\nDue date: *{{5}}*\n\nPayment methods:\n💳 Credit/Debit Card\n🏦 Bank Transfer\n📱 Online Banking",
      'Please keep this invoice for your records.',
      [urlBtn('Pay Now', 'https://example.com/pay'), replyBtn('Need Help')]
    )},

  { name: 'sales_contract_doc', category: 'UTILITY', type: 'doc',
    components: doc(
      "📝 Hi {{1}},\n\nYour *{{2}} Agreement* is ready for review and signature.\n\nPlease review the attached document and sign digitally.\n\n⏰ Signature required by: *{{3}}*\n\nAny questions? Reply to this message.",
      null,
      [urlBtn('Sign Document', 'https://example.com/sign'), replyBtn('Have Questions')]
    )},

  { name: 'sales_meeting_schedule', category: 'UTILITY', type: 'text',
    components: text(
      "📅 *Meeting Confirmed — {{1}}*\n\nHi {{2}}!\n\nYour meeting with *{{3}}* is confirmed:\n\n📅 Date: {{4}}\n🕐 Time: {{5}}\n📍 Location: {{6}}\n🔗 Meeting link: {{7}}\n\nWe look forward to speaking with you!",
      null,
      [replyBtn('Add to Calendar'), replyBtn('Reschedule'), replyBtn('Cancel')]
    )},

  { name: 'sales_price_drop_alert', category: 'MARKETING', type: 'image',
    components: image(
      "📉 *PRICE DROP!* The item you wanted just got cheaper!\n\nHi {{1}},\n\n{{2}} is now *${{3}}* (was ${{4}}) — that's {{5}}% OFF!\n\n🔥 This price won't last long.",
      null,
      [urlBtn('Buy Now', 'https://shop.example.com'), replyBtn('See Details')]
    )},

  { name: 'sales_subscription_renewal', category: 'UTILITY', type: 'text',
    components: text(
      "🔄 *Subscription Renewal Notice*\n\nHi {{1}},\n\nYour *{{2}} subscription* renews on *{{3}}*.\n\nPlan: {{4}}\nAmount: *${{5}}/month*\n\nRenew early and get 1 month FREE!",
      'Cancel anytime before renewal date.',
      [urlBtn('Renew Now', 'https://example.com/renew'), replyBtn('Change Plan'), replyBtn('Cancel')]
    )},

  { name: 'sales_customer_review_request', category: 'UTILITY', type: 'text',
    components: text(
      "⭐ Hi {{1}}, how was your experience?\n\nYou recently purchased *{{2}}* from us. We'd love to hear your feedback!\n\nYour review helps other customers and improves our service.\n\n🙏 Takes just 30 seconds!",
      null,
      [urlBtn('Leave Review', 'https://example.com/review'), replyBtn('Not Now')]
    )},

  { name: 'sales_cross_sell', category: 'MARKETING', type: 'image',
    components: image(
      "💡 *Customers who bought {{1}} also loved...*\n\nHi {{2}}!\n\nBased on your recent purchase, we think you'll love:\n\n🛍️ {{3}} — *${{4}}*\n🛍️ {{5}} — *${{6}}*\n\nComplete the set!",
      null,
      [urlBtn('Shop Now', 'https://shop.example.com'), replyBtn('Not Interested')]
    )},

  { name: 'sales_early_bird_video', category: 'MARKETING', type: 'video',
    components: video(
      "🐦 *EARLY BIRD OFFER — {{1}}*\n\nHi {{2}}! Watch how {{1}} works before everyone else!\n\nEarly bird price: *${{3}}* (Regular: ${{4}})\n🗓️ Offer expires: {{5}}\n\nBe among the first {{6}} customers!",
      'Early bird pricing is strictly limited.',
      [urlBtn('Claim Early Bird', 'https://example.com/early'), replyBtn('Share With Friends')]
    )},

  { name: 'sales_free_trial_offer', category: 'MARKETING', type: 'text',
    components: text(
      "🎯 Hi {{1}},\n\nStart your *FREE {{2}}-day trial* of {{3}} today — no credit card required!\n\n✅ Full access to all features\n✅ Dedicated support\n✅ Cancel anytime\n\nJoin {{4}}+ happy users!",
      null,
      [urlBtn('Start Free Trial', 'https://example.com/trial')]
    )},

  { name: 'sales_vip_exclusive', category: 'MARKETING', type: 'image',
    components: image(
      "👑 *VIP EXCLUSIVE — For Your Eyes Only*\n\nDear {{1}},\n\nAs one of our VIP customers, you get:\n\n🌟 First access to {{2}}\n💰 Extra {{3}}% VIP discount\n🎁 Complimentary gift with purchase\n\nThis offer is ONLY for you.",
      'VIP offer not available to the general public.',
      [urlBtn('Access VIP Sale', 'https://shop.example.com/vip')]
    )},

  { name: 'sales_cart_discount_reminder', category: 'MARKETING', type: 'text',
    components: text(
      "⏰ *Last chance, {{1}}!*\n\nYour cart discount expires in *2 hours*!\n\nYou have *{{2}}% OFF* waiting on your cart worth *${{3}}*.\n\nDon't let this deal expire!",
      null,
      [urlBtn('Use Discount Now', 'https://shop.example.com/cart')]
    )},

  { name: 'sales_post_purchase_upsell', category: 'MARKETING', type: 'image',
    components: image(
      "🎉 *Thank you for your order, {{1}}!*\n\nOrder #{{2}} is confirmed. While we prepare your order, here's a one-time offer:\n\nAdd *{{3}}* for just *${{4}}* (50% off regular price)!\n\n⚡ This offer expires in 1 hour.",
      null,
      [urlBtn('Add to Order', 'https://shop.example.com/add'), replyBtn('No Thanks')]
    )},

  // ── ECOMMERCE (25) ──────────────────────────────────────────────────────────

  { name: 'ecom_order_confirmed', category: 'UTILITY', type: 'text',
    components: text(
      "✅ *Order Confirmed!*\n\nHi {{1}}, your order has been placed successfully!\n\n🛍️ Order #: *{{2}}*\n📦 Items: {{3}}\n💰 Total: *${{4}}*\n🚚 Est. delivery: {{5}}\n\nThank you for shopping with us!",
      'Keep this message as your order confirmation.',
      [urlBtn('Track Order', 'https://shop.example.com/track'), replyBtn('View Order Details')]
    )},

  { name: 'ecom_order_shipped_image', category: 'UTILITY', type: 'image',
    components: image(
      "📦 *Your Order is On Its Way!*\n\nHi {{1}}! Great news — your order #{{2}} has been shipped!\n\n🚚 Courier: {{3}}\n🔢 Tracking #: *{{4}}*\n📅 Est. arrival: {{5}}\n\nTrack your package in real-time!",
      'Please ensure someone is available to receive the package.',
      [urlBtn('Track Package', 'https://track.example.com/{{4}}')]
    )},

  { name: 'ecom_delivery_confirmed', category: 'UTILITY', type: 'text',
    components: text(
      "🎉 *Package Delivered!*\n\nHi {{1}},\n\nYour order #{{2}} has been delivered!\n\n📍 Delivered to: {{3}}\n🕐 Time: {{4}}\n\nWe hope you love your purchase! Rate your experience:",
      null,
      [replyBtn('⭐⭐⭐⭐⭐ Excellent'), replyBtn('⭐⭐⭐ Good'), replyBtn('😞 Had Issues')]
    )},

  { name: 'ecom_return_request', category: 'UTILITY', type: 'doc',
    components: doc(
      "🔄 *Return Request Initiated — #{{1}}*\n\nHi {{2}},\n\nYour return for order #{{3}} has been approved.\n\nReturn details are in the attached document.\n\n📦 Drop off by: {{4}}\n💰 Refund amount: *${{5}}*",
      'Refund processed within 5-7 business days.',
      [urlBtn('View Return Status', 'https://shop.example.com/returns')]
    )},

  { name: 'ecom_payment_success', category: 'UTILITY', type: 'text',
    components: text(
      "💳 *Payment Successful!*\n\nHi {{1}},\n\nWe've received your payment of *${{2}}*.\n\n📄 Transaction ID: {{3}}\n🗓️ Date: {{4}}\n💰 Method: {{5}}\n\nYour receipt has been emailed to {{6}}.",
      null,
      [urlBtn('Download Receipt', 'https://shop.example.com/receipt')]
    )},

  { name: 'ecom_product_back_in_stock', category: 'MARKETING', type: 'image',
    components: image(
      "🎊 *BACK IN STOCK!*\n\nHi {{1}}, great news!\n\n*{{2}}* is back in stock — and selling fast!\n\n⚡ Size/Color: {{3}}\n💰 Price: *${{4}}*\n📦 Only {{5}} units available\n\nGrab yours before it's gone again!",
      null,
      [urlBtn('Buy Now', 'https://shop.example.com/product'), replyBtn('Add to Wishlist')]
    )},

  { name: 'ecom_new_arrivals_carousel', category: 'MARKETING', type: 'carousel',
    components: carousel(
      "🆕 *NEW ARRIVALS THIS WEEK!*\n\nHi {{1}}! Fresh styles just landed. Which are you loving?\n\n🛍️ {{2}} — ${{3}}\n🛍️ {{4}} — ${{5}}\n🛍️ {{6}} — ${{7}}\n🛍️ {{8}} — ${{9}}\n\nTap below to explore each one:",
      ['{{2}}', '{{4}}', '{{6}}', '{{8}}']
    )},

  { name: 'ecom_wishlist_sale', category: 'MARKETING', type: 'image',
    components: image(
      "💝 *Your Wishlist is on Sale!*\n\nHi {{1}}, items you saved are now discounted!\n\n❤️ {{2}} — ~~${{3}}~~ *${{4}}*\n❤️ {{5}} — ~~${{6}}~~ *${{7}}*\n\nThese prices won't last long!",
      null,
      [urlBtn('Shop Wishlist', 'https://shop.example.com/wishlist')]
    )},

  { name: 'ecom_subscription_box', category: 'MARKETING', type: 'video',
    components: video(
      "📦 *{{1}} SUBSCRIPTION BOX — {{2}} Edition*\n\nHi {{3}}! Here's a sneak peek of what's inside your *{{2}} box*!\n\n🎁 Value: *${{4}}* worth of products\n💰 Your price: *${{5}}/month*\n\nLike what you see?",
      null,
      [replyBtn('Yes! Send Mine'), replyBtn('Change Preferences'), replyBtn('Pause Box')]
    )},

  { name: 'ecom_size_guide', category: 'UTILITY', type: 'doc',
    components: doc(
      "📏 *Size Guide — {{1}}*\n\nHi {{2}},\n\nNot sure about sizing? We've attached our complete size guide for *{{1}}*.\n\nFor the best fit:\n• Measure your chest, waist, and hips\n• Compare with the chart\n• When in doubt, size up!",
      'Free exchanges available within 30 days.',
      [urlBtn('Shop {{1}}', 'https://shop.example.com'), replyBtn('Contact Stylist')]
    )},

  { name: 'ecom_bulk_order_offer', category: 'MARKETING', type: 'text',
    components: text(
      "🏭 *Bulk Order Discounts Available!*\n\nHi {{1}},\n\nOrdering for your business? We offer:\n\n📦 50+ units: *10% OFF*\n📦 100+ units: *18% OFF*\n📦 500+ units: *25% OFF*\n\nCustom branding available!",
      null,
      [replyBtn('Get Bulk Quote'), urlBtn('View B2B Catalogue', 'https://example.com/b2b')]
    )},

  { name: 'ecom_gift_card', category: 'MARKETING', type: 'image',
    components: image(
      "🎁 *Gift Card Delivered!*\n\nHi {{1}},\n\nYour *${{2}} Gift Card* for {{3}} is ready!\n\n🔑 Code: *{{4}}*\n📅 Valid until: {{5}}\n\nThe perfect gift for any occasion!",
      'Gift card cannot be exchanged for cash.',
      [urlBtn('Use Gift Card', 'https://shop.example.com/giftcard'), replyBtn('Send to Friend')]
    )},

  { name: 'ecom_product_review_image', category: 'MARKETING', type: 'image',
    components: image(
      "⭐ *Real Customer Review*\n\n\"{{1}}\"\n— {{2}}, Verified Buyer\n\nJoin {{3}}+ happy customers who love *{{4}}*!\n\n💰 Today's price: *${{5}}*",
      null,
      [urlBtn('Buy {{4}}', 'https://shop.example.com'), replyBtn('See More Reviews')]
    )},

  { name: 'ecom_digital_product_delivery', category: 'UTILITY', type: 'doc',
    components: doc(
      "⬇️ *Your Digital Product is Ready!*\n\nHi {{1}},\n\nThank you for purchasing *{{2}}*!\n\nYour download is attached. Please save it safely.\n\n🔑 License Key: *{{3}}*\n📅 License valid until: {{4}}",
      'Do not share your license key with others.',
      [urlBtn('Access Download Portal', 'https://example.com/downloads')]
    )},

  { name: 'ecom_pre_order_open', category: 'MARKETING', type: 'image',
    components: image(
      "⏰ *PRE-ORDER NOW OPEN — {{1}}*\n\nHi {{2}}!\n\nBe the FIRST to get *{{1}}* before official launch!\n\n🗓️ Expected ship date: {{3}}\n💰 Pre-order price: *${{4}}* (Launch: ${{5}})\n\n{{6}} pre-orders placed already!",
      'Pre-order price guaranteed regardless of future price changes.',
      [urlBtn('Pre-Order Now', 'https://shop.example.com/preorder')]
    )},

  { name: 'ecom_membership_benefit', category: 'MARKETING', type: 'text',
    components: text(
      "💎 *{{1}} Member Perks*\n\nHi {{2}}, here are your exclusive {{1}} benefits this month:\n\n✅ Free shipping on all orders\n✅ {{3}}% members-only discount\n✅ Early access to new arrivals\n✅ Free gift on orders above ${{4}}",
      'Benefits refresh on the 1st of each month.',
      [urlBtn('Shop with Benefits', 'https://shop.example.com'), replyBtn('Upgrade Membership')]
    )},

  { name: 'ecom_payment_failed', category: 'UTILITY', type: 'text',
    components: text(
      "⚠️ *Payment Failed — Action Required*\n\nHi {{1}},\n\nYour payment of *${{2}}* for order #{{3}} was unsuccessful.\n\nReason: {{4}}\n\nPlease update your payment details to complete your order before *{{5}}*.",
      'Order will be cancelled if not resolved within 48 hours.',
      [urlBtn('Retry Payment', 'https://shop.example.com/pay'), replyBtn('Need Help')]
    )},

  { name: 'ecom_compare_products', category: 'MARKETING', type: 'carousel',
    components: carousel(
      "🆚 *Which one is right for you?*\n\nHi {{1}}! Compare our top picks:\n\n📊 {{2}} vs {{3}} vs {{4}}\n\nEach has unique benefits depending on your needs. Tap to learn more about each:",
      ['{{2}} Details', '{{3}} Details', '{{4}} Details']
    )},

  { name: 'ecom_referral_bonus', category: 'MARKETING', type: 'text',
    components: text(
      "🎉 *You earned a Referral Bonus!*\n\nHi {{1}},\n\n{{2}} just made their first purchase using your referral link!\n\n💰 Your bonus: *${{3}}* store credit\n💰 Their discount: *${{4}}*\n\nYour total credit balance: *${{5}}*",
      null,
      [urlBtn('Use Store Credit', 'https://shop.example.com'), replyBtn('Share More Links')]
    )},

  { name: 'ecom_free_shipping_threshold', category: 'MARKETING', type: 'text',
    components: text(
      "🚚 *You're ${{1}} away from FREE SHIPPING!*\n\nHi {{2}},\n\nAdd just *${{1}} more* to your cart to unlock free shipping!\n\nYour cart: *${{3}}*\nFree shipping at: *${{4}}*\n\nTop picks to get you there:",
      null,
      [urlBtn('Add More Items', 'https://shop.example.com'), replyBtn('Check Cart')]
    )},

  { name: 'ecom_order_delay_notice', category: 'UTILITY', type: 'text',
    components: text(
      "😔 *Order Delay Notice — #{{1}}*\n\nHi {{2}},\n\nWe sincerely apologize — your order #{{1}} has been slightly delayed.\n\nNew expected delivery: *{{3}}*\nReason: {{4}}\n\nAs a token of apology, enjoy *${{5}} credit* on your next order.",
      null,
      [urlBtn('Track Order', 'https://shop.example.com/track'), replyBtn('Contact Support')]
    )},

  { name: 'ecom_product_warranty', category: 'UTILITY', type: 'doc',
    components: doc(
      "🛡️ *Warranty Certificate — {{1}}*\n\nHi {{2}},\n\nYour *{{3}}* warranty is now active.\n\n✅ Warranty period: *{{4}} months*\n✅ Coverage: {{5}}\n📋 Claim via: {{6}}\n\nYour certificate is attached.",
      'Warranty void if product is modified or misused.',
      [urlBtn('Register Warranty', 'https://example.com/warranty')]
    )},

  { name: 'ecom_review_video_social', category: 'MARKETING', type: 'video',
    components: video(
      "🎥 *See What {{1}} Customers Are Saying!*\n\nHi {{2}},\n\nDon't just take our word for it — watch what real customers think about *{{3}}*!\n\n⭐ Rated {{4}}/5 by {{5}}+ customers\n\nWill you be next?",
      null,
      [urlBtn('Buy {{3}}', 'https://shop.example.com'), replyBtn('Read Written Reviews')]
    )},

  { name: 'ecom_loyalty_tier_upgrade', category: 'MARKETING', type: 'image',
    components: image(
      "🥇 *You've been upgraded to {{1}} Tier!*\n\nCongratulations {{2}}!\n\nYou've spent *${{3}}* with us this year. Welcome to *{{1}}* status!\n\n🎁 New benefits:\n✅ {{4}}\n✅ {{5}}\n✅ {{6}}",
      'Benefits active immediately.',
      [urlBtn('Explore Benefits', 'https://shop.example.com/loyalty')]
    )},

  { name: 'ecom_birthday_offer', category: 'MARKETING', type: 'image',
    components: image(
      "🎂 *Happy Birthday, {{1}}!* 🎉\n\nWishing you an amazing day! As our gift to you:\n\n🎁 *{{2}}% OFF* your entire order today\n🎁 Free birthday gift with orders above ${{3}}\n🎁 Double loyalty points\n\nCode: *BDAY{{4}}*",
      'Birthday offer valid on your birthday only.',
      [urlBtn('Claim Birthday Gift', 'https://shop.example.com/birthday')]
    )},

  // ── PROMOTION (25) ──────────────────────────────────────────────────────────

  { name: 'promo_weekend_sale', category: 'MARKETING', type: 'image',
    components: image(
      "🎊 *WEEKEND MEGA SALE!*\n\nHi {{1}}!\n\n🔥 This weekend ONLY:\n• {{2}}% OFF everything\n• Free shipping on all orders\n• Extra gifts on orders above ${{3}}\n\n⏰ Ends Sunday midnight!",
      'Cannot be combined with other offers.',
      [urlBtn('Shop the Sale', 'https://shop.example.com/sale')]
    )},

  { name: 'promo_double_points_event', category: 'MARKETING', type: 'text',
    components: text(
      "⚡ *DOUBLE POINTS EVENT*\n\nHi {{1}},\n\nEarn *2x loyalty points* on ALL purchases this week!\n\n📅 From: {{2}}\n📅 To: {{3}}\n\nYou currently have *{{4}} points* — double them now!",
      'Bonus points credited within 48 hours of purchase.',
      [urlBtn('Shop & Earn Double', 'https://shop.example.com'), replyBtn('Check My Points')]
    )},

  { name: 'promo_buy_get_free_image', category: 'MARKETING', type: 'image',
    components: image(
      "🛍️ *BUY {{1}} GET {{2}} FREE!*\n\nHi {{3}}!\n\nThis week's hottest deal:\n\n✅ Buy any {{4}}\n✅ Get {{5}} absolutely FREE!\n✅ Mix & match allowed\n\n📦 Applies to {{6}} products.",
      'Free item of equal or lesser value.',
      [urlBtn('Shop Now', 'https://shop.example.com/bogo')]
    )},

  { name: 'promo_app_download_offer', category: 'MARKETING', type: 'video',
    components: video(
      "📱 *Download Our App — Get ${{1}} FREE!*\n\nHi {{2}}!\n\nSee how easy shopping gets with our app!\n\n📲 Download now and get:\n💰 *${{1}} welcome credit*\n🔔 Exclusive app-only deals\n⚡ Faster checkout\n\nOver {{3}} happy users!",
      'Credit valid for 30 days after download.',
      [urlBtn('Download App', 'https://app.example.com/download')]
    )},

  { name: 'promo_clearance_sale', category: 'MARKETING', type: 'image',
    components: image(
      "🧹 *CLEARANCE SALE — UP TO 80% OFF!*\n\nHi {{1}},\n\nWe're clearing out stock to make way for new arrivals!\n\n🔖 Prices slashed by up to *80%*\n📦 Limited quantities\n🚚 Free shipping on orders ${{2}}+\n\nGrab bargains before they're gone!",
      'All clearance sales are final. No returns.',
      [urlBtn('View Clearance', 'https://shop.example.com/clearance')]
    )},

  { name: 'promo_combo_discount', category: 'MARKETING', type: 'carousel',
    components: carousel(
      "🎯 *MIX & MATCH DEALS!*\n\nHi {{1}}! Create your perfect combo:\n\n✅ Pick any 2 → Save 15%\n✅ Pick any 3 → Save 25%\n✅ Pick any 4 → Save 35%\n\nChoose your favourites:",
      ['Shop {{2}}', 'Shop {{3}}', 'Shop {{4}}', 'See All Categories']
    )},

  { name: 'promo_coupon_expiry_reminder', category: 'MARKETING', type: 'text',
    components: text(
      "⏰ *Your Coupon Expires in {{1}} Hours!*\n\nHi {{2}}, don't let your coupon go to waste!\n\n🏷️ Code: *{{3}}*\n💰 Discount: {{4}}% OFF\n⏰ Expires: {{5}}\n\nUse it now before it's gone!",
      null,
      [urlBtn('Use Coupon Now', 'https://shop.example.com'), replyBtn('Copy Code')]
    )},

  { name: 'promo_influencer_collab', category: 'MARKETING', type: 'video',
    components: video(
      "🌟 *As Featured by {{1}}!*\n\nHi {{2}},\n\nYou've seen *{{3}}* use {{4}} — now get it yourself!\n\nExclusive code from {{1}}: *{{5}}*\n💰 Saves you: {{6}}% OFF\n\nLimited time — expires {{7}}!",
      null,
      [urlBtn('Shop {{1}}\'s Picks', 'https://shop.example.com/collab'), replyBtn('Share With Friends')]
    )},

  { name: 'promo_holiday_campaign', category: 'MARKETING', type: 'image',
    components: image(
      "🎄 *{{1}} HOLIDAY SALE — Gifts for Everyone!*\n\nHi {{2}}!\n\nMake this {{1}} special with our exclusive collection:\n\n🎁 Under $25 gifts\n🎁 Premium gift sets from ${{3}}\n🎁 Gift wrapping available\n🎁 Express delivery by {{4}}\n\nShop the perfect gift!",
      'Order by {{4}} for guaranteed delivery.',
      [urlBtn('Shop Gifts', 'https://shop.example.com/gifts'), replyBtn('View Gift Guide')]
    )},

  { name: 'promo_student_discount', category: 'MARKETING', type: 'text',
    components: text(
      "🎓 *Student Discount — {{1}}% OFF!*\n\nHi {{2}},\n\nStudents get an exclusive *{{1}}% discount* on everything!\n\n✅ Verify your student status\n✅ Unlock your discount code\n✅ Shop and save!\n\nValid with any active student email.",
      'Requires annual re-verification.',
      [urlBtn('Verify & Get Discount', 'https://example.com/student')]
    )},

  { name: 'promo_charity_campaign', category: 'MARKETING', type: 'image',
    components: image(
      "❤️ *Shop & Give Back — {{1}} Campaign*\n\nHi {{2}},\n\nThis {{3}}, *{{4}}% of every purchase* goes to {{5}}.\n\nYou shop → We donate → Lives change.\n\n🌍 Together we've raised *${{6}}* so far!\n\nBe part of the change.",
      null,
      [urlBtn('Shop & Donate', 'https://shop.example.com/give'), replyBtn('Learn About Our Cause')]
    )},

  { name: 'promo_free_gift_with_purchase', category: 'MARKETING', type: 'image',
    components: image(
      "🎁 *FREE GIFT with Every Purchase!*\n\nHi {{1}},\n\nFrom {{2}} to {{3}}, get a FREE *{{4}}* (worth ${{5}}) with every order above *${{6}}*!\n\n✅ Auto-added to cart\n✅ While stocks last\n✅ No code needed",
      'One free gift per order only.',
      [urlBtn('Shop Now', 'https://shop.example.com')]
    )},

  { name: 'promo_anniversary_sale', category: 'MARKETING', type: 'video',
    components: video(
      "🎉 *We're Celebrating {{1}} Years — And You're Invited!*\n\nHi {{2}}!\n\nThank you for {{1}} amazing years. To celebrate:\n\n🎂 {{1}}% OFF everything\n🎂 Free shipping this week\n🎂 Exclusive {{1}}th anniversary products\n\nBecause YOU made this possible!",
      'Anniversary sale runs for 7 days only.',
      [urlBtn('Celebrate with Us', 'https://shop.example.com/anniversary')]
    )},

  { name: 'promo_mystery_box', category: 'MARKETING', type: 'image',
    components: image(
      "🎲 *MYSTERY BOX — What Will You Get?*\n\nHi {{1}}!\n\nOur Mystery Box contains items worth *${{2}}+*. You pay just *${{3}}*!\n\nPast boxes included:\n✨ {{4}}\n✨ {{5}}\n✨ {{6}}\n\n🎁 Each box is different!",
      'Contents vary. All items are brand new.',
      [urlBtn('Get Mystery Box', 'https://shop.example.com/mystery'), replyBtn('See Past Unboxings')]
    )},

  { name: 'promo_member_only_event', category: 'MARKETING', type: 'text',
    components: text(
      "🔐 *Members-Only Event — You're Invited!*\n\nHi {{1}},\n\nAs a valued member, you're invited to our exclusive {{2}} event:\n\n📅 Date: {{3}}\n🕐 Time: {{4}}\n🔗 Access link: {{5}}\n\nLimited spots available — RSVP now!",
      null,
      [replyBtn('Yes, I\'ll Attend'), replyBtn('Can\'t Make It'), urlBtn('Add to Calendar', 'https://cal.example.com')]
    )},

  { name: 'promo_spring_collection_video', category: 'MARKETING', type: 'video',
    components: video(
      "🌸 *{{1}} Collection Has Arrived!*\n\nHi {{2}}, see the full collection in action!\n\nFeaturing:\n🌸 {{3}} styles\n🌸 {{4}} colors\n🌸 Starting from *${{5}}*\n\nNew season, new you!",
      null,
      [urlBtn('Shop Collection', 'https://shop.example.com/new')]
    )},

  { name: 'promo_countdown_deal', category: 'MARKETING', type: 'image',
    components: image(
      "⏱️ *DEAL ENDS IN {{1}} HOURS!*\n\n🔥 {{2}} — *{{3}}% OFF*\n\nOriginal: ~~${{4}}~~\nDeal price: *${{5}}*\nYou save: *${{6}}*\n\nOnly {{7}} left at this price!\n\nHi {{8}}, grab it before it's gone!",
      'Price reverts after timer expires.',
      [urlBtn('Get This Deal', 'https://shop.example.com/deals')]
    )},

  { name: 'promo_social_contest', category: 'MARKETING', type: 'image',
    components: image(
      "📸 *WIN ${{1}} in Our Photo Contest!*\n\nHi {{2}}!\n\nShare a photo of you using *{{3}}* and WIN!\n\n🥇 1st Prize: *${{1}} voucher*\n🥈 2nd Prize: *${{4}} voucher*\n🥉 3rd Prize: *${{5}} voucher*\n\nTag us and use #{{6}}!",
      'Contest ends {{7}}. Open to all customers.',
      [urlBtn('Contest Rules', 'https://example.com/contest'), replyBtn('I\'m In!')]
    )},

  { name: 'promo_daily_deals', category: 'MARKETING', type: 'text',
    components: text(
      "☀️ *Today's Daily Deal — {{1}}*\n\nHi {{2}}!\n\n🔥 *{{3}}* is today's featured deal:\n\nRegular: ~~${{4}}~~\nToday only: *${{5}}* ({{6}}% OFF!)\n\n⏰ Resets at midnight. Only {{7}} units!",
      'Daily deals change at midnight.',
      [urlBtn('Buy Today\'s Deal', 'https://shop.example.com/daily')]
    )},

  { name: 'promo_newsletter_exclusive', category: 'MARKETING', type: 'text',
    components: text(
      "📬 *Subscriber-Exclusive Deal!*\n\nHi {{1}},\n\nAs a newsletter subscriber, you get early access to:\n\n🎯 {{2}}% OFF new collection\n🎯 Free gift with orders above ${{3}}\n🎯 Code: *{{4}}*\n\nFor your eyes only — not shared publicly!",
      'Code expires in 48 hours. One use per customer.',
      [urlBtn('Shop Exclusive Deal', 'https://shop.example.com')]
    )},

  { name: 'promo_eco_green_sale', category: 'MARKETING', type: 'image',
    components: image(
      "🌿 *GREEN SALE — Good for You & the Planet*\n\nHi {{1}}!\n\nShop our eco-friendly collection and save:\n\n♻️ {{2}}% OFF all sustainable products\n🌍 We'll plant a tree for every order\n🌱 Brands: {{3}}, {{4}}, {{5}}\n\nShop green, live clean!",
      'One tree planted per order via our reforestation partner.',
      [urlBtn('Shop Eco Products', 'https://shop.example.com/eco')]
    )},

  { name: 'promo_group_buy', category: 'MARKETING', type: 'text',
    components: text(
      "👥 *Group Buy — More People, Better Price!*\n\nHi {{1}}!\n\nJoin our group buy for *{{2}}*:\n\n👥 Current participants: *{{3}}*\n🎯 Target: {{4}} participants\n💰 Your price drops to *${{5}}* when we hit target!\n\nShare and save together!",
      'Group buy closes when target is reached or on {{6}}.',
      [urlBtn('Join Group Buy', 'https://shop.example.com/group'), replyBtn('Share with Friends')]
    )},

  { name: 'promo_payday_sale', category: 'MARKETING', type: 'image',
    components: image(
      "💰 *PAYDAY SALE is HERE!*\n\nHi {{1}}! It's payday — treat yourself!\n\n🤑 Extra {{2}}% OFF\n🤑 Free shipping\n🤑 Earn 3x points\n\nThis sale is ONLY on the last Friday of every month!\n\n⏰ Today only!",
      'Payday sale valid 24 hours only.',
      [urlBtn('Shop Payday Sale', 'https://shop.example.com/payday')]
    )},

  { name: 'promo_flash_deal_video', category: 'MARKETING', type: 'video',
    components: video(
      "⚡ *FLASH DEAL — Next 2 Hours Only!*\n\nHi {{1}}, this deal won't last!\n\nWatch the product and decide fast — *{{2}}% OFF {{3}}!*\n\n🔥 Was: ${{4}} → Now: *${{5}}*\n⏰ {{6}} units left\n⏰ Ends: {{7}} PM",
      null,
      [urlBtn('Buy Before It\'s Gone', 'https://shop.example.com/flash')]
    )},

  { name: 'promo_survey_reward', category: 'MARKETING', type: 'text',
    components: text(
      "📝 *Quick Survey — Earn ${{1}} Reward!*\n\nHi {{2}},\n\nWe'd love your feedback! Complete a 2-minute survey and receive:\n\n🎁 *${{1}} store credit*\n🎁 Entry into our ${{3}} draw\n\n⏰ Survey closes {{4}}. Takes 2 minutes!",
      null,
      [urlBtn('Take Survey', 'https://survey.example.com'), replyBtn('Remind Me Tomorrow')]
    )},

  // ── ADVERTISEMENT (25) ──────────────────────────────────────────────────────

  { name: 'ad_brand_awareness_image', category: 'MARKETING', type: 'image',
    components: image(
      "✨ *Discover {{1}}*\n\nHi {{2}}!\n\nWe're *{{1}}* — {{3}}.\n\nJoining us means:\n🌟 {{4}}\n🌟 {{5}}\n🌟 {{6}}\n\nOver *{{7}} customers* trust us. Ready to join?",
      null,
      [urlBtn('Learn More', 'https://example.com/about'), replyBtn('Tell Me More')]
    )},

  { name: 'ad_service_launch_video', category: 'MARKETING', type: 'video',
    components: video(
      "🚀 *Introducing {{1}} — {{2}}*\n\nHi {{3}}!\n\nWe've built something that changes how you {{4}}.\n\n✅ {{5}}\n✅ {{6}}\n✅ {{7}}\n\nLaunching {{8}}. Get notified first!",
      null,
      [replyBtn('Notify Me at Launch'), urlBtn('Learn More', 'https://example.com/launch')]
    )},

  { name: 'ad_testimonial_video', category: 'MARKETING', type: 'video',
    components: video(
      "🎙️ *Hear It from {{1}} Themselves!*\n\nHi {{2}},\n\n\"{{3}}\" — {{4}}, {{5}}\n\nJoin *{{6}}+ satisfied customers* who transformed their {{7}} with us.\n\nYour success story could be next!",
      null,
      [urlBtn('Start Your Journey', 'https://example.com/start'), replyBtn('See More Stories')]
    )},

  { name: 'ad_limited_beta_access', category: 'MARKETING', type: 'text',
    components: text(
      "🔒 *Beta Access — Invitation Only*\n\nHi {{1}},\n\nYou've been selected for exclusive beta access to *{{2}}*!\n\n🎯 What you get:\n✅ Free access during beta\n✅ Your feedback shapes the product\n✅ Lifetime discount as a beta user\n\nOnly {{3}} spots left!",
      'Beta access is non-transferable.',
      [urlBtn('Accept Beta Invite', 'https://example.com/beta'), replyBtn('No Thanks')]
    )},

  { name: 'ad_comparison_ad', category: 'MARKETING', type: 'image',
    components: image(
      "⚖️ *{{1}} vs The Competition*\n\nHi {{2}}, see why customers choose *{{1}}*:\n\n|  | {{1}} | Others |\n|---|---|---|\n| {{3}} | ✅ | ❌ |\n| {{4}} | ✅ | ❌ |\n| {{5}} | ✅ | ❌ |\n\nThe choice is clear.",
      null,
      [urlBtn('Try {{1}} Free', 'https://example.com/try')]
    )},

  { name: 'ad_problem_solution', category: 'MARKETING', type: 'image',
    components: image(
      "😩 *Tired of {{1}}?*\n\nHi {{2}},\n\nMost people struggle with:\n❌ {{3}}\n❌ {{4}}\n❌ {{5}}\n\n*{{6}}* solves this by:\n✅ {{7}}\n✅ {{8}}\n✅ {{9}}\n\nSee the difference for yourself!",
      null,
      [urlBtn('See How It Works', 'https://example.com/solution'), replyBtn('I Have This Problem')]
    )},

  { name: 'ad_stats_social_proof', category: 'MARKETING', type: 'image',
    components: image(
      "📊 *The Numbers Don't Lie*\n\nHi {{1}}!\n\nWhy thousands choose *{{2}}*:\n\n📈 *{{3}}%* increase in {{4}}\n⏱️ Save *{{5}} hours* per week\n💰 Average savings: *${{6}}/month*\n⭐ Rated {{7}}/5 by {{8}}+ users\n\nWant similar results?",
      'Results based on customer surveys.',
      [urlBtn('Get Started', 'https://example.com/start'), replyBtn('Learn More')]
    )},

  { name: 'ad_before_after_video', category: 'MARKETING', type: 'video',
    components: video(
      "📸 *Before vs After — Real Results!*\n\nHi {{1}},\n\nWatch {{2}}'s transformation using *{{3}}* in just {{4}} weeks!\n\n🔴 Before: {{5}}\n🟢 After: {{6}}\n\nCould YOU be our next success story?",
      'Individual results may vary.',
      [urlBtn('Start My Transformation', 'https://example.com/start'), replyBtn('See More Transformations')]
    )},

  { name: 'ad_webinar_invite', category: 'MARKETING', type: 'image',
    components: image(
      "📣 *FREE Webinar — {{1}}*\n\nHi {{2}}, you're invited!\n\n🎙️ Topic: *{{1}}*\n👤 Speaker: {{3}}\n📅 Date: {{4}}\n🕐 Time: {{5}}\n\nLearn how to {{6}} in just 60 minutes.\n\nLimited to {{7}} attendees!",
      'Replay available for registered attendees.',
      [urlBtn('Register Free', 'https://webinar.example.com'), replyBtn('Can\'t Attend — Send Replay')]
    )},

  { name: 'ad_ebook_download', category: 'MARKETING', type: 'doc',
    components: doc(
      "📚 *Free eBook: {{1}}*\n\nHi {{2}},\n\nDownload your FREE copy of *\"{{1}}\"*!\n\nInside you'll discover:\n✅ {{3}}\n✅ {{4}}\n✅ {{5}}\n\nRead by *{{6}}+ professionals* in {{7}}.",
      null,
      [replyBtn('Yes, Send My Copy!'), replyBtn('Not Interested')]
    )},

  { name: 'ad_award_recognition', category: 'MARKETING', type: 'image',
    components: image(
      "🏆 *Award-Winning {{1}}!*\n\nHi {{2}},\n\n*{{1}}* has been recognized as:\n\n🥇 {{3}} — {{4}}\n🥇 {{5}} — {{6}}\n🥇 {{7}} — {{8}}\n\nJoin the platform trusted by industry leaders.",
      null,
      [urlBtn('Try Award-Winning {{1}}', 'https://example.com'), replyBtn('Read Full Story')]
    )},

  { name: 'ad_urgency_spots_limited', category: 'MARKETING', type: 'text',
    components: text(
      "🚨 *ONLY {{1}} SPOTS LEFT!*\n\nHi {{2}},\n\n*{{3}}* is almost full — don't get left out!\n\n✅ {{4}} spots taken out of {{5}}\n⏰ Enrollment closes: {{6}}\n💰 Investment: *${{7}}* (was ${{8}})\n\nSecure your spot NOW!",
      null,
      [urlBtn('Reserve My Spot', 'https://example.com/enroll'), replyBtn('Still Thinking')]
    )},

  { name: 'ad_new_feature_video', category: 'MARKETING', type: 'video',
    components: video(
      "🆕 *NEW FEATURE: {{1}}*\n\nHi {{2}}, we've been listening to your feedback!\n\nIntroducing *{{1}}* — now available in {{3}}!\n\n🎯 What it does: {{4}}\n💡 Why you'll love it: {{5}}\n\nUpdate now to access it!",
      null,
      [urlBtn('Update Now', 'https://app.example.com/update'), replyBtn('Learn More')]
    )},

  { name: 'ad_podcast_episode', category: 'MARKETING', type: 'image',
    components: image(
      "🎙️ *New Episode: \"{{1}}\"*\n\nHi {{2}}!\n\n🎧 *{{3}} Podcast* — Episode {{4}}\n\n📌 Guest: {{5}}\n📌 Topic: {{6}}\n⏱️ Length: {{7}} minutes\n\nAvailable on Spotify, Apple, and more!",
      null,
      [urlBtn('Listen Now', 'https://podcast.example.com'), replyBtn('Subscribe to Podcast')]
    )},

  { name: 'ad_case_study_doc', category: 'MARKETING', type: 'doc',
    components: doc(
      "📋 *Case Study: How {{1}} Achieved {{2}}*\n\nHi {{3}},\n\nDiscover how *{{1}}* used *{{4}}* to:\n\n📈 Increase {{5}} by {{6}}%\n💰 Save ${{7}} monthly\n⏱️ Cut {{8}} time by {{9}}%\n\nFull case study attached.",
      null,
      [replyBtn('I Want Similar Results'), urlBtn('Get a Demo', 'https://example.com/demo')]
    )},

  { name: 'ad_industry_report', category: 'MARKETING', type: 'doc',
    components: doc(
      "📊 *{{1}} Industry Report {{2}}*\n\nHi {{3}},\n\nOur latest research reveals:\n\n📈 {{4}}\n🔍 {{5}}\n💡 {{6}}\n\nThe full *{{1}} Industry Report {{2}}* is attached — {{7}} pages of insights.",
      null,
      [replyBtn('Send Full Report'), urlBtn('View Online', 'https://example.com/report')]
    )},

  { name: 'ad_partnership_announcement', category: 'MARKETING', type: 'image',
    components: image(
      "🤝 *Exciting Partnership Announcement!*\n\nHi {{1}},\n\nWe're thrilled to announce our partnership with *{{2}}*!\n\nWhat this means for you:\n✅ {{3}}\n✅ {{4}}\n✅ {{5}}\n\nEffective from {{6}}.",
      null,
      [urlBtn('Learn More', 'https://example.com/partnership'), replyBtn('Great News!')]
    )},

  { name: 'ad_social_proof_image', category: 'MARKETING', type: 'image',
    components: image(
      "⭐⭐⭐⭐⭐ *{{1}} Reviews*\n\nHi {{2}},\n\n\"{{3}}\"\n— {{4}} from {{5}}\n\n\"{{6}}\"\n— {{7}} from {{8}}\n\nJoin *{{9}}+ happy customers* today!",
      null,
      [urlBtn('Join Them Now', 'https://example.com'), replyBtn('Read More Reviews')]
    )},

  { name: 'ad_free_consultation', category: 'MARKETING', type: 'text',
    components: text(
      "📞 *Book a FREE {{1}}-Minute Consultation*\n\nHi {{2}},\n\nOur expert {{3}} would love to help you with:\n\n🎯 {{4}}\n🎯 {{5}}\n🎯 {{6}}\n\nNo sales pitch. Just honest advice.\n\nAvailable this week!",
      null,
      [urlBtn('Book Free Call', 'https://cal.example.com/book'), replyBtn('Not Right Now')]
    )},

  { name: 'ad_influencer_campaign', category: 'MARKETING', type: 'video',
    components: video(
      "👑 *{{1}} Recommends {{2}}!*\n\nHi {{3}},\n\n{{1}} — with *{{4}} followers* — has tried {{2}} and loves it!\n\n🎥 Watch the full review above\n\n💥 Exclusive discount for followers: *{{5}}% OFF*\n🏷️ Code: *{{6}}*",
      'Discount valid for 72 hours from message receipt.',
      [urlBtn('Shop Now', 'https://shop.example.com/influencer')]
    )},

  { name: 'ad_brand_story_video', category: 'MARKETING', type: 'video',
    components: video(
      "💫 *Our Story — Why We Started {{1}}*\n\nHi {{2}},\n\nIn {{3}}, {{4}} had a problem: {{5}}.\n\nThat problem became the spark that created *{{1}}*.\n\nToday, we serve *{{6}} customers* in *{{7}} countries*.\n\nThis is our story.",
      null,
      [urlBtn('Be Part of Our Story', 'https://example.com/about'), replyBtn('Inspiring!')]
    )},

  { name: 'ad_product_feature_carousel', category: 'MARKETING', type: 'carousel',
    components: carousel(
      "🌟 *What Makes {{1}} Different?*\n\nHi {{2}}, explore what sets us apart:\n\n💡 Feature 1: {{3}}\n💡 Feature 2: {{4}}\n💡 Feature 3: {{5}}\n💡 Feature 4: {{6}}\n\nWhich feature matters most to you?",
      ['{{3}}', '{{4}}', '{{5}}', '{{6}}']
    )},

  { name: 'ad_guarantee_offer', category: 'MARKETING', type: 'image',
    components: image(
      "🛡️ *{{1}}-Day Money Back Guarantee*\n\nHi {{2}},\n\nTry *{{3}}* completely risk-free!\n\n✅ {{1}} days to try it\n✅ Not happy? Full refund\n✅ No questions asked\n✅ Keep any bonuses\n\nWe're that confident!",
      'Refund processed within 5 business days.',
      [urlBtn('Try Risk-Free', 'https://example.com/buy'), replyBtn('Questions?')]
    )},

  { name: 'ad_location_promo', category: 'MARKETING', type: 'image',
    components: image(
      "📍 *Special Offer for {{1}} Customers!*\n\nHi {{2}},\n\nWe've launched in *{{1}}* and have a special welcome offer just for you:\n\n🎁 {{3}}% OFF your first order\n🚚 Free same-day delivery in {{1}}\n🏪 Visit our store at {{4}}\n\nWelcome to the family!",
      'Location-specific offer. Valid in {{1}} only.',
      [urlBtn('Claim Local Offer', 'https://shop.example.com/local')]
    )},

  { name: 'ad_countdown_launch_video', category: 'MARKETING', type: 'video',
    components: video(
      "⏳ *{{1}} Days Until Launch — Are You Ready?*\n\nHi {{2}}!\n\nSomething BIG is coming from *{{3}}* on *{{4}}*.\n\nSneak peek inside this video 👆\n\nGet early access and save *{{5}}%* by joining the waitlist now!",
      'Early access guaranteed for waitlist members.',
      [urlBtn('Join Waitlist', 'https://example.com/waitlist'), replyBtn('Tell a Friend')]
    )},
];

// ── Seed all companies ────────────────────────────────────────────────────────

let totalInserted = 0;
let totalSkipped = 0;

for (const companyId of companyIds) {
  const rows = templates.map(t => ({
    company_id: companyId,
    name: t.name,
    language: 'en',
    category: t.category,
    status: 'approved',
    components: t.components,
  }));

  // Insert in batches of 25
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const { data, error } = await supabase
      .from('message_templates')
      .upsert(batch, { onConflict: 'company_id,name', ignoreDuplicates: true })
      .select('id');
    if (error) {
      console.error(`Batch ${i/25+1} error for company ${companyId}:`, error.message);
    } else {
      totalInserted += (data?.length || 0);
    }
  }
  console.log(`✅ Company ${companyId}: templates seeded`);
}

console.log(`\n🎉 Done! ${totalInserted} templates inserted (${totalSkipped} skipped as duplicates)`);
console.log(`📊 Total templates per company: ${templates.length}`);
