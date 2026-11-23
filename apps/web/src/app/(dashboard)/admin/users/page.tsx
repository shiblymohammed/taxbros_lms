'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IdCard, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CredentialsDialog } from '@/components/admin/credentials-dialog';
import { PermissionsDialog } from '@/components/admin/permissions-dialog';
import { UserFormDialog } from '@/components/admin/user-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { displayName, usersApi, type AdminUser, type StaffCategory, type UserFilters, type UserStatus } from '@/lib/admin-api';
import { classesApi, type Class } from '@/lib/api';
import { getStoredUser, type UserRole } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/lab-validation';

const PAGE_SIZE = 20;

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMINISTRATOR: 'Administrator',
  STAFF: 'Staff',
  STUDENT: 'Student',
};

const STATUS_STYLE: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-200 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-800',
};

type Confirm = { kind: 'deactivate' | 'reset'; user: AdminUser } | null;

/** Role-specific search filters (R1.11 students, R1.12 staff). */
const EMPTY_EXTRA = {
  admissionId: '',
  classId: '',
  admissionDateFrom: '',
  admissionDateTo: '',
  staffId: '',
  department: '',
  designation: '',
  category: '' as '' | StaffCategory,
};
type ExtraFilters = typeof EMPTY_EXTRA;

function extraFiltersFor(role: 'ALL' | UserRole, f: ExtraFilters): Partial<UserFilters> {
  if (role === 'STUDENT') {
    return {
      admissionId: f.admissionId,
      classId: f.classId,
      admissionDateFrom: f.admissionDateFrom,
      admissionDateTo: f.admissionDateTo,
    };
  }
  if (role === 'STAFF') {
    return { staffId: f.staffId, department: f.department, designation: f.designation, category: f.category || undefined };
  }
  return {};
}

