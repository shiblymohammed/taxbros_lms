'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, timezoneOptions, type InstituteSetting, type SettingKey } from '@/lib/admin-api';
import { formatDateTime, resetInstituteTimezone } from '@/lib/institute-time';
import { getApiErrorMessage } from '@/lib/lab-validation';

/** Institute settings (R6): timezone and name, with who changed them last. */
export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<InstituteSetting[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<SettingKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SettingKey, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .list()
      .then((all) => {
        setSettings(all);
        setDraft(Object.fromEntries(all.map((s) => [s.key, s.value])));
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)));
  }, []);

  const timezone = settings?.find((s) => s.key === 'timezone')?.value ?? 'Asia/Kolkata';
  const zones = useMemo(() => timezoneOptions(timezone), [timezone]);

  const save = async (e: FormEvent, key: SettingKey) => {
    e.preventDefault();
    const value = (draft[key] ?? '').trim();
    if (key === 'instituteName' && value.length < 2) {
      setErrors((p) => ({ ...p, [key]: 'Institute name must be at least 2 characters' }));
      return;
    }
    setErrors((p) => ({ ...p, [key]: undefined }));
    setSaving(key);
    try {
      const updated = await settingsApi.update(key, value);
      setSettings((prev) => prev?.map((s) => (s.key === key ? updated : s)) ?? null);
      setDraft((p) => ({ ...p, [key]: updated.value }));
      if (key === 'timezone') resetInstituteTimezone(updated.value);
      toast({ title: `${updated.label} saved` });
    } catch (err) {
      setErrors((p) => ({ ...p, [key]: getApiErrorMessage(err) }));
    } finally {
      setSaving(null);
    }
  };

  if (loadError) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <p role="alert" className="rounded-md bg-red-50 p-4 text-red-800">
          {loadError}
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex justify-center py-16" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">Institute settings</h1>
      <p className="mb-6 text-sm text-gray-600">Only administrators can change these. Times are stored in UTC and shown in the institute timezone.</p>

      <div className="space-y-6">
        {settings.map((s) => {
          const changed = (draft[s.key] ?? '') !== s.value;
          const inputId = `setting-${s.key}`;
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="text-lg">{s.label}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => save(e, s.key)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor={inputId} className="sr-only">
                      {s.label}
                    </Label>
                    {s.key === 'timezone' ? (
                      <select
                        id={inputId}
                        value={draft[s.key] ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {zones.map((z) => (
                          <option key={z} value={z}>
                            {z.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={inputId}
                        value={draft[s.key] ?? ''}
                        maxLength={100}
                        onChange={(e) => setDraft((p) => ({ ...p, [s.key]: e.target.value }))}
                        aria-invalid={!!errors[s.key]}
                      />
                    )}
                  </div>
                  <Button type="submit" disabled={!changed || saving === s.key} className="gap-2">
                    {saving === s.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </form>
                {errors[s.key] && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {errors[s.key]}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  {s.updatedAt
                    ? `Last changed by ${s.updatedByName ?? 'an administrator'} on ${formatDateTime(s.updatedAt, timezone)}`
                    : 'Using the default value'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
