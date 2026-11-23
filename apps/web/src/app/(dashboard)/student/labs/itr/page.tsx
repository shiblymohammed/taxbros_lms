'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Receipt, Calculator } from 'lucide-react';
import { labsApi, type Lab, type ItrFormData, type ItrResult } from '@/lib/api';
import {
  calculateIllustrativeTax,
  formatINR,
  getApiErrorMessage,
  nonNegativeNumber,
  requiredText,
  validateFictionalPan,
} from '@/lib/lab-validation';
import { useToast } from '@/hooks/use-toast';
import { SimulationWarning } from '@/components/features/labs/simulation-warning';
import { FormField } from '@/components/features/labs/form-field';

/**
 * Income Tax Return filing lab (Task 55, Requirement R29)
 *
 * Fictional taxpayer profile -> income & deductions -> live illustrative tax
 * calculation -> mock filing with a simulated acknowledgement number.
 */

type ItrFormState = {
  taxpayerName: string;
  pan: string;
  incomeSource: string;
  grossIncome: string;
  deductions: string;
};

const EMPTY_FORM: ItrFormState = {
  taxpayerName: '',
  pan: '',
  incomeSource: '',
  grossIncome: '',
  deductions: '',
};

const INCOME_SOURCES = ['Salary', 'Business / Profession', 'House Property', 'Capital Gains', 'Other Sources'];

function fromSample(sample: Record<string, any> | undefined): ItrFormState {
  if (!sample) return EMPTY_FORM;
  return {
    taxpayerName: sample.taxpayerName ?? '',
    pan: sample.pan ?? '',
    incomeSource: sample.incomeSource ?? '',
    grossIncome: sample.grossIncome !== undefined ? String(sample.grossIncome) : '',
    deductions: sample.deductions !== undefined ? String(sample.deductions) : '',
  };
}

