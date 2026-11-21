import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Mandatory banner for every lab (SRS R09 / T6): identifies the exercise as a
 * simulation and tells learners never to enter real identity documents.
 */
export function SimulationWarning() {
  return (
    <Alert className="mb-6 border-red-500 bg-red-50" role="alert">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertDescription className="text-red-900">
        <strong className="font-bold">TRAINING SIMULATION ONLY</strong>
        <br />
        This is a training simulation with no government connection. All data here is fictional
        and nothing is sent to any official portal.{' '}
        <strong>
          Never enter real Aadhaar, PAN, DIN or any other identity documents or personal
          information.
        </strong>{' '}
        Use the sample data provided or make up fictional values.
      </AlertDescription>
    </Alert>
  );
}
