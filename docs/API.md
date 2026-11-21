# TAXBROS LMS API Reference

Base URL: `https://DOMAIN/api` in production, `http://localhost:4000/api` in development.
All bodies are JSON. Dates are ISO 8601; attendance dates are calendar days in Asia/Kolkata.

- **Interactive docs (Swagger UI):** `/api/docs` (on in development; set `SWAGGER_ENABLED=true` to enable in production).
- **OpenAPI file:** [`openapi.json`](openapi.json), exported from the running API. Regenerate with
  `curl http://localhost:4000/api/docs-json -o docs/openapi.json`.
- **Postman:** File → Import → `docs/openapi.json` (Postman builds the collection from the OpenAPI file).
  Set a collection variable `baseUrl` and a Bearer token from the login response.

## Authentication

| Token | Lifetime | Where it lives |
|---|---|---|
| Access token (JWT, HS256) | 15 minutes | Returned by login/refresh; send as `Authorization: Bearer <token>` |
| Refresh token | 7 days | `refreshToken` httpOnly cookie, `SameSite=Strict`, `Secure` in production; rotated on every refresh |

Flow:

1. `POST /api/auth/login` with `{ "email": "...", "password": "..." }`
   → `200 { "accessToken": "...", "user": { "id", "email", "role", "mustChangePassword" } }` and the refresh cookie.
2. Call the API with the Bearer token.
3. On `401`, call `POST /api/auth/refresh` (cookie only, no body) → `{ "accessToken": "..." }`, then retry once.
   Browsers must send credentials (`withCredentials` / `credentials: 'include'`).
4. `POST /api/auth/logout` (Bearer token + cookie) invalidates the refresh token and clears the cookie.
5. `POST /api/auth/change-password` with `{ "currentPassword", "newPassword" }` (8+ characters, an uppercase
   letter, a number and a special character) returns a new `accessToken`, sets a new refresh cookie and signs
   out every other session.
6. New accounts and admin resets (`POST /api/users/{id}/reset-password`, which returns a one-time
   `temporaryPassword`) set `mustChangePassword`. Until it is changed, every endpoint except `/auth/me`,
   `/auth/change-password` and `/auth/logout` returns `403` with `"code": "PASSWORD_CHANGE_REQUIRED"`.
7. `GET /api/auth/me` returns `{ id, email, role, mustChangePassword, studentId, staffId, firstName, lastName }`.

Access token claims: `sub` (user ID), `email`, `role`. The server reloads the user on every request, so a
deactivated user is rejected even while their token is still valid; deactivation also deletes their refresh tokens.

Accounts lock for a period after repeated wrong passwords (`429` with a message giving the minutes left).

## Roles and permissions

Roles, highest first: `SUPER_ADMIN` > `ADMINISTRATOR` > `STAFF` > `STUDENT`. A route open to a role is also
open to the roles above it (below, "Admin" includes super admins).

Staff can be granted these permissions by an administrator (`POST /api/staff/{id}/permissions`):

| Permission | Allows staff to |
|---|---|
| `MARK_ATTENDANCE` | Open and mark student registers, mark staff attendance |
| `VIEW_REPORTS` | View monthly attendance reports |
| `MANAGE_STUDENTS` | Create, edit, activate/deactivate and reset passwords of student accounts; read student profiles |
| `MANAGE_STAFF` | The same for staff accounts, but only staff whose permissions are a subset of their own |
| `MANAGE_CLASSES` | Create, rename and archive classes; add and remove students |
| `MANAGE_COURSES` | Courses, modules, lessons, quizzes, cover images and course enrolments |
| `MANAGE_LABS` | Lab sample data and lab on/off |

Staff never manage their own account through these routes, never touch administrator accounts and never
grant permissions (`/api/staff/{id}/permissions` stays admin-only). Permissions are read on every request,
so a revoked permission stops working at once. `GET /api/auth/me` returns the caller's `permissions`.
Listing students (`GET /api/students`, used by the student pickers) needs any of `MANAGE_STUDENTS`,
`MANAGE_CLASSES` or `MANAGE_COURSES`.


## Error format

