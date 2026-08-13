// Loads the Razorpay Checkout script exactly once, even across repeated calls
// (e.g. re-opening the pricing page). Returns the global `Razorpay` constructor.

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let loadPromise: Promise<any> | null = null;

export function loadRazorpayCheckout(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout can only be loaded in the browser'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
    document.body.appendChild(script);
  });

  return loadPromise;
}

export function formatMoney(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}
