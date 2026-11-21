# Monthly Reports UI Implementation

## Overview
This document describes the implementation of Task 23: Build monthly report generation UI.

## Features Implemented

### 1. Monthly Attendance Report Page
- **Location:** `/admin/reports/attendance`
- **Purpose:** Generate and view monthly attendance reports for students

### 2. Key Features

#### Filtering Options
- **Year Selection:** Dropdown to select year (last 5 years available)
- **Month Selection:** Dropdown to select month (January-December)
- **Class Filter:** Dropdown to filter by specific class or view all classes

#### Report Display
- **Table View:** Clean table showing:
  - Student Name
  - Admission ID
  - Class
  - Present Count
  - Late Count
  - Absent Count
  - Unmarked Count
  - Attendance Percentage (color-coded)

#### Color-Coded Percentages
- **Green:** ≥ 85% attendance
- **Yellow:** 75-84% attendance
- **Red:** < 75% attendance
- **N/A:** No marked attendance data

#### Summary Statistics
- Total Students
- Average Attendance
- Total Present Days
- Total Absent Days

#### Export Functionality
- Export report to CSV format
- Filename format: `attendance_report_[Month]_[Year].csv`
- Includes all visible data in the table

#### Loading States & Error Handling
- Loading spinner while fetching data
- Error messages with retry option
- Empty state message when no data found

## Technical Implementation

### Dependencies Added
- `@radix-ui/react-select` - Dropdown components
- `@radix-ui/react-label` - Form labels
- `@radix-ui/react-slot` - Component composition
- `class-variance-authority` - Tailwind variant management
- `clsx` - Conditional classnames
- `tailwind-merge` - Merge Tailwind classes
- `lucide-react` - Icon library
- `date-fns` - Date formatting
- `axios` - HTTP client
- `@tanstack/react-table` - Table utilities

### File Structure
```
apps/web/src/
├── app/
│   └── admin/
│       └── reports/
│           └── attendance/
│               └── page.tsx          # Main report page
├── components/
│   └── ui/
│       ├── button.tsx                # Button component
│       ├── card.tsx                  # Card components
│       ├── select.tsx                # Select dropdown
│       ├── table.tsx                 # Table components
│       └── label.tsx                 # Label component
└── lib/
    ├── api.ts                        # API client & types
    ├── utils.ts                      # Utility functions
    └── csv-export.ts                 # CSV export utility
```

### API Integration

#### Endpoint Used
- `GET /reports/attendance/student/monthly`
- Query params: `year`, `month`, `classId` (optional)

#### Response Structure
```typescript
{
  year: number;
  month: number;
  classId?: string;
  generatedAt: string;
  students: Array<{
    studentId: string;
    studentName: string;
    admissionId: string;
    className: string;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    unmarkedCount: number;
    percentage: number | null;
  }>;
}
```

## shadcn/ui Components

All UI components follow shadcn/ui patterns:
- Accessible by default
- Customizable with Tailwind CSS
- TypeScript typed
- React 19 compatible

## Styling

### Tailwind CSS 4
- Uses `@theme` directive for design tokens
- Custom color palette with HSL values
- Dark mode support
- Responsive design

### Design Tokens
All colors are defined in `globals.css`:
- `--color-background`
- `--color-foreground`
- `--color-primary`
- `--color-secondary`
- `--color-muted`
- `--color-accent`
- `--color-destructive`
- `--color-border`
- etc.

## Environment Configuration

### Required Environment Variables
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

See `.env.local.example` for complete configuration.

## Usage

### Running Development Server
```bash
cd apps/web
pnpm dev
```

### Building for Production
```bash
cd apps/web
pnpm build
```

### Type Checking
```bash
cd apps/web
pnpm type-check
```

## Navigation

Access the monthly reports page at:
- Development: `http://localhost:3000/admin/reports/attendance`
- Production: `[your-domain]/admin/reports/attendance`

## Future Enhancements

Potential improvements for future iterations:
1. Add date range picker for custom periods
2. Export to PDF format
3. Print-friendly view
4. Email report functionality
5. Scheduled report generation
6. Comparison across multiple months
7. Graphical charts and visualizations
8. Staff attendance reports in separate tab
9. Download multiple reports at once
10. Save report configurations as templates

## Testing

### Manual Testing Checklist
- [ ] Filters work correctly (year, month, class)
- [ ] Data loads without errors
- [ ] Table displays all required columns
- [ ] Percentages calculate correctly
- [ ] Color coding applies correctly
- [ ] CSV export downloads successfully
- [ ] CSV contains accurate data
- [ ] Loading states display properly
- [ ] Error handling works
- [ ] Responsive design on mobile/tablet
- [ ] Summary statistics calculate correctly

## Known Limitations

1. No pagination - all students load at once
2. No sorting/searching in table
3. No custom date ranges
4. Export only to CSV (no PDF/Excel)
5. Requires authentication (not implemented in this task)

## Related Tasks

- Task 17: Build monthly attendance calculation service (Backend)
- Task 18: Create student attendance reports endpoint (Backend)
- Task 19: Create staff attendance reports endpoint (Backend)
- Task 22: Build staff attendance marking UI (Frontend)

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com)