export default function ItrFilingLabPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ItrResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ItrFormState, string>>>({});
  const [form, setForm] = useState<ItrFormState>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await labsApi.getLabByType('INCOME_TAX_RETURN');
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

  // Real-time illustrative calculation preview
  const preview = useMemo(
    () => calculateIllustrativeTax(Number(form.grossIncome) || 0, Number(form.deductions) || 0),
    [form.grossIncome, form.deductions],
  );

  const validate = (): boolean => {
    const next: Partial<Record<keyof ItrFormState, string>> = {};
    const set = (k: keyof ItrFormState, msg: string | null) => {
      if (msg) next[k] = msg;
    };
    set('taxpayerName', requiredText(form.taxpayerName, 'Taxpayer name'));
    set('pan', validateFictionalPan(form.pan));
    set('incomeSource', requiredText(form.incomeSource, 'Income source'));
    set('grossIncome', nonNegativeNumber(form.grossIncome, 'Gross income'));
    set('deductions', nonNegativeNumber(form.deductions, 'Deductions'));
    if (!next.grossIncome && !next.deductions && Number(form.deductions) > Number(form.grossIncome)) {
      next.deductions = 'Deductions cannot exceed gross income';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const update = (field: keyof ItrFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast({
        title: 'Please check the form',
        description: 'Some fields need attention before you can file.',
        variant: 'destructive',
      });
      return;
    }

    const payload: ItrFormData = {
      taxpayerName: form.taxpayerName.trim(),
      pan: form.pan.trim().toUpperCase(),
      incomeSource: form.incomeSource.trim(),
      grossIncome: Number(form.grossIncome),
      deductions: Number(form.deductions),
    };

    try {
      setSubmitting(true);
      const response = await labsApi.submitItrLab(payload);
      setResult(response.result);
      toast({ title: 'Return filed (simulated)', description: 'Your mock ITR was submitted.' });
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: getApiErrorMessage(err, 'Failed to submit the return'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(fromSample(lab?.sampleData));
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

  const calc = result?.calculation ?? preview;

  return (
    <div className="py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-7 w-7 sm:h-8 sm:w-8 text-green-600 shrink-0" />
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
                <CardTitle className="text-green-900">Return Filed (Simulated)</CardTitle>
              </div>
              <CardDescription className="text-green-800">
                This acknowledgement is fictional and has no legal validity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ResultTile label="Acknowledgement Number">
                  <p className="text-lg sm:text-xl font-mono font-bold break-all">
                    {result.acknowledgementNumber}
                  </p>
                </ResultTile>
                <ResultTile label="Status">
                  <Badge className="mt-1 bg-green-600">{result.status}</Badge>
                </ResultTile>
                <ResultTile label="Taxpayer">
                  <p className="font-semibold">{result.taxpayerName}</p>
                  <p className="font-mono text-sm text-gray-600">{result.pan}</p>
                </ResultTile>
                <ResultTile label="Filing Date">
                  <p className="font-semibold">
                    {new Date(result.filingDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </ResultTile>
              </div>
              <TaxBreakdown calc={calc} />
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  File Another Return
                </Button>
                <Button onClick={() => router.push('/student/labs')} className="flex-1">
                  Back to Labs
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Mock ITR Form</CardTitle>
                <CardDescription>
                  Pre-filled with a fictional taxpayer. Change the figures to see how the tax changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <FormField id="taxpayerName" label="Taxpayer Name" required error={errors.taxpayerName}>
                    <Input
                      id="taxpayerName"
                      value={form.taxpayerName}
                      onChange={(e) => update('taxpayerName', e.target.value)}
                      aria-invalid={!!errors.taxpayerName}
                      className={errors.taxpayerName ? 'border-red-500' : ''}
                    />
                  </FormField>

                  <FormField
                    id="pan"
                    label="PAN (fictional)"
                    required
                    error={errors.pan}
                    hint="Use a fictional PAN such as TEST00000T or DEMO98765D"
                  >
                    <Input
                      id="pan"
                      value={form.pan}
                      onChange={(e) => update('pan', e.target.value.toUpperCase())}
                      maxLength={10}
                      autoComplete="off"
                      aria-invalid={!!errors.pan}
                      className={`font-mono ${errors.pan ? 'border-red-500' : ''}`}
                    />
                  </FormField>

                  <FormField id="incomeSource" label="Primary Income Source" required error={errors.incomeSource}>
                    <Input
                      id="incomeSource"
                      list="income-sources"
                      value={form.incomeSource}
                      onChange={(e) => update('incomeSource', e.target.value)}
                      aria-invalid={!!errors.incomeSource}
                      className={errors.incomeSource ? 'border-red-500' : ''}
                    />
                    <datalist id="income-sources">
                      {INCOME_SOURCES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField id="grossIncome" label="Gross Income (₹)" required error={errors.grossIncome}>
                      <Input
                        id="grossIncome"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={form.grossIncome}
                        onChange={(e) => update('grossIncome', e.target.value)}
                        aria-invalid={!!errors.grossIncome}
                        className={errors.grossIncome ? 'border-red-500' : ''}
                      />
                    </FormField>
                    <FormField id="deductions" label="Deductions (₹)" required error={errors.deductions}>
                      <Input
                        id="deductions"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={form.deductions}
                        onChange={(e) => update('deductions', e.target.value)}
                        aria-invalid={!!errors.deductions}
                        className={errors.deductions ? 'border-red-500' : ''}
                      />
                    </FormField>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleReset} className="flex-1" disabled={submitting}>
                      Reset to Sample Data
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Filing…
                        </>
                      ) : (
                        'File Mock Return'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 h-fit lg:sticky lg:top-20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Illustrative Calculation</CardTitle>
                </div>
                <CardDescription>Updates as you type. Simplified slabs for training only.</CardDescription>
              </CardHeader>
              <CardContent>
                <TaxBreakdown calc={preview} />
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mt-6 bg-brand-soft/50 border-brand-soft">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-brand-strong mb-2">About this Lab</h3>
            <ul className="text-sm text-brand-strong space-y-1 list-disc list-inside">
              <li>The calculation uses simplified, illustrative slabs, not current tax law</li>
              <li>Acknowledgement numbers are generated randomly and are fictional</li>
              <li>No data from this simulation is sent to the Income Tax Department</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-green-200">
      <Label className="text-sm font-medium text-gray-600">{label}</Label>
      <div className="mt-1 text-gray-900">{children}</div>
    </div>
  );
}

function TaxBreakdown({
  calc,
}: {
  calc: { grossIncome: number; deductions: number; taxableIncome: number; taxAmount: number; taxBrackets: Array<{ from: number; to: number | null; rate: number; taxOnBracket: number }> };
}) {
  return (
    <div className="space-y-3 text-sm">
      <Row label="Gross income" value={formatINR(calc.grossIncome)} />
      <Row label="Less: deductions" value={`− ${formatINR(calc.deductions)}`} />
      <Row label="Taxable income" value={formatINR(calc.taxableIncome)} strong />
      <div className="border-t pt-3 space-y-2">
        {calc.taxBrackets.length === 0 ? (
          <p className="text-gray-500">No tax: taxable income is within the 0% slab (up to ₹2,50,000).</p>
        ) : (
          calc.taxBrackets.map((b) => (
            <Row
              key={b.from}
              label={`${b.rate}% on ${formatINR(b.from)} – ${b.to === null ? 'above' : formatINR(b.to)}`}
              value={formatINR(b.taxOnBracket)}
            />
          ))
        )}
      </div>
      <div className="border-t pt-3">
        <Row label="Illustrative tax payable" value={formatINR(calc.taxAmount)} strong />
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}
