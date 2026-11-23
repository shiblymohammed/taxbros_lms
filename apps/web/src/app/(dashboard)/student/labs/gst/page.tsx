'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, FileText } from 'lucide-react';
import { labsApi, type Lab, type GstFormData, type GstResult } from '@/lib/api';
import { getApiErrorMessage, validateFictionalPan } from '@/lib/lab-validation';
import { useToast } from '@/hooks/use-toast';
import { SimulationWarning } from '@/components/features/labs/simulation-warning';
import { DummyChecklist, allChecked } from '@/components/features/labs/dummy-checklist';

const CHECKLIST = [
  'Proof of business address (dummy electricity bill)',
  'PAN card of the business (fictional)',
  'Photograph of authorised signatory (placeholder)',
  'Letter of authorisation for signatory (dummy)',
];

export default function GstRegistrationLabPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GstResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  
  const [formData, setFormData] = useState<GstFormData>({
    businessName: '',
    businessType: '',
    pan: '',
    address: '',
    signatory: '',
  });

  useEffect(() => {
    const loadLabData = async () => {
      try {
        setLoading(true);
        const labData = await labsApi.getLabByType('GST_REGISTRATION');
        setLab(labData);

        // Pre-fill form with sample data
        if (labData.sampleData) {
          setFormData({
            businessName: labData.sampleData.businessName || '',
            businessType: labData.sampleData.businessType || '',
            pan: labData.sampleData.pan || '',
            address: labData.sampleData.address || '',
            signatory: labData.sampleData.signatory || '',
          });
        }
      } catch (err: any) {
        toast({
          title: 'Error',
          description: getApiErrorMessage(err, 'Failed to load lab data'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadLabData();
  }, [toast]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }

    if (!formData.businessType.trim()) {
      newErrors.businessType = 'Business type is required';
    }

    // Same rule as the API: 10 alphanumerics, and real-looking PANs are rejected
    const panError = validateFictionalPan(formData.pan);
    if (panError) {
      newErrors.pan = panError;
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.signatory.trim()) {
      newErrors.signatory = 'Authorized signatory is required';
    }

    if (!allChecked(CHECKLIST, checklist)) {
      newErrors.checklist = 'Review and tick every document in the checklist';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof GstFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await labsApi.submitGstLab(formData);
      setResult(response.result);
      
      toast({
        title: 'Success',
        description: 'GST Registration simulation completed successfully',
      });
    } catch (err: any) {
      toast({
        title: 'Submission Error',
        description: getApiErrorMessage(err, 'Failed to submit lab attempt'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    // Reset to sample data
    if (lab?.sampleData) {
      setFormData({
        businessName: lab.sampleData.businessName || '',
        businessType: lab.sampleData.businessType || '',
        pan: lab.sampleData.pan || '',
        address: lab.sampleData.address || '',
        signatory: lab.sampleData.signatory || '',
      });
    }
    setResult(null);
    setErrors({});
    setChecklist({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!lab) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <p className="text-red-600 text-lg">Lab not found</p>
        <Button onClick={() => router.push('/student/labs')}>
          Back to Labs
        </Button>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-brand shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{lab.title}</h1>
          </div>
          {lab.description && (
            <p className="text-gray-600">{lab.description}</p>
          )}
        </div>

        <SimulationWarning />

        {/* Result Display */}
        {result && (
          <Card className="mb-6 border-green-500 bg-green-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <CardTitle className="text-green-900">Registration Successful (Simulated)</CardTitle>
              </div>
              <CardDescription className="text-green-800">
                Your GST registration simulation has been completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <Label className="text-sm font-medium text-gray-600">GSTIN</Label>
                  <p className="text-lg sm:text-xl font-mono font-bold text-gray-900 mt-1 break-all">
                    {result.gstin}
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <Label className="text-sm font-medium text-gray-600">ARN</Label>
                  <p className="text-lg sm:text-xl font-mono font-bold text-gray-900 mt-1 break-all">
                    {result.arn}
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <Label className="text-sm font-medium text-gray-600">Application Date</Label>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {result.applicationDate}
                  </p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <Badge className="mt-1 bg-green-600">{result.status}</Badge>
                </div>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={() => router.push('/student/labs')} className="flex-1">
                  Back to Labs
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {!result && (
          <Card>
            <CardHeader>
              <CardTitle>GST Registration Form</CardTitle>
              <CardDescription>
                Complete the form below with the pre-filled sample data or create your own fictional data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Business Name */}
                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    placeholder="Enter business name"
                    className={errors.businessName ? 'border-red-500' : ''}
                  />
                  {errors.businessName && (
                    <p className="text-sm text-red-600">{errors.businessName}</p>
                  )}
                </div>

                {/* Business Type */}
                <div className="space-y-2">
                  <Label htmlFor="businessType">
                    Business Type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessType"
                    value={formData.businessType}
                    onChange={(e) => handleInputChange('businessType', e.target.value)}
                    placeholder="e.g., Private Limited, Partnership, Sole Proprietorship"
                    className={errors.businessType ? 'border-red-500' : ''}
                  />
                  {errors.businessType && (
                    <p className="text-sm text-red-600">{errors.businessType}</p>
                  )}
                </div>

                {/* PAN */}
                <div className="space-y-2">
                  <Label htmlFor="pan">
                    PAN <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                    placeholder="TEST12345T (fictional pattern)"
                    maxLength={10}
                    className={errors.pan ? 'border-red-500' : ''}
                  />
                  {errors.pan && (
                    <p className="text-sm text-red-600">{errors.pan}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Use a fictional PAN only (e.g., TEST12345T, DEMO98765D, TRAIN0000R)
                  </p>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">
                    Business Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter business address"
                    className={errors.address ? 'border-red-500' : ''}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-600">{errors.address}</p>
                  )}
                </div>

                {/* Authorized Signatory */}
                <div className="space-y-2">
                  <Label htmlFor="signatory">
                    Authorized Signatory <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="signatory"
                    value={formData.signatory}
                    onChange={(e) => handleInputChange('signatory', e.target.value)}
                    placeholder="Enter authorized signatory name"
                    className={errors.signatory ? 'border-red-500' : ''}
                  />
                  {errors.signatory && (
                    <p className="text-sm text-red-600">{errors.signatory}</p>
                  )}
                </div>

                <DummyChecklist
                  items={CHECKLIST}
                  checked={checklist}
                  onChange={(item, v) => {
                    setChecklist((prev) => ({ ...prev, [item]: v }));
                    if (errors.checklist) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.checklist;
                        return next;
                      });
                    }
                  }}
                  error={errors.checklist}
                />

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                    disabled={submitting}
                  >
                    Reset to Sample Data
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-6 bg-brand-soft/50 border-brand-soft">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-brand-strong mb-2">About this Lab</h3>
            <ul className="text-sm text-brand-strong space-y-1 list-disc list-inside">
              <li>This simulation demonstrates the GST registration process</li>
              <li>All generated GSTIN and ARN numbers are fictional</li>
              <li>The form imitates the kind of information a registration asks for</li>
              <li>Use this lab to practice before handling real registrations</li>
              <li>No data from this simulation is submitted to any government system</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
