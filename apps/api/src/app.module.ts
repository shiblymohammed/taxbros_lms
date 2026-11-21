import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggingModule } from './common/logging/logging.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppThrottlerGuard } from './common/throttling/app-throttler.guard';
import { buildThrottlers } from './common/throttling/throttler.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { StaffModule } from './staff/staff.module';
import { ClassesModule } from './classes/classes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CoursesModule } from './courses/courses.module';
import { UploadModule } from './upload/upload.module';
import { ProgressModule } from './progress/progress.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { LabModule } from './lab/lab.module';
import { SettingsModule } from './settings/settings.module';
import { StaffAccessModule } from './auth/staff-access.service';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Structured logging (R39)
    LoggingModule,

    // Rate limiting (R38): per-user, per-IP and login limits, enforced by AppThrottlerGuard
    ThrottlerModule.forRoot(buildThrottlers()),

    // Database
    PrismaModule,

    // Authentication
    AuthModule,

    // User Management
    UsersModule,

    // Student Management
    StudentsModule,

    // Staff Management
    StaffModule,

    // Class Management
    ClassesModule,

    // Attendance Management
    AttendanceModule,

    // Reports
    ReportsModule,

    // Dashboard
    DashboardModule,

    // Course Management
    CoursesModule,

    // Upload Management
    UploadModule,

    // Progress Tracking
    ProgressModule,

    // Quiz Management
    QuizzesModule,

    // Lab Management
    LabModule,

    // Institute Settings (R6)
    SettingsModule,

    // Staff access to admin features (R2.7, R3)
    StaffAccessModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
