'use client';

import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

interface ScreenshotLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export default function ScreenshotLightboxModal({
  isOpen,
  onClose,
  imageUrl,
  title = 'Proof of Payment',
}: ScreenshotLightboxModalProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-800 shadow-2xl overflow-hidden my-6">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-white">
          <span className="text-xs font-bold">{title}</span>
          <div className="flex items-center space-x-2">
            <a
              href={imageUrl}
              download="payment_proof.jpg"
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Open full size"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 flex items-center justify-center bg-black/40 min-h-[350px] max-h-[80vh] overflow-auto">
          <img
            src={imageUrl}
            alt="Payment Proof Screenshot"
            className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}