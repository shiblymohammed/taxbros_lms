'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ScrollText, Plus, Trash2 } from 'lucide-react';
import { labsApi, type Lab, type McaFormData, type McaResult } from '@/lib/api';
import {
  getApiErrorMessage,
  nonNegativeNumber,
  requiredText,
  validateEmail,
  validateFictionalDin,
} from '@/lib/lab-validation';
import { useToast } from '@/hooks/use-toast';
import { SimulationWarning } from '@/components/features/labs/simulation-warning';
import { FormField } from '@/components/features/labs/form-field';
import { DummyChecklist, allChecked } from '@/components/features/labs/dummy-checklist';

/**
 * MCA company incorporation lab (Task 56, Requirement R30)
 *
 * Company, director and registered-office details -> dummy checklist ->
 * validation -> simulated Certificate of Incorporation with a fictional CIN.
 */

interface DirectorState {
  key: number;
  name: string;
  din: string;
  email: string;
  address: string;
}

interface McaFormState {
  companyName: string;
  registeredAddress: string;
  city: string;
  state: string;
  pincode: string;
  authorizedCapital: string;
  directors: DirectorState[];
}

type Errors = Record<string, string>;

const CHECKLIST = [
  'Proof of registered office (dummy rent agreement)',
  'Utility bill for registered office (dummy)',
  'Memorandum of Association (MoA) draft',
  'Articles of Association (AoA) draft',
  'Director consent forms (dummy DIR-2)',
];

let directorKey = 0;
const newDirector = (d: Partial<DirectorState> = {}): DirectorState => ({
  key: ++directorKey,
  name: d.name ?? '',
  din: d.din ?? '',
  email: d.email ?? '',
  address: d.address ?? '',
});

function fromSample(sample: Record<string, any> | undefined): McaFormState {
  const s = sample ?? {};
  const directors = Array.isArray(s.directors) && s.directors.length
    ? s.directors.map((d: any) => newDirector(d))
    : [newDirector()];
  return {
    companyName: s.companyName ?? '',
    registeredAddress: s.registeredAddress ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    pincode: s.pincode ?? '',
    authorizedCapital: s.authorizedCapital !== undefined ? String(s.authorizedCapital) : '',
    directors,
  };
}

