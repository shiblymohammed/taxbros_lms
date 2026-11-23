'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Registers /sw.js and provides an install prompt for browsers (Task 63, R32).
 */
export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    if (!enabled || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  if (!installPrompt || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-white dark:bg-slate-900 border border-teal-600/30 shadow-xl rounded-xl p-3 px-4 animate-in fade-in slide-in-from-bottom-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-teal-50 dark:bg-teal-950/50 rounded-lg text-teal-700 dark:text-teal-400">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Install TAXBROS App</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Install as an app for desktop & mobile</p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Button size="sm" onClick={handleInstallClick} className="bg-[#0f4c5c] hover:bg-[#0c3c49] text-white text-xs h-8 px-3 cursor-pointer">
          Install
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
