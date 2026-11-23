import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuestionEditor } from './question-editor';

const optionInputs = () => screen.getAllByRole('textbox', { name: /^Option \d$/ }) as HTMLInputElement[];

describe('QuestionEditor options (R24)', () => {
  it('edits each option field on its own and saves all four options', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<QuestionEditor saving={false} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Which return?' } });
    const inputs = optionInputs();
    ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'CMP-08'].forEach((text, i) => fireEvent.change(inputs[i], { target: { value: text } }));
    expect(optionInputs().map((i) => i.value)).toEqual(['GSTR-1', 'GSTR-3B', 'GSTR-9', 'CMP-08']);

    fireEvent.click(screen.getByLabelText('Option 2 is correct'));
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.options.map((o: { text: string }) => o.text)).toEqual(['GSTR-1', 'GSTR-3B', 'GSTR-9', 'CMP-08']);
    expect(new Set(payload.options.map((o: { id: string }) => o.id)).size).toBe(4);
    expect(payload.correctAnswer).toBe(payload.options[1].id);
  });

  it('keeps fields independent when editing a question saved with broken options', () => {
    const broken = {
      id: 'q1',
      questionText: 'Old question',
      options: [[], [], [], []] as unknown as Array<{ id: string; text: string }>,
      correctAnswer: 'o1',
      marks: 1,
      displayOrder: 0,
    };
    render(<QuestionEditor question={broken as never} saving={false} onSave={vi.fn()} onCancel={vi.fn()} />);

    const inputs = optionInputs();
    expect(inputs).toHaveLength(4);
    fireEvent.change(inputs[0], { target: { value: 'Only the first' } });
    expect(optionInputs().map((i) => i.value)).toEqual(['Only the first', '', '', '']);
  });

  it('adds and removes options without touching the others', () => {
    render(<QuestionEditor saving={false} onSave={vi.fn()} onCancel={vi.fn()} />);
    const inputs = optionInputs();
    fireEvent.change(inputs[0], { target: { value: 'A' } });
    fireEvent.change(inputs[2], { target: { value: 'C' } });

    fireEvent.click(screen.getByRole('button', { name: 'Remove option 2' }));
    expect(optionInputs().map((i) => i.value)).toEqual(['A', 'C', '']);

    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    fireEvent.change(optionInputs()[3], { target: { value: 'D' } });
    expect(optionInputs().map((i) => i.value)).toEqual(['A', 'C', '', 'D']);
  });
});
