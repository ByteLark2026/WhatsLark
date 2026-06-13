import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  // Intl.DateTimeFormat throws if dateStyle/timeStyle is mixed with
  // component options like month/day/year, so only apply the defaults
  // when the caller hasn't requested a style-based format.
  const base: Intl.DateTimeFormatOptions = options?.dateStyle || options?.timeStyle
    ? {}
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', { ...base, ...options }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function truncate(str: string, maxLength: number) {
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}

// INR, AED and other GCC currencies first, then other major currencies.
export const CURRENCIES = [
  'INR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
  'USD', 'EUR', 'GBP', 'MYR', 'SGD', 'IDR', 'AUD', 'CAD', 'PKR', 'PHP',
] as const;

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatPhoneDisplay(phone: string) {
  return phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
}