Every error has the same shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Form validation failed",
  "errors": [{ "field": "PAN", "message": "PAN must be exactly 10 characters" }],
  "path": "/api/labs/GST_REGISTRATION/submit",
  "timestamp": "2026-11-21T04:10:00.000Z"
}
```

`message` is a string or, for request validation errors, an array of strings. `errors` appears only for lab
form validation. `500` responses never include internal details; the cause is in the server's error log.

| Status | Meaning |
|---|---|
| 400 | Invalid input (validation failed, unknown fields are rejected) |
| 401 | Not signed in, token expired or invalid, wrong email/password |
| 403 | Signed in but not allowed (role, permission, or someone else's record); deactivated account |
| 404 | Record not found |
| 409 | Conflict, e.g. duplicate email or admission ID |
| 429 | Rate limit or account lockout; see `Retry-After` |
| 500 | Unexpected server error |

## Rate limits

| Limit | Default | Key | Setting |
|---|---|---|---|
| Per user | 100 requests / minute | User ID from a valid token | `USER_RATE_LIMIT` |
| Per IP address | 500 requests / minute | Client IP | `IP_RATE_LIMIT` |
| Login | 5 attempts / 15 minutes | Client IP, `POST /api/auth/login` only | `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_MINUTES` |

Exceeding a limit returns `429` with a `Retry-After` header in seconds. Limits are counted per API process,
so with 2 PM2 instances the effective limit can be up to twice the setting. Behind Nginx, set `TRUST_PROXY=1`.

## Example requests

Submit a practice lab (students only; all data must be fictional):

```http
POST /api/labs/INCOME_TAX_RETURN/submit
Authorization: Bearer <token>
Content-Type: application/json

{ "taxpayerName": "Jane Doe Test", "pan": "DEMO98765D", "incomeSource": "Salary",
  "grossIncome": 500000, "deductions": 50000 }
```

The response is the saved attempt: the submitted `formData` and a simulated `result`. For ITR the result has
an `acknowledgementNumber`, `status: "FILED"` and a `calculation` (gross income, deductions, taxable income,
tax and the slab breakdown). Invalid or real-looking data returns `400` with field-level `errors`.

Mark a register (admins, or staff with `MARK_ATTENDANCE`):

```http
POST /api/attendance/student/registers
{ "classId": "…", "attendanceDate": "2026-11-21" }

