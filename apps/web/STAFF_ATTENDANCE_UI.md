# Staff Attendance Marking UI

This document describes the staff attendance marking user interface that was built for Task 22.

## Overview

The staff attendance marking UI allows authorized staff members to record daily attendance for all staff members. The interface provides an intuitive table-based layout with dropdown selectors for attendance status and optional remarks fields.

## Features

### 1. Date Selection
- Date picker at the top allows selecting any date to mark or view attendance
- Defaults to today's date
- Automatically loads existing attendance records for the selected date

### 2. Staff List Display
- Shows all active staff members in a table format
- Displays: Staff ID, Name, Designation, Department
- Rows are highlighted in yellow if attendance is not yet marked (unmarked entries)

### 3. Attendance Marking
- **Status Dropdown**: Three-option selector for each staff member
  - Present (Green badge)
  - Absent (Red badge)
  - Late (Yellow badge)
- **Remarks Field**: Optional text input for additional notes per staff member
- **Visual Feedback**: Status dropdowns show color-coded badges matching the selected status

### 4. Save Functionality
- **Save Button**: Saves all marked attendance entries
- Shows count of marked vs total staff members
- Disabled if no attendance is marked
- Provides success/error feedback via toast notifications

### 5. Data Loading
- Fetches all active staff members on page load
- Loads existing attendance records for the selected date
- Shows loading indicators during data fetches
- Handles errors gracefully with user-friendly messages

### 6. Responsive Design
- Mobile-friendly layout
- Table scrolls horizontally on small screens
- Touch-friendly controls with adequate spacing

## Technical Implementation

### Components Created

1. **Page Component** (`apps/web/src/app/staff/attendance/page.tsx`)
   - Main attendance marking page
   - Manages state for staff list, attendance entries, and UI states
   - Handles API calls for loading and saving attendance

2. **UI Components** (`apps/web/src/components/ui/`)
   - `button.tsx`: Reusable button component with variants
   - `card.tsx`: Card container for content sections
   - `select.tsx`: Dropdown selector component
   - `table.tsx`: Table components for data display
   - `toast.tsx` & `toaster.tsx`: Toast notification system
   - `label.tsx`: Form label component

3. **Utility Files**
   - `lib/utils.ts`: Utility functions (cn for className merging)
   - `lib/api.ts`: API client and type definitions
   - `hooks/use-toast.ts`: Toast notification hook

### API Integration

The UI integrates with the following backend endpoints:

1. **GET /staff** - Fetch all staff members with filtering and pagination
2. **POST /attendance/staff** - Mark or update staff attendance
3. **GET /attendance/staff** - Retrieve existing attendance records by date range

### Types and Interfaces

```typescript
enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

interface StaffMember {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  user: {
    id: string;
    email: string;
    status: string;
  };
}

interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  designation: string;
  department: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: string;
  markedAt: string;
}
```

## Usage

### Accessing the Page

Navigate to `/staff/attendance` in the web application.

**Note**: This page requires appropriate authentication and permissions (MARK_ATTENDANCE permission for Staff role or ADMINISTRATOR role).

### Marking Attendance

1. **Select Date**: Use the date picker to choose the attendance date
2. **Review Staff List**: All active staff members will be displayed
3. **Mark Status**: Click on the status dropdown for each staff member and select:
   - Present
   - Absent  
   - Late
4. **Add Remarks** (Optional): Enter any additional notes in the remarks field
5. **Save**: Click the "Save Attendance" button to submit

### Editing Existing Attendance

- Simply select a date that has existing attendance records
- The current status and remarks will be loaded automatically
- Make changes as needed
- Click "Save Attendance" to update

### Visual Indicators

- **Yellow Background**: Unmarked staff (no attendance status selected)
- **Green Badge**: Present
- **Red Badge**: Absent
- **Yellow Badge**: Late
- **Counter**: Shows "Marked: X / Total" at the top right

## Dependencies

The following npm packages were added to support this feature:

- `axios`: HTTP client for API requests
- `date-fns`: Date manipulation utilities
- `lucide-react`: Icon library
- `@radix-ui/react-select`: Accessible select component
- `@radix-ui/react-toast`: Toast notification primitive
- `@radix-ui/react-dialog`: Dialog primitive (for future use)
- `@radix-ui/react-slot`: Slot primitive for composition
- `@radix-ui/react-label`: Label primitive
- `class-variance-authority`: CVA for component variants
- `clsx`: Utility for constructing className strings
- `tailwind-merge`: Merge Tailwind CSS classes

## Environment Configuration

Ensure the following environment variable is set in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Actions**: Select multiple staff and apply the same status
2. **Filters**: Filter staff by department, category, or designation
3. **Search**: Search staff by name or ID
4. **Export**: Export attendance records to CSV/PDF
5. **History View**: View attendance history for a specific staff member
6. **Attendance Dashboard**: Summary statistics and visualizations
7. **Mobile App**: Native mobile app using the same API
8. **Offline Support**: Cache data for offline attendance marking

## Testing

To test the UI:

1. Ensure the backend API is running on `http://localhost:4000`
2. Create test staff members using the API
3. Obtain an authentication token (login as admin or staff with MARK_ATTENDANCE permission)
4. Store the token in localStorage with key 'accessToken'
5. Navigate to `/staff/attendance`
6. Test marking, saving, and editing attendance

## Files Created

```
apps/web/src/
├── app/
│   ├── layout.tsx (updated to include Toaster)
│   └── staff/
│       └── attendance/
│           └── page.tsx
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── toast.tsx
│       └── toaster.tsx
├── hooks/
│   └── use-toast.ts
└── lib/
    ├── api.ts (updated with staff API functions)
    └── utils.ts
```

## Validation

TypeScript compilation passes without errors:
```bash
pnpm type-check  # Runs tsc --noEmit
```

## Requirements Validated

This implementation validates the following requirements from the specification:

- **R12**: Staff Attendance Management - Mark daily staff attendance with present, absent, or late status
- **R2**: Role-Based Access Control - Requires MARK_ATTENDANCE permission or ADMINISTRATOR role
- **R7**: Institute Settings Management - Uses institute timezone for date calculations (handled by backend)
- **R34**: Responsive Design - Mobile-friendly interface with appropriate breakpoints

## Task Completion

✅ Task 22: Build staff attendance marking UI - **COMPLETED**

The staff attendance marking UI has been successfully implemented with all required features:
- Date picker for selecting attendance date
- Display list of active staff members  
- Dropdown selectors for attendance status (PRESENT, ABSENT, LATE)
- Optional remarks field for each staff member
- Save button with confirmation feedback
- Error handling with user-friendly messages
- Loading states for data fetching
- Responsive design using Tailwind CSS
- Integration with backend API endpoints
- Type-safe implementation with TypeScript
