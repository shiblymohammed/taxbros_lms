'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CredentialsDialogProps {
  credentials: { email: string; password: string; title: string } | null;
  onClose: () => void;
}

/**
 * Shows a temporary password exactly once (new account or reset). It is never stored in the browser;
 * the user must replace it at first sign-in (R36.3, R36.4).
 */
export function CredentialsDialog({ credentials, onClose }: CredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={!!credentials} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{credentials?.title}</DialogTitle>
          <DialogDescription>
            Give these details to the user privately. This password is shown only now; they must change it
            when they first sign in.
          </DialogDescription>
        </DialogHeader>
        {credentials && (
          <dl className="space-y-3 rounded-lg border bg-gray-50 p-4 text-sm">
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium break-all">{credentials.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Temporary password</dt>
              <dd className="font-mono text-base font-semibold tracking-wide" data-testid="temporary-password">
                {credentials.password}
              </dd>
            </div>
          </dl>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={copy} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
