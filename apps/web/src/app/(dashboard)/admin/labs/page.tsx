'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, CheckCircle2, Loader2, Pencil, Receipt, RefreshCw, ScrollText, XCircle } from 'lucide-react';
import { labsApi, type Lab, type LabType } from '@/lib/api';
import { getApiErrorMessage, validateSampleData } from '@/lib/lab-validation';
import { useToast } from '@/hooks/use-toast';

/**
 * Administrator lab management (Task 57, Requirement R27)
 *
 * - One card per lab with an active/inactive toggle
 * - JSON editor for each lab's fictional sample data
 * - Validation preview before saving (same rules the student form enforces)
 */

const LAB_META: Record<LabType, { icon: typeof Building2; color: string; route: string }> = {
  GST_REGISTRATION: { icon: Building2, color: 'text-blue-600 bg-blue-50', route: '/student/labs/gst' },
  INCOME_TAX_RETURN: { icon: Receipt, color: 'text-green-600 bg-green-50', route: '/student/labs/itr' },
  MCA_INCORPORATION: { icon: ScrollText, color: 'text-purple-600 bg-purple-50', route: '/student/labs/mca' },
};

type ParseState =
  | { ok: true; value: Record<string, unknown>; problems: string[] }
  | { ok: false; error: string };

function parseSample(type: LabType, text: string): ParseState {
  try {
    const value = JSON.parse(text);
    return { ok: true, value, problems: validateSampleData(type, value) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

export default function AdminLabsPage() {
  const { toast } = useToast();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingType, setTogglingType] = useState<LabType | null>(null);

  const [editing, setEditing] = useState<Lab | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const all = await labsApi.getAllLabs();
      // The list endpoint omits sampleData; fetch details for each lab
      const detailed = await Promise.all(all.map((l) => labsApi.getLabByType(l.type)));
      setLabs(detailed);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Failed to load labs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [fetchLabs]);

  const handleToggle = async (lab: Lab) => {
    const nextActive = !lab.isActive;
    setTogglingType(lab.type);
    // Optimistic update
    setLabs((prev) => prev.map((l) => (l.type === lab.type ? { ...l, isActive: nextActive } : l)));
    try {
      await labsApi.updateLabStatus(lab.type, nextActive);
      toast({
        title: nextActive ? 'Lab activated' : 'Lab deactivated',
        description: nextActive
          ? `${lab.title} is now visible to students.`
          : `${lab.title} is hidden from students.`,
      });
    } catch (err) {
      setLabs((prev) => prev.map((l) => (l.type === lab.type ? { ...l, isActive: lab.isActive } : l)));
      toast({
        title: 'Could not update lab',
        description: getApiErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setTogglingType(null);
    }
  };

  const openEditor = (lab: Lab) => {
    setEditing(lab);
    setDraft(JSON.stringify(lab.sampleData ?? {}, null, 2));
  };

  const parsed = useMemo<ParseState | null>(
    () => (editing ? parseSample(editing.type, draft) : null),
    [editing, draft],
  );
  const canSave = !!parsed && parsed.ok && parsed.problems.length === 0 && !saving;

  const handleSave = async () => {
    if (!editing || !parsed || !parsed.ok || parsed.problems.length) return;
    setSaving(true);
    try {
      const updated = await labsApi.updateSampleData(editing.type, parsed.value);
      setLabs((prev) => prev.map((l) => (l.type === editing.type ? { ...l, ...updated } : l)));
      toast({ title: 'Sample data saved', description: `Students will see the new data in ${editing.title}.` });
      setEditing(null);
    } catch (err) {
      toast({ title: 'Save failed', description: getApiErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleFormat = () => {
    if (parsed?.ok) setDraft(JSON.stringify(parsed.value, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lab Management</h1>
            <p className="text-gray-600">
              Turn practice labs on or off and edit the fictional sample data students start with.
            </p>
          </div>
          <Button variant="outline" onClick={fetchLabs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-red-600">{loadError}</p>
              <Button onClick={fetchLabs}>Try again</Button>
            </CardContent>
          </Card>
        ) : labs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              No labs found. Run the lab seed script (<code>scripts/seed-labs.ts</code>) to create them.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => {
              const meta = LAB_META[lab.type];
              const Icon = meta?.icon ?? Building2;
              const problems = validateSampleData(lab.type, lab.sampleData);
              return (
                <Card key={lab.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`rounded-lg p-3 ${meta?.color ?? 'bg-gray-50 text-gray-600'}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge className={lab.isActive ? 'bg-green-600' : 'bg-gray-500'}>
                        {lab.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-lg">{lab.title}</CardTitle>
                    {lab.description && <CardDescription className="line-clamp-3">{lab.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="mt-auto space-y-4">
                    {problems.length > 0 ? (
                      <p className="flex items-start gap-2 text-sm text-amber-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        Sample data has {problems.length} issue{problems.length === 1 ? '' : 's'}. Edit to fix.
                      </p>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle2 className="h-4 w-4" /> Sample data is valid
                      </p>
                    )}

                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border px-3">
                      <span className="text-sm font-medium text-gray-800">Visible to students</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={lab.isActive}
                        aria-label={`${lab.isActive ? 'Deactivate' : 'Activate'} ${lab.title}`}
                        disabled={togglingType === lab.type}
                        onClick={() => handleToggle(lab)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          lab.isActive ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            lab.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="flex-1" onClick={() => openEditor(lab)}>
                        <Pencil className="h-4 w-4" /> Edit Sample Data
                      </Button>
                      {meta && (
                        <Button variant="ghost" className="flex-1" asChild>
                          <a href={meta.route} target="_blank" rel="noreferrer">
                            Preview
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit sample data: {editing?.title}</DialogTitle>
            <DialogDescription>
              Use fictional values only. PANs must be fictional (e.g. TEST00000T) and DINs must contain a letter
              (e.g. TEST0001).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              aria-label="Sample data JSON"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={16}
              className="font-mono text-xs sm:text-sm"
            />

            {/* Validation preview */}
            <div
              className={`rounded-md border p-3 text-sm ${
                !parsed
                  ? ''
                  : !parsed.ok
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : parsed.problems.length
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-green-300 bg-green-50 text-green-800'
              }`}
              role="status"
              aria-live="polite"
            >
              {parsed && !parsed.ok && <p>Invalid JSON: {parsed.error}</p>}
              {parsed && parsed.ok && parsed.problems.length === 0 && (
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Valid. Students will be able to submit this sample as-is.
                </p>
              )}
              {parsed && parsed.ok && parsed.problems.length > 0 && (
                <>
                  <p className="font-medium">Fix these before saving:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {parsed.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={handleFormat} disabled={!parsed?.ok || saving}>
              Format JSON
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save Sample Data'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
