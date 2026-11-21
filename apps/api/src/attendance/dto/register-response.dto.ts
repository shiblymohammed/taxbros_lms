import { ApiProperty } from '@nestjs/swagger';

export class StudentInRegisterDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty()
  admissionId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  remarks?: string;

  @ApiProperty({ required: false })
  markedAt?: Date;
}

export class RegisterResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  classId: string;

  @ApiProperty()
  className: string;

  @ApiProperty()
  attendanceDate: Date;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [StudentInRegisterDto] })
  students: StudentInRegisterDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
