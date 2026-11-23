import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateQuestionDto } from './create-question.dto';
import { UpdateQuestionDto } from './update-question.dto';

/**
 * Question options must survive the global ValidationPipe (same options as main.ts).
 * Without @Type on `options`, implicit conversion turned each option into an empty array,
 * so questions were saved with options [[], [], ...] and the editor lost every option.
 */
describe('question DTOs through the global ValidationPipe (R24.2)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: '' });

  const body = {
    questionText: 'Which return reports outward supplies?',
    options: [
      { id: 'o1', text: 'GSTR-1' },
      { id: 'o2', text: 'GSTR-3B' },
      { id: 'o3', text: 'GSTR-9' },
      { id: 'o4', text: 'CMP-08' },
    ],
    correctAnswer: 'o1',
    marks: 1,
  };

  it('keeps every option as an object that serialises with its id and text', async () => {
    const dto = await pipe.transform(body, meta(CreateQuestionDto));
    // What Prisma stores in the JSON column
    expect(JSON.parse(JSON.stringify(dto.options))).toEqual(body.options);
  });

  it('keeps options on updates too', async () => {
    const dto = await pipe.transform({ options: body.options.slice(0, 3), correctAnswer: 'o2' }, meta(UpdateQuestionDto));
    expect(JSON.parse(JSON.stringify(dto.options))).toEqual(body.options.slice(0, 3));
  });

  it('rejects options without text, unknown fields, and fewer than 2 or more than 6 options', async () => {
    await expect(
      pipe.transform({ ...body, options: [{ id: 'o1', text: '' }, { id: 'o2', text: 'B' }] }, meta(CreateQuestionDto)),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform({ ...body, options: [{ id: 'o1', text: 'A', extra: 1 }, { id: 'o2', text: 'B' }] }, meta(CreateQuestionDto)),
    ).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ ...body, options: [{ id: 'o1', text: 'A' }] }, meta(CreateQuestionDto))).rejects.toThrow(
      BadRequestException,
    );
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `o${i}`, text: `T${i}` }));
    await expect(pipe.transform({ ...body, options: seven, correctAnswer: 'o0' }, meta(CreateQuestionDto))).rejects.toThrow(
      BadRequestException,
    );
  });
});
