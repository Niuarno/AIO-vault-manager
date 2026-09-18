'use client';

import React from 'react';

export function WhatsAppFlatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path
        fill="#FFFFFF"
        d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.2-.7.2-.2.4-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.6 1.9.7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.6.2-1.7-.1-.2-.3-.3-.6-.5z"
      />
    </svg>
  );
}

export function MessengerFlatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <defs>
        <linearGradient id="msgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00B2FE" />
          <stop offset="50%" stopColor="#006AFF" />
          <stop offset="100%" stopColor="#9B34EF" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#msgGrad)" />
      <path
        fill="#FFFFFF"
        d="M12 5.5C8.4 5.5 5.5 8.1 5.5 11.4c0 1.8.9 3.5 2.4 4.6.1.1.2.3.2.4l-.5 1.7c-.1.3.2.5.4.4l1.9-.8c.2-.1.3 0 .5.1.7.3 1.4.4 2.1.4 3.6 0 6.5-2.6 6.5-5.9S15.6 5.5 12 5.5zm.9 7.8l-1.8-1.9-3.4 1.9 3.8-4 1.8 1.9 3.3-1.9-3.7 4z"
      />
    </svg>
  );
}

export function PhoneCallFlatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="#F59E0B" />
      <path
        fill="#FFFFFF"
        d="M15.8 13.9c-.3-.2-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8.9-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4 0-.1 0-.3-.1-.4-.1-.2-.5-1.3-.7-1.8-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.7.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.7.1.5-.1 1.6-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3z"
      />
    </svg>
  );
}

export function WalkInFlatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="#6366F1" />
      <path
        fill="#FFFFFF"
        d="M7 9l1-3h8l1 3H7zm1.5 2c-.8 0-1.5-.7-1.5-1.5V17c0 .6.4 1 1 1h8c.6 0 1-.4 1-1v-7.5c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5z"
      />
    </svg>
  );
}

export function WebsiteFlatIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="#3B82F6" />
      <path
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6a6 6 0 100 12 6 6 0 000-12zm-5.5 6h11M12 6c1.5 2 2.3 4 2.3 6s-.8 4-2.3 6c-1.5-2-2.3-4-2.3-6s.8-4 2.3-6z"
      />
    </svg>
  );
}
