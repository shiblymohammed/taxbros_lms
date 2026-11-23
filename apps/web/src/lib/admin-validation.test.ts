import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, marksSummary } from './admin-api';
import { meetsPasswordPolicy } from './password-policy';
import { validateUserForm } from '@/components/features/admin/user-form-dialog';
import { normaliseOptions, validateQuestion } from '@/components/features/admin/question-editor';
import { emptyQuizSettings, toQuizPayload } from '@/components/features/admin/quiz-settings-form';

describe('password policy (mirrors the API, R36.2)', () => {
  it('accepts strong and rejects weak passwords', () => {
    expect(meetsPasswordPolicy('N3w#Password')).toBe(true);
    expect(meetsPasswordPolicy('password1!')).toBe(false); // no uppercase
    expect(meetsPasswordPolicy('Password!')).toBe(false); // no number
    expect(meetsPasswordPolicy('Password1')).toBe(false); // no special
    expect(meetsPasswordPolicy('Pa1!')).toBe(false); // too short
  });

  it('generates temporary passwords that meet the policy', () => {
    for (let i = 0; i < 100; i++) expect(meetsPasswordPolicy(generateTemporaryPassword())).toBe(true);
  });
});

describe('validateUserForm (R1.1–R1.3)', () => {
  const base = {
    role: 'STUDENT' as const,
    email: 'a@taxbros.test',
    password: 'Temp#Pass12',
    firstName: 'Aarav',
    lastName: 'Pillai',
    phoneNumber: '',
    admissionId: 'TB-1',
    admissionDate: '2026-06-01',
    staffId: '',
    designation: '',
    department: '',
    category: 'TEACHING' as const,
    joiningDate: '2026-01-01',
  };

  it('accepts a complete student', () => {
    expect(validateUserForm(base, false)).toEqual({});
  });

  it('requires admission ID for students and staff fields for staff', () => {
    expect(validateUserForm({ ...base, admissionId: ' ' }, false)).toHaveProperty('admissionId');
    const staff = validateUserForm({ ...base, role: 'STAFF' }, false);
    expect(Object.keys(staff).sort()).toEqual(['department', 'designation', 'staffId']);
  });

  it('checks email and the initial password only when creating', () => {
    expect(validateUserForm({ ...base, email: 'nope' }, false)).toHaveProperty('email');
    expect(validateUserForm({ ...base, password: '' }, false)).toHaveProperty('password');
    expect(validateUserForm({ ...base, password: '' }, true)).toEqual({});
  });
});

describe('validateQuestion (R24.1–R24.4)', () => {
  const opts = [
    { id: 'a', text: 'GSTR-1' },
    { id: 'b', text: 'GSTR-3B' },
  ];
  it('accepts a valid question', () => expect(validateQuestion('Which?', opts, 'a', '1')).toBeNull());
  it('needs text, two filled unique options, a correct answer and whole marks', () => {
    expect(validateQuestion(' ', opts, 'a', '1')).toMatch(/question text/);
    expect(validateQuestion('Q', [opts[0]], 'a', '1')).toMatch(/at least 2/);
    expect(validateQuestion('Q', [opts[0], { id: 'b', text: '' }], 'a', '1')).toMatch(/every option/);
    expect(validateQuestion('Q', [opts[0], { id: 'b', text: 'gstr-1' }], 'a', '1')).toMatch(/same text/);
    expect(validateQuestion('Q', opts, '', '1')).toMatch(/correct answer/);
    expect(validateQuestion('Q', opts, 'a', '1.5')).toMatch(/whole number/);
  });
});

describe('toQuizPayload (R23.1–R23.5)', () => {
  it('builds a module quiz payload with only the module ID', () => {
    const { payload, errors } = toQuizPayload({
      ...emptyQuizSettings,
      title: ' GST quiz ',
      attachmentType: 'MODULE',
      courseId: 'c1',
      moduleId: 'm1',
      totalMarks: '5',
      passMark: '3',
      timeLimit: '10',
    });
    expect(errors).toEqual({});
    expect(payload).toEqual({ title: 'GST quiz', attachmentType: 'MODULE', moduleId: 'm1', totalMarks: 5, passMark: 3, timeLimit: 10 });
  });

  it('rejects a pass mark above the total and missing targets', () => {
    const { errors } = toQuizPayload({ ...emptyQuizSettings, title: 'Q', attachmentType: 'LESSON', courseId: 'c', totalMarks: '5', passMark: '6' });
    expect(errors).toMatchObject({ passMark: expect.any(String), moduleId: expect.any(String), lessonId: expect.any(String) });
  });
});

describe('marksSummary (R24.8)', () => {
  it('matches only when there are questions and the marks add up', () => {
    expect(marksSummary({ totalMarks: 3, questions: [{ marks: 1 }, { marks: 2 }] })).toEqual({ sum: 3, matches: true });
    expect(marksSummary({ totalMarks: 5, questions: [{ marks: 1 }] }).matches).toBe(false);
    expect(marksSummary({ totalMarks: 0, questions: [] }).matches).toBe(false);
  });
});

describe('normaliseOptions (editing saved questions)', () => {
  it('keeps valid options as independent copies', () => {
    const saved = [{ id: 'a', text: 'GSTR-1' }, { id: 'b', text: 'GSTR-3B' }];
    const copy = normaliseOptions(saved);
    expect(copy).toEqual(saved);
    expect(copy[0]).not.toBe(saved[0]);
  });

  it('gives options saved without ids (old API bug) their own ids, so their fields are independent', () => {
    const fixed = normaliseOptions([[], [], {}, { id: 'x', text: 'Kept' }, { id: 'x', text: 'Duplicate id' }]);
    const ids = fixed.map((o) => o.id);
    expect(new Set(ids).size).toBe(5);
    expect(fixed[3]).toEqual({ id: 'x', text: 'Kept' });
    expect(fixed[4].text).toBe('Duplicate id');
    expect(normaliseOptions(null)).toEqual([]);
  });
});
