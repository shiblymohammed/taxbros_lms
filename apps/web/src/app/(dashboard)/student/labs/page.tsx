'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, AlertTriangle, Building2, Receipt, ScrollText } from 'lucide-react';
import { labsApi, type Lab } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const LAB_ICONS = {
  GST_REGISTRATION: Building2,
  INCOME_TAX_RETURN: Receipt,
  MCA_INCORPORATION: ScrollText,
};

const LAB_ROUTES = {
  GST_REGISTRATION: '/student/labs/gst',
  INCOME_TAX_RETURN: '/student/labs/itr',
  MCA_INCORPORATION: '/student/labs/mca',
};

const LAB_COLORS = {
  GST_REGISTRATION: 'from-brand to-cyan-600',
  INCOME_TAX_RETURN: 'from-green-500 to-emerald-600',
  MCA_INCORPORATION: 'from-purple-500 to-indigo-600',
};

export default function LabsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        setLoading(true);
        const labsData = await labsApi.getAllLabs();
        setLabs(labsData);
      } catch (err: any) {
        console.error('Error loading labs:', err);
        toast({
          title: 'Error',
          description: err.response?.data?.message || 'Failed to load labs',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLabs();
  }, [toast]);

  const handleLabClick = (labType: string) => {
    const route = LAB_ROUTES[labType as keyof typeof LAB_ROUTES];
    if (route) {
      router.push(route);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Government Portal Practice Labs
          </h1>
          <p className="text-gray-600">
            Practice government portal procedures in a safe simulation environment
          </p>
        </div>

        {/* Warning Banner */}
        <Alert className="mb-8 border-yellow-500 bg-yellow-50">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-900">
            <strong className="font-bold">Important:</strong> All labs are training simulations only. 
            They have NO connection to actual government portals. Always use fictional data for practice.
          </AlertDescription>
        </Alert>

        {/* Labs Grid */}
        {labs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No labs available</p>
              <p className="text-gray-500 text-sm">
                Labs will appear here once they are activated by your administrator
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => {
              const Icon = LAB_ICONS[lab.type as keyof typeof LAB_ICONS] || FileText;
              const colorClass = LAB_COLORS[lab.type as keyof typeof LAB_COLORS] || 'from-gray-500 to-gray-600';
              
              return (
                <Card
                  key={lab.id}
                  className={`hover:shadow-lg transition-shadow cursor-pointer ${
                    !lab.isActive ? 'opacity-60' : ''
                  }`}
                  onClick={() => lab.isActive && handleLabClick(lab.type)}
                >
                  {/* Lab Icon Header */}
                  <div className={`w-full h-40 bg-gradient-to-br ${colorClass} flex items-center justify-center relative`}>
                    <Icon className="h-20 w-20 text-white opacity-90" />
                    {!lab.isActive && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge variant="secondary">Coming Soon</Badge>
                      </div>
                    )}
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl line-clamp-2 flex-1">
                        {lab.title}
                      </CardTitle>
                      {lab.isActive && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Active
                        </Badge>
                      )}
                    </div>
                    {lab.description && (
                      <CardDescription className="line-clamp-3">
                        {lab.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent>
                    <Button
                      className="w-full"
                      disabled={!lab.isActive}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lab.isActive) handleLabClick(lab.type);
                      }}
                    >
                      {lab.isActive ? 'Start Lab' : 'Not Available'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <Card className="mt-8 bg-brand-soft/50 border-brand-soft">
          <CardHeader>
            <CardTitle className="text-brand-strong">About Practice Labs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-brand-strong space-y-2 list-disc list-inside">
              <li>
                <strong>Safe Environment:</strong> Practice without fear of mistakes affecting real systems
              </li>
              <li>
                <strong>Realistic Simulation:</strong> Forms and validation mirror actual government portals
              </li>
              <li>
                <strong>Fictional Data Only:</strong> Never use real personal information or identity documents
              </li>
              <li>
                <strong>Instant Results:</strong> See simulated outcomes immediately after submission
              </li>
              <li>
                <strong>Unlimited Practice:</strong> Try each lab as many times as you need
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
