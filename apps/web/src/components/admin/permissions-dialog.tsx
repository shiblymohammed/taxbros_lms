'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ENFORCED_PERMISSIONS,
  staffPermissionsApi,
  type GrantedPermission,
  type StaffPermission,
} from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/lab-validation';

interface PermissionsDialogProps {
  staff: { staffProfileId: string; name: string } | null;
  onClose: () => void;
}

/** Grant and revoke staff permissions (R3). Changes apply to the staff member's next request. */
export function PermissionsDialog({ staff, onClose }: PermissionsDialogProps) {
  const { toast } = useToast();
  const [granted, setGranted] = useState<GrantedPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<StaffPermission | null>(null);

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setLoading(true);
    staffPermissionsApi
      .list(staff.staffProfileId)
      .then((rows) => !cancelled && setGranted(rows))
      .catch((err) => !cancelled && toast({ variant: 'destructive', title: 'Could not load permissions', description: getApiErrorMessage(err) }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [staff, toast]);

  const toggle = async (permission: StaffPermission) => {
    if (!staff) return;
    const existing = granted.find((g) => g.permission === permission);
    setBusy(permission);
    try {
      if (existing) {
        await staffPermissionsApi.revoke(staff.staffProfileId, existing.id);
        setGranted((prev) => prev.filter((g) => g.id !== existing.id));
      } else {
        const row = await staffPermissionsApi.grant(staff.staffProfileId, permission);
        setGranted((prev) => [...prev, row]);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Permission not changed', description: getApiErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const others = granted.filter((g) => !ENFORCED_PERMISSIONS.some((p) => p.value === g.permission));

  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissions: {staff?.name}</DialogTitle>
          <DialogDescription>Administrators always have every permission. Changes take effect immediately.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <ul className="space-y-2">
            {ENFORCED_PERMISSIONS.map((p) => {
              const on = granted.some((g) => g.permission === p.value);
              return (
                <li key={p.value}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
                      checked={on}
                      disabled={busy !== null}
                      onChange={() => toggle(p.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {p.label}
                        {busy === p.value && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                      </span>
                      <span className="block text-xs text-gray-500">{p.description}</span>
                    </span>
                  </label>
                </li>
              );
            })}
            {others.length > 0 && (
              <li className="text-xs text-gray-500">
                Also granted: {others.map((o) => o.permission).join(', ')}
              </li>
            )}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