export default function McaIncorporationLabPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<McaResult | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<McaFormState>(() => fromSample(undefined));
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await labsApi.getLabByType('MCA_INCORPORATION');
        if (cancelled) return;
        setLab(data);
        setForm(fromSample(data.sampleData));
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Failed to load lab'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const updateField = (field: Exclude<keyof McaFormState, 'directors'>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const updateDirector = (index: number, field: keyof Omit<DirectorState, 'key'>, value: string) => {
    setForm((prev) => ({
      ...prev,
      directors: prev.directors.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }));
    clearError(`directors.${index}.${field}`);
  };

  const addDirector = () => {
    setForm((prev) => ({ ...prev, directors: [...prev.directors, newDirector()] }));
    clearError('directors');
  };

  const removeDirector = (index: number) => {
    setForm((prev) => ({ ...prev, directors: prev.directors.filter((_, i) => i !== index) }));
    // Director error keys are index-based, so re-validate on next submit
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('directors.'))),
    );
  };

  const validate = (): boolean => {
    const next: Errors = {};
    const set = (k: string, msg: string | null) => {
      if (msg) next[k] = msg;
    };
    set('companyName', requiredText(form.companyName, 'Company name'));
    set('registeredAddress', requiredText(form.registeredAddress, 'Registered office address'));
    set('authorizedCapital', nonNegativeNumber(form.authorizedCapital, 'Authorised capital'));
    if (form.pincode && !/^\d{6}$/.test(form.pincode.trim())) {
      next.pincode = 'Pincode must be 6 digits';
    }
    if (form.directors.length === 0) {
      next.directors = 'At least one director is required';
    }
    const dins = new Set<string>();
    form.directors.forEach((d, i) => {
      set(`directors.${i}.name`, requiredText(d.name, 'Director name'));
      const dinError = validateFictionalDin(d.din);
      set(`directors.${i}.din`, dinError);
      const din = d.din.trim().toUpperCase();
      if (!dinError && dins.has(din)) next[`directors.${i}.din`] = 'Each director needs a different DIN';
      dins.add(din);
      set(`directors.${i}.email`, validateEmail(d.email));
    });
    if (!allChecked(CHECKLIST, checklist)) {
      next.checklist = 'Review and tick every document in the checklist';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast({
        title: 'Please correct the highlighted fields',
        description: 'Fix the errors and submit again.',
        variant: 'destructive',
      });
      return;
    }

    const payload: McaFormData = {
      companyName: form.companyName.trim(),
      registeredAddress: form.registeredAddress.trim(),
      authorizedCapital: Number(form.authorizedCapital),
      directors: form.directors.map((d) => ({
        name: d.name.trim(),
        din: d.din.trim().toUpperCase(),
        email: d.email.trim(),
        ...(d.address.trim() ? { address: d.address.trim() } : {}),
      })),
      ...(form.city.trim() ? { city: form.city.trim() } : {}),
      ...(form.state.trim() ? { state: form.state.trim() } : {}),
      ...(form.pincode.trim() ? { pincode: form.pincode.trim() } : {}),
    };

    try {
      setSubmitting(true);
      const response = await labsApi.submitMcaLab(payload);
      setResult(response.result);
      toast({ title: 'Incorporation approved (simulated)', description: 'A fictional CIN was issued.' });
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: getApiErrorMessage(err, 'Failed to submit the application'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(fromSample(lab?.sampleData));
    setChecklist({});
    setErrors({});
    setResult(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="sr-only">Loading lab…</span>
      </div>
    );
  }

  if (!lab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <p className="text-red-600 text-lg">{loadError ?? 'Lab not found'}</p>
        <Button onClick={() => router.push('/student/labs')}>Back to Labs</Button>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="h-7 w-7 sm:h-8 sm:w-8 text-purple-600 shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{lab.title}</h1>
          </div>
          {lab.description && <p className="text-gray-600">{lab.description}</p>}
        </div>

        <SimulationWarning />

        {result ? (
          <Card className="mb-6 border-green-500 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <CardTitle className="text-green-900">Certificate of Incorporation (Simulated)</CardTitle>
              </div>
              <CardDescription className="text-green-800">
                This certificate is fictional and has no legal validity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-green-300 bg-white p-4 sm:p-6 text-center">
                <p className="text-sm uppercase tracking-wide text-gray-500">This is to certify that</p>
                <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900 break-words">{result.companyName}</p>
                <p className="mt-2 text-sm text-gray-600">is incorporated (in this training simulation only)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Tile label="Corporate Identity Number (CIN)">
                  <p className="text-base sm:text-lg font-mono font-bold break-all">{result.cin}</p>
                </Tile>
                <Tile label="Registration Number">
                  <p className="text-base sm:text-lg font-mono font-bold">{result.registrationNumber}</p>
                </Tile>
                <Tile label="Certificate Date">
                  <p className="font-semibold">
                    {new Date(result.certificateDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </Tile>
                <Tile label="Status">
                  <Badge className="mt-1 bg-green-600">Incorporated (Simulated)</Badge>
                </Tile>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={() => router.push('/student/labs')} className="flex-1">
                  Back to Labs
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {errorCount > 0 && (
              <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
                {errorCount} field{errorCount === 1 ? '' : 's'} need{errorCount === 1 ? 's' : ''} correcting.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>Use a fictional company name.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField id="companyName" label="Proposed Company Name" required error={errors.companyName}>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    aria-invalid={!!errors.companyName}
                    className={errors.companyName ? 'border-red-500' : ''}
                  />
                </FormField>
                <FormField id="authorizedCapital" label="Authorised Capital (₹)" required error={errors.authorizedCapital}>
                  <Input
                    id="authorizedCapital"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={form.authorizedCapital}
                    onChange={(e) => updateField('authorizedCapital', e.target.value)}
                    aria-invalid={!!errors.authorizedCapital}
                    className={errors.authorizedCapital ? 'border-red-500' : ''}
                  />
                </FormField>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Directors</CardTitle>
                    <CardDescription>At least one director. Use fictional DINs such as TEST0001.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addDirector} className="sm:w-auto">
                    <Plus className="h-4 w-4" /> Add Director
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.directors && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.directors}
                  </p>
                )}
                {form.directors.map((d, i) => (
                  <div key={d.key} className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Director {i + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDirector(i)}
                        disabled={form.directors.length === 1}
                        aria-label={`Remove director ${i + 1}`}
                        title={form.directors.length === 1 ? 'At least one director is required' : 'Remove director'}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField id={`director-${d.key}-name`} label="Full Name" required error={errors[`directors.${i}.name`]}>
                        <Input
                          id={`director-${d.key}-name`}
                          value={d.name}
                          onChange={(e) => updateDirector(i, 'name', e.target.value)}
                          aria-invalid={!!errors[`directors.${i}.name`]}
                          className={errors[`directors.${i}.name`] ? 'border-red-500' : ''}
                        />
                      </FormField>
                      <FormField id={`director-${d.key}-din`} label="DIN (fictional)" required error={errors[`directors.${i}.din`]}>
                        <Input
                          id={`director-${d.key}-din`}
                          value={d.din}
                          maxLength={8}
                          autoComplete="off"
                          onChange={(e) => updateDirector(i, 'din', e.target.value.toUpperCase())}
                          aria-invalid={!!errors[`directors.${i}.din`]}
                          className={`font-mono ${errors[`directors.${i}.din`] ? 'border-red-500' : ''}`}
                        />
                      </FormField>
                      <FormField id={`director-${d.key}-email`} label="Email" required error={errors[`directors.${i}.email`]} hint="Use a fictional address, e.g. director1@example.com">
                        <Input
                          id={`director-${d.key}-email`}
                          type="email"
                          inputMode="email"
                          value={d.email}
                          onChange={(e) => updateDirector(i, 'email', e.target.value)}
                          aria-invalid={!!errors[`directors.${i}.email`]}
                          className={errors[`directors.${i}.email`] ? 'border-red-500' : ''}
                        />
                      </FormField>
                      <FormField id={`director-${d.key}-address`} label="Address (optional)">
                        <Input
                          id={`director-${d.key}-address`}
                          value={d.address}
                          onChange={(e) => updateDirector(i, 'address', e.target.value)}
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registered Office</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField id="registeredAddress" label="Address" required error={errors.registeredAddress}>
                  <Input
                    id="registeredAddress"
                    value={form.registeredAddress}
                    onChange={(e) => updateField('registeredAddress', e.target.value)}
                    aria-invalid={!!errors.registeredAddress}
                    className={errors.registeredAddress ? 'border-red-500' : ''}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField id="city" label="City">
                    <Input id="city" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
                  </FormField>
                  <FormField id="state" label="State">
                    <Input id="state" value={form.state} onChange={(e) => updateField('state', e.target.value)} />
                  </FormField>
                  <FormField id="pincode" label="Pincode" error={errors.pincode}>
                    <Input
                      id="pincode"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) => updateField('pincode', e.target.value.replace(/\D/g, ''))}
                      aria-invalid={!!errors.pincode}
                      className={errors.pincode ? 'border-red-500' : ''}
                    />
                  </FormField>
                </div>
              </CardContent>
            </Card>

            <DummyChecklist
              items={CHECKLIST}
              checked={checklist}
              onChange={(item, v) => {
                setChecklist((prev) => ({ ...prev, [item]: v }));
                clearError('checklist');
              }}
              error={errors.checklist}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="button" variant="outline" onClick={handleReset} className="flex-1" disabled={submitting}>
                Reset to Sample Data
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit Incorporation Application'
                )}
              </Button>
            </div>
          </form>
        )}

        <Card className="mt-6 bg-brand-soft/50 border-brand-soft">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-brand-strong mb-2">About this Lab</h3>
            <ul className="text-sm text-brand-strong space-y-1 list-disc list-inside">
              <li>Practise the information an incorporation application asks for</li>
              <li>CINs and registration numbers are randomly generated and fictional</li>
              <li>No data from this simulation is sent to the Ministry of Corporate Affairs</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-green-200">
      <Label className="text-sm font-medium text-gray-600">{label}</Label>
      <div className="mt-1 text-gray-900">{children}</div>
    </div>
  );
}