POST /api/attendance/student/registers/{registerId}/mark
{ "marks": [ { "studentId": "…", "status": "PRESENT" }, { "studentId": "…", "status": "LATE", "remarks": "Bus delay" } ] }
```

For every request and response schema, use Swagger UI or `openapi.json`.

## Endpoints

"Any signed-in" means any valid access token. Generated from the controllers' `@Roles` and
`@RequirePermission` decorators.

| Method | Path | Who |
|---|---|---|
| GET | `/api/attendance/reports/staff/monthly` | Admin |
| GET | `/api/attendance/reports/student/monthly` | Admin, Staff (staff need VIEW_REPORTS) |
| GET | `/api/attendance/staff` | Admin |
| POST | `/api/attendance/staff` | Admin, Staff (staff need MARK_ATTENDANCE) |
| GET | `/api/attendance/staff/{staffId}` | Admin, Staff |
| POST | `/api/attendance/student/registers` | Admin, Staff (staff need MARK_ATTENDANCE) |
| POST | `/api/attendance/student/registers/{id}/mark` | Admin, Staff (staff need MARK_ATTENDANCE) |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/change-password` | Any signed-in |
| POST | `/api/auth/logout` | Any signed-in |
| GET | `/api/auth/me` | Any signed-in |
| POST | `/api/auth/refresh` | Public |
| GET | `/api/classes` | Admin, Staff |
| POST | `/api/classes` | Admin |
| GET | `/api/classes/{id}` | Admin, Staff |
| PATCH | `/api/classes/{id}` | Admin |
| POST | `/api/classes/{id}/students` | Admin |
| DELETE | `/api/classes/{id}/students/{studentId}` | Admin |
| GET | `/api/courses` | Admin, Staff, Student |
| POST | `/api/courses` | Admin |
| POST | `/api/courses/{courseId}/enroll` | Admin, Student |
| GET | `/api/courses/{courseId}/enrollments` | Admin, Staff |
| POST | `/api/courses/{courseId}/modules` | Admin |
| GET | `/api/courses/{courseId}/progress` | Admin, Staff, Student |
| DELETE | `/api/courses/{id}` | Admin |
| GET | `/api/courses/{id}` | Admin, Staff, Student |
| PATCH | `/api/courses/{id}` | Admin |
| GET | `/api/dashboard/admin` | Admin |
| DELETE | `/api/courses/enrollments/{id}` | Admin, Student |
| GET | `/api/health` | Public |
| GET | `/api/labs` | Admin, Staff, Student |
| GET | `/api/labs/{type}` | Admin, Staff, Student |
| GET | `/api/labs/{type}/attempts` | Admin, Staff, Student |
| PATCH | `/api/labs/{type}/sample-data` | Admin |
| PATCH | `/api/labs/{type}/status` | Admin |
| POST | `/api/labs/{type}/submit` | Student |
| GET | `/api/labs/attempts/{id}` | Admin, Staff, Student |
| DELETE | `/api/lessons/{id}` | Admin |
| GET | `/api/lessons/{id}` | Admin, Staff, Student |
| PATCH | `/api/lessons/{id}` | Admin |
| PATCH | `/api/lessons/{id}/publish` | Admin |
| PATCH | `/api/lessons/{id}/unpublish` | Admin |
| POST | `/api/lessons/{lessonId}/complete` | Student |
| GET | `/api/lessons/{lessonId}/progress` | Admin, Staff, Student |
| PATCH | `/api/lessons/{lessonId}/progress` | Student |
| DELETE | `/api/modules/{id}` | Admin |
| GET | `/api/modules/{id}` | Admin, Staff |
| PATCH | `/api/modules/{id}` | Admin |
| POST | `/api/modules/{moduleId}/lessons` | Admin |
| DELETE | `/api/quizzes/questions/{id}` | Admin |
| PATCH | `/api/quizzes/questions/{id}` | Admin |
| GET | `/api/quizzes` | Admin, Staff, Student |
| POST | `/api/quizzes` | Admin |
| DELETE | `/api/quizzes/{id}` | Admin |
| GET | `/api/quizzes/{id}` | Admin, Staff, Student |
| PATCH | `/api/quizzes/{id}` | Admin |
| GET | `/api/quizzes/{id}/attempts` | Admin, Staff, Student |
| PATCH | `/api/quizzes/{id}/publish` | Admin |
| POST | `/api/quizzes/{id}/questions` | Admin |
| POST | `/api/quizzes/{id}/submit` | Student |
| GET | `/api/quizzes/attempts/{id}` | Admin, Staff, Student |
| GET | `/api/reports/attendance/staff/{staffId}/history` | Admin, Staff |
| GET | `/api/reports/attendance/staff/monthly` | Admin, Staff (staff need VIEW_REPORTS) |
| GET | `/api/reports/attendance/student/{studentId}/history` | Admin, Staff, Student |
| GET | `/api/reports/attendance/student/monthly` | Admin, Staff (staff need VIEW_REPORTS) |
| GET | `/api/staff` | Admin |
| POST | `/api/staff` | Admin |
| DELETE | `/api/staff/{id}` | Admin |
| GET | `/api/staff/{id}` | Admin |
| PATCH | `/api/staff/{id}` | Admin |
| GET | `/api/staff/{id}/permissions` | Admin |
| POST | `/api/staff/{id}/permissions` | Admin |
| DELETE | `/api/staff/{id}/permissions/{permissionId}` | Admin |
| GET | `/api/students` | Admin |
| POST | `/api/students` | Admin |
| GET | `/api/students/{id}` | Admin, Student (own profile only). Includes course enrolments with progress, class enrolments and quiz attempts |
| PATCH | `/api/students/{id}` | Admin |
| GET | `/api/students/{id}/attendance` | Admin, Student |
| GET | `/api/students/{studentId}/enrollments` | Admin, Staff, Student |
| GET | `/api/students/{studentId}/progress` | Admin, Staff, Student |
| GET | `/api/students/attendance/all` | Admin |
| GET | `/api/settings` | Any signed-in |
| PATCH | `/api/settings/{key}` | Admin. Keys: `timezone` (IANA name), `instituteName`. Body `{ "value": "..." }` |
| DELETE | `/api/upload/course-cover/{courseId}` | Admin |
| POST | `/api/upload/course-cover/{courseId}` | Admin |
| GET | `/api/users` | Admin. Filters: `search`, `role`, `status`; students: `admissionId`, `classId`, `admissionDateFrom`, `admissionDateTo`; staff: `staffId`, `department`, `designation`, `category` |
| POST | `/api/users` | Admin |
| GET | `/api/users/{id}` | Admin |
| PATCH | `/api/users/{id}` | Admin |
| PATCH | `/api/users/{id}/activate` | Admin |
| PATCH | `/api/users/{id}/deactivate` | Admin |
| POST | `/api/users/{id}/reset-password` | Admin |