/** User management (R1, R3, R36.4). */
export default function UsersPage() {
  const { toast } = useToast();
  const me = typeof window !== 'undefined' ? getStoredUser() : null;
  // Staff see only the account types their permissions cover (MANAGE_STUDENTS / MANAGE_STAFF)
  const isStaffUser = me?.role === 'STAFF';
  const manageable: Array<'STUDENT' | 'STAFF'> = isStaffUser
    ? [
        ...(me?.permissions?.includes('MANAGE_STUDENTS') ? (['STUDENT'] as const) : []),
        ...(me?.permissions?.includes('MANAGE_STAFF') ? (['STAFF'] as const) : []),
      ]
    : ['STUDENT', 'STAFF'];

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'ALL' | UserRole>(() => (isStaffUser && manageable.length === 1 ? manageable[0] : 'ALL'));
  const [status, setStatus] = useState<'ALL' | UserStatus>('ALL');
  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<ExtraFilters>(EMPTY_EXTRA);
  const [appliedExtra, setAppliedExtra] = useState<ExtraFilters>(EMPTY_EXTRA);
  const [classes, setClasses] = useState<Class[]>([]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string; title: string } | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<{ staffProfileId: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  // Debounce the search box and the text filters
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setAppliedExtra(extra);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, extra]);

  // Class list for the student class filter
  useEffect(() => {
    if (role !== 'STUDENT' || classes.length > 0) return;
    classesApi.getAll().then(setClasses).catch(() => setClasses([]));
  }, [role, classes.length]);

  const setExtraField = <K extends keyof ExtraFilters>(key: K, value: ExtraFilters[K]) =>
    setExtra((prev) => ({ ...prev, [key]: value }));
  const hasExtra = Object.values(extraFiltersFor(role, extra)).some((v) => v);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await usersApi.list({
        search: query || undefined,
        role: role === 'ALL' ? undefined : role,
        status: status === 'ALL' ? undefined : status,
        ...extraFiltersFor(role, appliedExtra),
        page,
        limit: PAGE_SIZE,
      });
      setUsers(result.data);
      setTotal(result.meta.total);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load users', description: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [query, role, status, appliedExtra, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const replaceUser = (updated: AdminUser) =>
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));

  const activate = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      replaceUser(await usersApi.activate(user.id));
      toast({ title: 'Account activated', description: `${displayName(user)} can sign in.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Not activated', description: getApiErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setConfirm(null);
    setBusyId(user.id);
    try {
      if (kind === 'deactivate') {
        replaceUser(await usersApi.deactivate(user.id));
        toast({ title: 'Account deactivated', description: `${displayName(user)} has been signed out and can no longer sign in.` });
      } else {
        const result = await usersApi.resetPassword(user.id);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, mustChangePassword: true } : u)));
        setCredentials({ email: result.email, password: result.temporaryPassword, title: 'Password reset' });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: kind === 'deactivate' ? 'Not deactivated' : 'Password not reset',
        description: getApiErrorMessage(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold sm:text-2xl">Users</CardTitle>
            <CardDescription>Create accounts, manage access and staff permissions.</CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Add user
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <label className="relative block">
              <span className="sr-only">Search by name or email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </label>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as typeof role);
                setExtra(EMPTY_EXTRA);
                setAppliedExtra(EMPTY_EXTRA);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(!isStaffUser || manageable.length > 1) && <SelectItem value="ALL">All roles</SelectItem>}
                {manageable.includes('STUDENT') && <SelectItem value="STUDENT">Students</SelectItem>}
                {manageable.includes('STAFF') && <SelectItem value="STAFF">Staff</SelectItem>}
                {!isStaffUser && <SelectItem value="ADMINISTRATOR">Administrators</SelectItem>}
                {!isStaffUser && <SelectItem value="SUPER_ADMIN">Super admins</SelectItem>}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === 'STUDENT' && (
            <div className="mb-4 grid gap-3 rounded-lg border bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Admission ID</span>
                <Input value={extra.admissionId} onChange={(e) => setExtraField('admissionId', e.target.value)} placeholder="e.g. TB-2026" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Class</span>
                <Select value={extra.classId || 'ALL'} onValueChange={(v) => setExtraField('classId', v === 'ALL' ? '' : v)}>
                  <SelectTrigger aria-label="Filter by class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Any class</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Admitted from</span>
                <Input type="date" value={extra.admissionDateFrom} onChange={(e) => setExtraField('admissionDateFrom', e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Admitted to</span>
                <Input
                  type="date"
                  value={extra.admissionDateTo}
                  min={extra.admissionDateFrom || undefined}
                  onChange={(e) => setExtraField('admissionDateTo', e.target.value)}
                />
              </label>
            </div>
          )}

          {role === 'STAFF' && (
            <div className="mb-4 grid gap-3 rounded-lg border bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Staff ID</span>
                <Input value={extra.staffId} onChange={(e) => setExtraField('staffId', e.target.value)} placeholder="e.g. ST-01" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Department</span>
                <Input value={extra.department} onChange={(e) => setExtraField('department', e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Designation</span>
                <Input value={extra.designation} onChange={(e) => setExtraField('designation', e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Category</span>
                <Select
                  value={extra.category || 'ALL'}
                  onValueChange={(v) => setExtraField('category', v === 'ALL' ? '' : (v as StaffCategory))}
                >
                  <SelectTrigger aria-label="Filter by category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Any category</SelectItem>
                    <SelectItem value="TEACHING">Teaching</SelectItem>
                    <SelectItem value="NON_TEACHING">Non-teaching</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          )}

          {hasExtra && (
            <div className="-mt-2 mb-4">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setExtra(EMPTY_EXTRA)}>
                <X className="h-4 w-4" /> Clear {role === 'STUDENT' ? 'student' : 'staff'} filters
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-gray-500">No users match these filters.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {users.map((user) => {
                const profileId = user.studentProfile?.admissionId ?? user.staffProfile?.staffId;
                const isSelf = me?.id === user.id;
                const isSuper = user.role === 'SUPER_ADMIN';
                const busy = busyId === user.id;
                return (
                  <li key={user.id} className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                        <span className="truncate">{displayName(user)}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {ROLE_LABEL[user.role]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[user.status]}`}>
                          {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                        </span>
                        {user.mustChangePassword && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Must change password</span>
                        )}
                        {isSelf && <span className="text-xs text-gray-500">(you)</span>}
                      </p>
                      <p className="truncate text-sm text-gray-500">
                        {user.email}
                        {profileId && ` · ${profileId}`}
                        {user.staffProfile && ` · ${user.staffProfile.designation}, ${user.staffProfile.department}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {busy && <Loader2 className="h-5 w-5 animate-spin self-center text-gray-400" />}
                      {!isSuper && !(isStaffUser && isSelf) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => {
                            setEditing(user);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                      )}
                      {user.studentProfile && (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <Link href={`/admin/students/${user.studentProfile.id}`}>
                            <IdCard className="h-4 w-4" /> Profile
                          </Link>
                        </Button>
                      )}
                      {user.staffProfile && !isStaffUser && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() =>
                            setPermissionsFor({ staffProfileId: user.staffProfile!.id, name: displayName(user) })
                          }
                        >
                          <ShieldCheck className="h-4 w-4" /> Permissions
                        </Button>
                      )}
                      {!isSelf && !isSuper && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'reset', user })}
                        >
                          <KeyRound className="h-4 w-4" /> Reset password
                        </Button>
                      )}
                      {!isSelf && !isSuper &&
                        (user.status === 'ACTIVE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-700 hover:text-red-800"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: 'deactivate', user })}
                          >
                            <UserX className="h-4 w-4" /> Deactivate
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => activate(user)}>
                            <UserCheck className="h-4 w-4" /> Activate
                          </Button>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <span>
              {total} user{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        user={editing}
        canCreateAdmins={me?.role === 'SUPER_ADMIN' || me?.role === 'ADMINISTRATOR'}
        allowedRoles={manageable}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, temporaryPassword) => {
          setFormOpen(false);
          if (editing) {
            replaceUser(saved);
            toast({ title: 'User updated' });
          } else {
            load();
            if (temporaryPassword) {
              setCredentials({ email: saved.email, password: temporaryPassword, title: 'Account created' });
            }
          }
        }}
      />

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
      <PermissionsDialog staff={permissionsFor} onClose={() => setPermissionsFor(null)} />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === 'deactivate' ? 'Deactivate account?' : 'Reset password?'}
            </DialogTitle>
            <DialogDescription>
              {confirm &&
                (confirm.kind === 'deactivate'
                  ? `${displayName(confirm.user)} will be signed out everywhere and can't sign in until reactivated. Their records are kept.`
                  : `${displayName(confirm.user)} will be signed out everywhere and given a temporary password to change at next sign-in.`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant={confirm?.kind === 'deactivate' ? 'destructive' : 'default'} onClick={runConfirmed}>
              {confirm?.kind === 'deactivate' ? 'Deactivate' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
