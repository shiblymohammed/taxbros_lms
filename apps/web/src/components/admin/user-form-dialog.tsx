'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  generateTemporaryPassword,
  usersApi,
  type AdminUser,
  type CreateUserPayload,
  type StaffCategory,
} from '@/lib/admin-api';
import type { UserRole } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/lab-validation';

type FormRole = 'STUDENT' | 'STAFF' | 'ADMINISTRATOR';

interface FormState {
  role: FormRole;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  admissionId: string;
  admissionDate: string;
  staffId: string;
  designation: string;
  department: string;
  category: StaffCategory;
  joiningDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(role: FormRole = 'STUDENT'): FormState {
  return {
    role,
    email: '',
    password: generateTemporaryPassword(),
    firstName: '',
    lastName: '',
    phoneNumber: '',
    admissionId: '',
    admissionDate: today(),
    staffId: '',
    designation: '',
    department: '',
    category: 'TEACHING',
    joiningDate: today(),
  };
}

function fromUser(user: AdminUser): FormState {
  const base = emptyForm(user.role === 'STAFF' ? 'STAFF' : user.role === 'STUDENT' ? 'STUDENT' : 'ADMINISTRATOR');
  const s = user.studentProfile;
  const st = user.staffProfile;
  return {
    ...base,
    password: '',
    email: user.email,
    firstName: s?.firstName ?? st?.firstName ?? '',
    lastName: s?.lastName ?? st?.lastName ?? '',
    phoneNumber: s?.phoneNumber ?? st?.phoneNumber ?? '',
    admissionId: s?.admissionId ?? '',
    admissionDate: s?.admissionDate?.slice(0, 10) ?? base.admissionDate,
    staffId: st?.staffId ?? '',
    designation: st?.designation ?? '',
    department: st?.department ?? '',
    category: st?.category ?? 'TEACHING',
    joiningDate: st?.joiningDate?.slice(0, 10) ?? base.joiningDate,
  };
}

/** Field-level validation mirroring the API's required fields (R1.1–R1.3). */
export function validateUserForm(f: FormState, isEdit: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (!isEdit && f.password.length < 8) e.password = 'At least 8 characters';
  if (f.role !== 'ADMINISTRATOR') {
    if (!f.firstName.trim()) e.firstName = 'Required';
    if (!f.lastName.trim()) e.lastName = 'Required';
  }
  if (f.role === 'STUDENT') {
    if (!f.admissionId.trim()) e.admissionId = 'Required';
    if (!f.admissionDate) e.admissionDate = 'Required';
  }
  if (f.role === 'STAFF') {
    if (!f.staffId.trim()) e.staffId = 'Required';
    if (!f.designation.trim()) e.designation = 'Required';
    if (!f.department.trim()) e.department = 'Required';
    if (!f.joiningDate) e.joiningDate = 'Required';
  }
  return e;
}

interface UserFormDialogProps {
  open: boolean;
  user?: AdminUser | null;
  /** Super admins may create administrators; administrators create students and staff. */
  canCreateAdmins: boolean;
  /** Roles the signed-in user may create (staff: only those they manage). Defaults to students and staff. */
  allowedRoles?: Array<'STUDENT' | 'STAFF'>;
  onClose: () => void;
  onSaved: (user: AdminUser, temporaryPassword?: string) => void;
}

export function UserFormDialog({ open, user, canCreateAdmins, allowedRoles = ['STUDENT', 'STAFF'], onClose, onSaved }: UserFormDialogProps) {
  const isEdit = !!user;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(user ? fromUser(user) : emptyForm(allowedRoles[0]));
    setErrors({});
    setServerError(null);
    // Reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateUserForm(form, isEdit);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    const trim = (v: string) => v.trim();
    const phone = form.phoneNumber.trim() || undefined;
    const studentProfile = {
      admissionId: trim(form.admissionId),
      firstName: trim(form.firstName),
      lastName: trim(form.lastName),
      admissionDate: form.admissionDate,
      ...(phone ? { phoneNumber: phone } : {}),
    };
    const staffProfile = {
      staffId: trim(form.staffId),
      firstName: trim(form.firstName),
      lastName: trim(form.lastName),
      designation: trim(form.designation),
      department: trim(form.department),
      category: form.category,
      joiningDate: form.joiningDate,
      ...(phone ? { phoneNumber: phone } : {}),
    };

    setSaving(true);
    try {
      if (isEdit && user) {
        const payload: Record<string, unknown> = { email: trim(form.email) };
        if (form.role === 'STUDENT') payload.studentProfile = studentProfile;
        if (form.role === 'STAFF') payload.staffProfile = staffProfile;
        const saved = await usersApi.update(user.id, payload);
        onSaved(saved);
      } else {
        const payload: CreateUserPayload = {
          email: trim(form.email),
          password: form.password,
          role: form.role as UserRole,
          ...(form.role === 'STUDENT' ? { studentProfile } : {}),
          ...(form.role === 'STAFF' ? { staffProfile } : {}),
        };
        const saved = await usersApi.create(payload);
        onSaved(saved, form.password);
      }
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Could not save the user'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`user-${key}`}>{label}</Label>
      <Input
        id={`user-${key}`}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `user-${key}-error` : undefined}
        disabled={saving}
        {...props}
      />
      {errors[key] && (
        <p id={`user-${key}-error`} className="text-sm text-red-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update contact and profile details. Use Reset password to issue a new password.'
              : 'The user signs in with the temporary password below and must change it straight away.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v as FormRole)} disabled={isEdit || saving}>
                <SelectTrigger id="user-role" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(allowedRoles.includes('STUDENT') || form.role === 'STUDENT') && (
                    <SelectItem value="STUDENT">Student</SelectItem>
                  )}
                  {(allowedRoles.includes('STAFF') || form.role === 'STAFF') && <SelectItem value="STAFF">Staff</SelectItem>}
                  {(canCreateAdmins || form.role === 'ADMINISTRATOR') && (
                    <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {field('email', 'Email', { type: 'email', autoComplete: 'off' })}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="user-password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="font-mono"
                  autoComplete="off"
                  disabled={saving}
                  aria-invalid={!!errors.password}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Generate a new temporary password"
                  onClick={() => set('password', generateTemporaryPassword())}
                  disabled={saving}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
            </div>
          )}

          {form.role !== 'ADMINISTRATOR' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field('firstName', 'First name')}
              {field('lastName', 'Last name')}
              {field('phoneNumber', 'Phone (optional)', { type: 'tel', inputMode: 'tel' })}
            </div>
          )}

          {form.role === 'STUDENT' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field('admissionId', 'Admission ID')}
              {field('admissionDate', 'Admission date', { type: 'date' })}
            </div>
          )}

          {form.role === 'STAFF' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field('staffId', 'Staff ID')}
              {field('designation', 'Designation')}
              {field('department', 'Department')}
              <div className="space-y-1.5">
                <Label htmlFor="user-category">Category</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v as StaffCategory)} disabled={saving}>
                  <SelectTrigger id="user-category" aria-label="Category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEACHING">Teaching</SelectItem>
                    <SelectItem value="NON_TEACHING">Non-teaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {field('joiningDate', 'Joining date', { type: 'date' })}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
