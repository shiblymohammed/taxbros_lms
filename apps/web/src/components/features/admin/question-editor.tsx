'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdminQuizQuestion, QuestionPayload, QuizOption } from '@/lib/admin-api';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

let nextOptionSeq = 0;
const newOptionId = () => `opt-${Date.now().toString(36)}-${(nextOptionSeq++).toString(36)}`;

/**
 * Editable copies of saved options. Every option needs its own id (React key and the field it
 * updates); options saved without one by an older API bug get a fresh id and keep their text.
 */
export function normaliseOptions(options: unknown): QuizOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  return options.map((raw) => {
    const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<QuizOption>;
    const id = typeof o.id === 'string' && o.id && !seen.has(o.id) ? o.id : newOptionId();
    seen.add(id);
    return { id, text: typeof o.text === 'string' ? o.text : '' };
  });
}

/** Validates a question (R24.1–R24.4): text, 2–6 non-empty unique options, one correct answer, marks ≥ 1. */
export function validateQuestion(text: string, options: QuizOption[], correct: string, marks: string): string | null {
  if (!text.trim()) return 'Enter the question text.';
  if (options.length < MIN_OPTIONS) return `Add at least ${MIN_OPTIONS} options.`;
  if (options.some((o) => !o.text.trim())) return 'Fill in every option or remove the empty ones.';
  const texts = options.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) return 'Two options have the same text.';
  if (!options.some((o) => o.id === correct)) return 'Choose the correct answer.';
  const m = Number(marks);
  if (!Number.isInteger(m) || m < 1) return 'Marks must be a whole number of at least 1.';
  return null;
}

interface Props {
  question?: AdminQuizQuestion;
  saving: boolean;
  onSave: (payload: QuestionPayload) => Promise<void>;
  onCancel: () => void;
}

export function QuestionEditor({ question, saving, onSave, onCancel }: Props) {
  const [text, setText] = useState(question?.questionText ?? '');
  const [options, setOptions] = useState<QuizOption[]>(
    question ? normaliseOptions(question.options) : [
      { id: newOptionId(), text: '' },
      { id: newOptionId(), text: '' },
      { id: newOptionId(), text: '' },
      { id: newOptionId(), text: '' },
    ],
  );
  const [correct, setCorrect] = useState(question?.correctAnswer ?? '');
  const [marks, setMarks] = useState(String(question?.marks ?? 1));
  const [error, setError] = useState<string | null>(null);
  const prefix = question?.id ?? 'new';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateQuestion(text, options, correct, marks);
    setError(problem);
    if (problem) return;
    await onSave({
      questionText: text.trim(),
      options: options.map((o) => ({ id: o.id, text: o.text.trim() })),
      correctAnswer: correct,
      marks: Number(marks),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border bg-gray-50 p-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-text`}>Question</Label>
        <Textarea id={`${prefix}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={saving} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Options (select the correct answer)</legend>
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${prefix}-correct`}
              className="h-5 w-5 shrink-0 accent-green-600"
              checked={correct === option.id}
              onChange={() => setCorrect(option.id)}
              aria-label={`Option ${index + 1} is correct`}
              disabled={saving}
            />
            <Input
              value={option.text}
              onChange={(e) =>
                setOptions((prev) => prev.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)))
              }
              placeholder={`Option ${index + 1}`}
              aria-label={`Option ${index + 1}`}
              disabled={saving}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove option ${index + 1}`}
              disabled={saving || options.length <= MIN_OPTIONS}
              onClick={() => {
                setOptions((prev) => prev.filter((o) => o.id !== option.id));
                if (correct === option.id) setCorrect('');
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={saving}
            onClick={() => setOptions((prev) => [...prev, { id: newOptionId(), text: '' }])}
          >
            <Plus className="h-4 w-4" /> Add option
          </Button>
        )}
      </fieldset>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-32 space-y-1.5">
          <Label htmlFor={`${prefix}-marks`}>Marks</Label>
          <Input
            id={`${prefix}-marks`}
            type="number"
            min={1}
            inputMode="numeric"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {question ? 'Save question' : 'Add question'}
          </Button>
        </div>
      </div>
    </form>
  );
}
