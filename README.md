# Google Workspace Education Platform

A secure, scalable Learning Management System built on **Google Workspace** and **Firebase**. This open-source, white-label platform provides end-to-end course management, video-based learning, live class scheduling, payments, certifications, and multi-channel notifications — all from a single, multi-tenant deployment.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [White-Label & Customization](#white-label--customization)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Multi-Institution Support
- Fully **multi-tenant** — every document scoped by `institutionId`
- **Multi-institution membership** — students can join multiple institutions simultaneously
- Membership subcollection at `users/{uid}/memberships/{institutionId}` tracks admission status
- **Admission workflow**: browse institutions or join via invite code → admin approval → approved member
- Admin **Admissions panel** with approve, reject, and transfer actions (with notes)
- Per-institution **white-label branding** (logo, colors, tagline, footer)
- Institution-level settings: self-registration, external user access, maintenance mode, locale
- Admin panel to manage institution configuration without any code changes
- **Institution discovery page** with country/state filters for new users
- Auto-generated **invite codes** per institution for direct joining
- **Course-type enrollment rules**: self-paced/bootcamp open to all, instructor-led requires approved membership
- **Structured address** collection (city, state, country, pincode) during profile completion

### Course Management
- Create courses with rich metadata: title, description, thumbnail, skill level, pricing, tags
- Support for multiple course types: **self-paced**, **live**, and **hybrid**
- Modular structure: Courses → Modules → Lessons (video, text, quiz, assignment)
- Rich text lesson editor powered by **TipTap**
- Course publishing workflow (draft → published)
- Instructor assignment and multi-instructor support

### Video Learning with Progress Tracking
- **YouTube embed player** with resume-from-where-you-left-off support
- **Google Drive** video embedding for institutional content
- Watched segments tracking with per-second accuracy
- **Video checkpoints**: pause-and-quiz questions (multiple choice, true/false, short answer) overlaid on the video
- `requireFullWatch` enforcement — students must watch ≥90% before marking a lesson complete
- Auto-completion when watch threshold is reached
- Progress persisted to Firestore with debounced saves

### Live Classes & Attendance
- Schedule live sessions with **Google Meet** or **Zoom** integration
- Automatic Meet link generation via Google Calendar API
- Automatic **Zoom meeting creation** via Server-to-Server OAuth API
- Session management: create, edit, delete sessions with recurrence support
- Attendance tracking per session (present/absent/late)
- Students see upcoming and past sessions on the learn page

### Zoom Integration
- **Server-to-Server OAuth** — single Pro account manages all meetings (no per-user OAuth)
- **Automatic meeting creation** — select "Zoom (auto-create)" when scheduling a session; meeting is created with registration enabled and auto-approve
- **Registration-enforced meetings** — each enrolled student gets a unique join URL via Zoom's registrant API
- **Auto-registration on enrollment** — Cloud Function trigger registers new students in all upcoming Zoom meetings for their course
- **Real-time participant tracking** — Zoom webhooks (`meeting.started`, `meeting.ended`, `meeting.participant_joined`, `meeting.participant_left`) push events to Firestore in real time
- **Attendance sync** — "Sync from Zoom" button pulls participant reports from Zoom Reports API and maps to enrolled students (present/late/absent based on duration thresholds)
- **Admin Zoom Dashboard** (`/admin/zoom`) — view all meetings, create standalone meetings, view participant reports, CSV export
- **Meeting detail page** — registrant list, live participant view during meetings, post-meeting attendance report
- **Reports page** (`/admin/zoom/reports`) — date-range and course-filtered aggregated reports with stats
- **Webhook security** — HMAC-SHA256 signature verification + CRC challenge-response for endpoint validation
- **Multi-tenant** — per-institution Zoom credentials stored in Firestore, falls back to environment variables
- **Modular library** — `src/lib/zoom/` with auth, client, config, webhook-verify, and attendance modules

### Exams & Assessments
- **Google Forms** integration for exam creation
- Exam attempt tracking with time limits and scoring
- Status flow: `not_started → in_progress → submitted → graded`
- Score threshold for pass/fail determination
- Instructor view for grading and review

### Payments with Razorpay
- **Razorpay** payment gateway integration (India-focused)
- Secure webhook-based payment verification (HMAC SHA-256)
- Automatic enrollment creation upon successful payment
- Payment history viewable by students and admins
- Support for free courses (instant enrollment)

### Certificate Generation
- Automated certificate generation upon course completion
- **Google Docs** template-based certificates (merge fields for name, course, date, grade)
- Exported as PDF to **Google Drive** with public sharing link
- Public certificate verification page (no login required)
- Unique certificate IDs for authenticity

### Google Workspace Integration
- **Google Classroom** course sync (create courses, manage rosters)
- **Google Calendar** for scheduling sessions with automatic event creation
- **Google Meet** for live video classes
- **Google Drive** for certificate storage and video hosting
- **Google Docs** for certificate templates
- **Admin SDK** for user directory operations
- Domain-wide delegation via service account

### Authentication & Authorization
- **Firebase Authentication** with Google Sign-In
- Role-based access control: `super_admin`, `institution_admin`, `instructor`, `student`
- Custom claims synced to Firestore user documents
- Session cookie-based auth for API routes (revocation check only on write operations)
- External user support (Gmail) with mandatory profile completion and address collection
- Institution selection flow for external users (browse + invite code)
- Parent/guardian information collection for minor students

### Admin Dashboard
- **Analytics dashboard** with 6 KPI cards and 6 interactive charts (Recharts)
  - Enrollment trends, revenue trends, status distribution
  - Course popularity, completion rates, user role breakdown
- User management with role assignment
- Course management (create, edit, publish, assign instructors)
- Enrollment management and monitoring
- Institution settings and branding configuration
- Audit log viewer

### Instructor Dashboard
- Course creation and editing
- Module and lesson CRUD with drag-and-drop ordering
- Video configuration (YouTube URL, Drive file ID)
- Rich text editor for lesson content
- Exam creation and management
- Live session scheduling
- Student progress monitoring

### Student Experience
- Personalized dashboard with enrolled courses and progress
- Course catalog with search and filtering (type, skill level, keyword)
- Structured learning path: modules → lessons with completion tracking
- Video player with checkpoint quizzes
- Certificate gallery
- Profile editing with avatar and contact details

### Progressive Web App (PWA)
- **Installable** on mobile and desktop (manifest.json + service worker)
- **Offline support** — cached pages for navigation
- **Push notifications** for:
  - Session reminders
  - Assignment due dates
  - Class updates
  - General announcements
- Notification toggle in sidebar

### Multi-Channel Notifications
- **Web Push** — VAPID-based, zero external dependencies (custom RFC 8291 implementation)
- **WhatsApp Cloud API** — Template-based messages via Meta Business Platform
  - Session reminders, assignment alerts, enrollment confirmations
  - Payment receipts, certificate notifications
  - Per-institution WhatsApp configuration
  - Webhook handler for incoming messages

### Security & Audit
- **Firestore Security Rules** with role-based access on every collection
- Server-side session cookie verification on all API routes
- **Audit logging** for critical operations:
  - Login events, role changes, payment verification
  - Certificate generation, course creation, data resets
  - Captures IP address, user agent, timestamps
- HMAC signature verification for payment webhooks
- Zoom webhook HMAC-SHA256 verification + CRC endpoint validation
- WhatsApp webhook verification token

### Error Handling & UX
- **Error boundaries** at dashboard, auth, and global levels
- **Loading skeletons** with animated pulse effects
- Responsive design — mobile hamburger menu with slide-out sidebar
- Empty state handling for all list views
- Toast-style feedback for actions

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Vercel (Next.js 16)                │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │  Pages   │  │   API    │  │   Static Assets     │ │
│  │ (React)  │  │  Routes  │  │  (PWA, SW, Icons)   │ │
│  └────┬─────┘  └────┬─────┘  └─────────────────────┘ │
│       │              │                                │
└───────┼──────────────┼────────────────────────────────┘
        │              │
        ▼              ▼
┌───────────────────────────────────┐
│         Firebase Platform         │
│                                   │
│  ┌─────────┐  ┌────────────────┐ │
│  │  Auth    │  │   Firestore    │ │
│  │ (Google) │  │  (Multi-tenant)│ │
│  └─────────┘  └────────────────┘ │
│                                   │
│  ┌────────────────────────────┐  │
│  │     Cloud Functions        │  │
│  │  (User creation, Crons)    │  │
│  └────────────────────────────┘  │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│       Google Workspace APIs       │
│                                   │
│  Calendar · Meet · Classroom      │
│  Drive · Docs · Admin SDK         │
└───────────────────────────────────┘
        │
        ▼
┌──────────────────┐  ┌────────────┐  ┌────────────┐
│    Razorpay       │  │  WhatsApp  │  │    Zoom    │
│  (Payments)       │  │ Cloud API  │  │  (S2S OAuth)│
└──────────────────┘  └────────────┘  └────────────┘
```

### Key Design Decisions

- **Multi-tenancy via `institutionId`** — Every Firestore document includes `institutionId`, enforced at the security rules level. No data leakage between institutions.
- **Multi-institution memberships** — Students can belong to multiple institutions via `users/{uid}/memberships/{institutionId}` subcollection. Admission requests require admin approval.
- **Course-type enrollment gating** — Self-paced and bootcamp courses are open to all authenticated users. Instructor-led courses require an approved membership in the course's institution.
- **Firebase Client SDK lazy initialization** — Prevents build failures in Next.js (no env vars at build time).
- **Server-side session cookies** — API routes verify Firebase session cookies, not ID tokens, for better security. Revocation check disabled for read-only endpoints for performance.
- **API response caching** — GET endpoints return `Cache-Control` headers with `stale-while-revalidate` to reduce redundant Firestore reads.
- **Institution data caching** — `sessionStorage` with 30-minute TTL eliminates repeated fetches on navigation.
- **Google Workspace service account with domain-wide delegation** — Backend operations (calendar events, Drive files, Classroom sync) run as a service account impersonating an admin user.

---

## Database Schema (Firestore)

### Collections Overview

```
institutions                       # Top-level — multi-tenant config
users                              # Top-level — Firebase Auth profiles
  └── memberships (subcollection)  # users/{uid}/memberships/{institutionId}
courses                            # Top-level
  ├── modules (subcollection)      # courses/{id}/modules/{moduleId}
  │   └── lessons (subcollection)  # .../modules/{moduleId}/lessons/{lessonId}
  └── sessions (subcollection)     # courses/{id}/sessions/{sessionId}
enrollments                        # Top-level
payments                           # Top-level
certificates                      # Top-level
exams                              # Top-level
examAttempts                       # Top-level
videoProgress                      # Top-level
attendance                         # Top-level
zoomMeetings                       # Top-level
  └── participants (subcollection) # zoomMeetings/{id}/participants
auditLogs                          # Top-level
pushSubscriptions                  # Top-level
```

### `institutions`

Mother/child hierarchy. Mother institution is the central hub; child institutions link via `parentInstitutionId`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (= slug) |
| `name` | `string` | Display name |
| `slug` | `string` | URL-friendly ID |
| `parentInstitutionId` | `string \| null` | Mother's ID (null for mother itself) |
| `institutionType` | `enum` | `mother \| child_online \| child_offline` |
| `allowedEmailDomains` | `string[]` | Auto-matched on sign-up |
| `inviteCode` | `string` | 8-char join code |
| `isActive` | `boolean` | Soft-disable |
| `location` | `object \| null` | `{ country, state, city, lat, lng, timezone }` |
| `branding` | `object` | `{ logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headerBgColor, footerText, institutionTagline }` |
| `googleWorkspace` | `object` | `{ customerDomain, adminEmail, serviceAccountKeyRef, classroomTeacherEmail }` |
| `razorpay` | `object` | `{ keyId, keySecretRef, webhookSecretRef }` |
| `whatsapp` | `object \| null` | `{ accessToken, phoneNumberId, businessAccountId }` |
| `zoom` | `object \| null` | `{ accountId, clientId, clientSecretRef, webhookSecretToken, defaultUserId, isEnabled }` |
| `settings` | `object` | `{ defaultCourseAccessDays, certificateTemplateDocId, certificateFolderId, videoStorageBucket, enableSelfRegistration, allowExternalUsers, requireEmailVerification, maintenanceMode, locale }` |
| `contactInfo` | `object` | `{ supportEmail, phone, address, website }` |
| `createdAt / updatedAt` | `Timestamp` | |

### `users`

Firebase Auth profile. Custom claims mirror `role` + `institutionId`.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | `string` | Firebase Auth UID (doc ID) |
| `email` | `string` | |
| `displayName` | `string` | |
| `photoUrl` | `string \| null` | |
| `phone` | `string \| null` | WhatsApp number (with country code) |
| `gender` | `string \| null` | `male \| female \| other \| prefer_not_to_say` |
| `institutionId` | `string` | Primary/active institution |
| `activeInstitutionId` | `string \| null` | Explicit active institution |
| `role` | `UserRole` | `super_admin \| institution_admin \| instructor \| student` |
| `isExternal` | `boolean` | Email didn't match any domain |
| `consentGiven` | `boolean` | Data consent |
| `profileComplete` | `boolean` | Must complete after first login |
| `address` | `object \| null` | `{ address, city, state, country, pincode }` |
| `profile` | `object` | `{ bio, dateOfBirth, enrollmentNumber, department }` |
| `parentGuardian` | `object \| null` | `{ name, phone, email, address, relation }` (required if age < 13) |
| `preferences` | `object` | `{ emailNotifications, language }` |
| `isActive` | `boolean` | |
| `lastLoginAt / createdAt / updatedAt` | `Timestamp` | |

**Subcollection:** `users/{uid}/memberships/{institutionId}`

### `memberships` (subcollection)

Path: `users/{uid}/memberships/{institutionId}`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | = `institutionId` |
| `userId` | `string` | |
| `institutionId` | `string` | |
| `role` | `UserRole` | Role within this institution |
| `status` | `MembershipStatus` | `pending \| approved \| rejected \| transferred` |
| `isExternal` | `boolean` | |
| `joinMethod` | `JoinMethod` | `browse \| invite_code \| email_domain \| admin_added \| auto_parent` |
| `requestedAt` | `Timestamp` | |
| `reviewedAt / reviewedBy` | `Timestamp \| string` | Admin who reviewed |
| `reviewNote` | `string \| null` | |
| `transferredTo` | `string \| null` | Target institution if transferred |
| `createdAt / updatedAt` | `Timestamp` | |

### `courses`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Auto-generated |
| `institutionId` | `string` | Owning institution |
| `title` | `string` | |
| `slug` | `string` | Unique within institution |
| `description / shortDescription` | `string` | Full (markdown) / card summary |
| `thumbnailUrl` | `string` | |
| `type` | `CourseType` | `bootcamp \| instructor_led \| self_paced` |
| `pricing` | `object` | `{ amount (paise), currency, originalAmount, isFree }` |
| `bootcampConfig` | `object \| null` | `{ startDate, endDate, schedule[], maxStudents, minAttendancePercent }` |
| `instructorLedConfig` | `object \| null` | `{ startDate, endDate, schedule, liveSessionCount }` |
| `selfPacedConfig` | `object \| null` | `{ accessDurationDays, estimatedHours }` |
| `classroomCourseId / classroomInviteLink` | `string \| null` | Google Classroom link |
| `instructorIds` | `string[]` | Assigned instructor UIDs |
| `tags / prerequisites` | `string[]` | |
| `skillLevel` | `enum` | `beginner \| intermediate \| advanced` |
| `moduleOrder` | `string[]` | Ordered module IDs |
| `status` | `CourseStatus` | `draft \| published \| archived` |
| `isVisible` | `boolean` | |
| `enrollmentCount` | `number` | Denormalized |
| `copiedFrom` | `object \| null` | `{ courseId, institutionId }` — when copied between institutions |
| `createdBy` | `string` | UID |
| `createdAt / updatedAt` | `Timestamp` | |

**Subcollections:** `modules/{moduleId}`, `sessions/{sessionId}`

### `modules` (subcollection of `courses`)

Path: `courses/{courseId}/modules/{moduleId}`

| Field | Type | Description |
|-------|------|-------------|
| `id / courseId` | `string` | |
| `title / description` | `string` | |
| `order` | `number` | Display order |
| `lessonOrder` | `string[]` | Ordered lesson IDs |
| `isPublished` | `boolean` | |
| `unlockAfterModuleId` | `string \| null` | Sequential unlock |
| `createdAt / updatedAt` | `Timestamp` | |

### `lessons` (subcollection of `modules`)

Path: `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}`

| Field | Type | Description |
|-------|------|-------------|
| `id / moduleId / courseId` | `string` | |
| `title` | `string` | |
| `type` | `LessonType` | `video \| text \| quiz \| assignment \| resource` |
| `order` | `number` | |
| `videoConfig` | `object \| null` | `{ videoUrl, videoDurationSeconds, videoSource, youtubeVideoId, driveFileId, gcsPath, checkpoints[], requireFullWatch }` |
| `textContent` | `string \| null` | Markdown |
| `resources` | `array` | `[{ title, url, type, driveFileId }]` |
| `assignmentConfig` | `object \| null` | `{ classroomAssignmentId, instructions, dueDate, maxPoints }` |
| `isPublished` | `boolean` | |
| `estimatedMinutes` | `number` | |
| `createdAt / updatedAt` | `Timestamp` | |

### `enrollments`

| Field | Type | Description |
|-------|------|-------------|
| `id / userId / courseId / institutionId` | `string` | |
| `status` | `EnrollmentStatus` | `pending_payment \| active \| expired \| completed \| cancelled \| refunded` |
| `paymentId` | `string \| null` | |
| `accessStartDate / accessEndDate` | `Timestamp` | |
| `classroomEnrolled` | `boolean` | Synced to Google Classroom |
| `progress` | `object` | `{ completedLessons, totalLessons, completedModules, totalModules, percentComplete, lastAccessedAt, lastLessonId }` |
| `attendanceCount / totalSessions` | `number` | |
| `certificateId` | `string \| null` | |
| `certificateEligible` | `boolean` | |
| `enrolledAt / completedAt / expiredAt` | `Timestamp \| null` | |
| `createdAt / updatedAt` | `Timestamp` | |

### `payments`

Razorpay integration.

| Field | Type | Description |
|-------|------|-------------|
| `id / userId / courseId / institutionId` | `string` | |
| `razorpayOrderId` | `string` | |
| `razorpayPaymentId / razorpaySignature` | `string \| null` | |
| `amount` | `number` | In paise (INR) |
| `currency` | `string` | |
| `status` | `PaymentStatus` | `created \| authorized \| captured \| failed \| refunded \| partially_refunded` |
| `refundId / refundAmount / refundReason` | `string \| number \| null` | |
| `paymentMethod / bankName` | `string \| null` | |
| `receiptNumber` | `string` | |
| `webhookEvents` | `array` | `[{ eventType, receivedAt, payload }]` |
| `paidAt / createdAt / updatedAt` | `Timestamp` | |

### `certificates`

Generated from Google Docs templates, stored in Drive.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | e.g., `CERT-IFS-2026-XXXXX` |
| `userId / courseId / institutionId / enrollmentId` | `string` | |
| `recipientName / courseName / institutionName` | `string` | Snapshot at generation time |
| `issueDate / expiryDate` | `Timestamp` | |
| `googleDocId / pdfDriveFileId / pdfUrl` | `string` | |
| `publicVerificationUrl` | `string` | Public verify page |
| `grade` | `string \| null` | |
| `finalScore` | `number \| null` | |
| `status` | `CertificateStatus` | `generated \| issued \| revoked` |
| `createdAt / updatedAt` | `Timestamp` | |

### `exams`

| Field | Type | Description |
|-------|------|-------------|
| `id / courseId / institutionId` | `string` | |
| `title / description` | `string` | |
| `type` | `ExamType` | `google_forms \| classroom_assignment \| manual` |
| `googleFormsConfig` | `object \| null` | `{ formId, formUrl, responseUrl, spreadsheetId, autoGraded }` |
| `classroomConfig` | `object \| null` | `{ courseWorkId, classroomCourseId, maxPoints, dueDate }` |
| `manualConfig` | `object \| null` | `{ instructions, rubric, maxScore, submissionType }` |
| `passingScore / maxAttempts` | `number` | |
| `timeLimitMinutes` | `number \| null` | |
| `isRequired` | `boolean` | |
| `moduleId` | `string \| null` | |
| `order` | `number` | |
| `status` | `ExamStatus` | `draft \| published \| closed` |
| `createdBy` | `string` | |
| `createdAt / updatedAt` | `Timestamp` | |

### `examAttempts`

| Field | Type | Description |
|-------|------|-------------|
| `id / examId / courseId / userId / institutionId` | `string` | |
| `attemptNumber` | `number` | |
| `status` | `AttemptStatus` | `in_progress \| submitted \| graded \| failed` |
| `score / maxScore / percentageScore` | `number \| null` | |
| `passed` | `boolean \| null` | |
| `submissionUrl / submissionText` | `string \| null` | |
| `evaluatorId / feedback` | `string \| null` | |
| `startedAt / submittedAt / gradedAt` | `Timestamp \| null` | |
| `createdAt` | `Timestamp` | |

### `videoProgress`

Per-lesson video watch tracking with checkpoint quiz responses.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | `{userId}_{lessonId}` |
| `userId / courseId / moduleId / lessonId / institutionId` | `string` | |
| `currentPositionSeconds / totalDurationSeconds / watchedSeconds` | `number` | |
| `watchedPercentage` | `number` | 0–100 |
| `isCompleted` | `boolean` | |
| `checkpointResponses` | `map` | `{ [checkpointId]: { answeredAt, selectedOptionId, textAnswer, isCorrect } }` |
| `watchedSegments` | `array` | `[{ start, end }]` |
| `lastUpdatedAt / createdAt` | `Timestamp` | |

### `attendance`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | `{courseId}_{sessionDate}_{userId}` |
| `courseId / userId / institutionId` | `string` | |
| `sessionDate` | `string` | `"2026-02-15"` |
| `calendarEventId / meetingCode` | `string \| null` | |
| `status` | `AttendanceStatus` | `present \| absent \| late \| excused` |
| `joinedAt / leftAt` | `Timestamp \| null` | |
| `durationMinutes` | `number \| null` | |
| `markedBy` | `string` | UID |
| `syncedFromMeet / syncedFromZoom` | `boolean` | Auto-synced |
| `zoomMeetingId / zoomRegistrantId` | `number \| string \| null` | |
| `notes` | `string \| null` | |
| `createdAt / updatedAt` | `Timestamp` | |

### `zoomMeetings`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Firestore doc ID |
| `zoomMeetingId` | `number` | Zoom's meeting ID |
| `zoomMeetingUuid / institutionId` | `string` | |
| `courseId / sessionId` | `string \| null` | |
| `topic` | `string` | |
| `startTime / endTime` | `string` | ISO 8601 |
| `duration` | `number` | Minutes |
| `joinUrl / startUrl / password` | `string` | |
| `registrationRequired` | `boolean` | |
| `status` | `string` | `scheduled \| started \| ended \| cancelled` |
| `hostEmail / createdBy` | `string` | |
| `participantCount / registrantCount` | `number` | |
| `createdAt / updatedAt` | `Timestamp` | |

**Subcollection:** `zoomMeetings/{id}/participants` — live/past participant records

### `auditLogs`

Immutable audit trail.

| Field | Type | Description |
|-------|------|-------------|
| `id / institutionId / userId / userEmail / userRole` | `string` | |
| `action` | `string` | e.g., `enrollment.create`, `course.update`, `admin.reset_data` |
| `resource / resourceId` | `string` | |
| `details` | `map` | Action-specific data |
| `previousValue / newValue` | `map \| null` | Before/after snapshots |
| `ipAddress / userAgent` | `string \| null` | |
| `severity` | `AuditSeverity` | `info \| warning \| critical` |
| `createdAt` | `Timestamp` | |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, TipTap (Rich Text), Recharts |
| **Backend** | Next.js API Routes, Firebase Admin SDK |
| **Database** | Cloud Firestore (NoSQL, multi-tenant) |
| **Authentication** | Firebase Auth (Google Sign-In) |
| **Cloud Functions** | Firebase Cloud Functions (user creation, cron jobs) |
| **Video** | YouTube IFrame API (react-youtube), Google Drive embed |
| **Payments** | Razorpay (India) |
| **Notifications** | Web Push (VAPID), WhatsApp Cloud API |
| **Live Meetings** | Zoom API v2 (S2S OAuth), Google Meet (Calendar API) |
| **Google APIs** | Calendar, Meet, Classroom, Drive, Docs, Admin SDK |
| **Validation** | Zod v4 |
| **Hosting** | Vercel (Next.js) + Firebase (Cloud Functions) |

---

## Project Structure

```
GoogleWorkspaceEdu/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (offline + push)
│   └── icons/                 # App icons (192, 512)
├── shared/
│   ├── types/                 # Shared TypeScript interfaces
│   │   ├── course.ts          # Course, Module, Lesson, VideoConfig
│   │   ├── enrollment.ts      # Enrollment, LessonProgress
│   │   ├── institution.ts     # Institution, Branding, Settings
│   │   ├── user.ts            # UserProfile, UserAddress, roles
│   │   ├── membership.ts     # InstitutionMembership, JoinMethod
│   │   ├── video-progress.ts  # VideoProgress, WatchedSegment
│   │   ├── payment.ts         # Payment records
│   │   ├── certificate.ts     # Certificate type
│   │   ├── exam.ts            # Exam, ExamAttempt
│   │   └── zoom.ts            # Zoom meeting, registrant, participant types
│   ├── enums/                 # Shared enumerations (incl. MembershipStatus)
│   └── validators/            # Zod validation schemas (incl. membership, zoom)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (PWA meta)
│   │   ├── global-error.tsx        # Global error boundary
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx      # Google Sign-In
│   │   │   └── error.tsx           # Auth error boundary
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar, mobile menu, auth
│   │   │   ├── loading.tsx         # Skeleton loader
│   │   │   ├── error.tsx           # Dashboard error boundary
│   │   │   ├── dashboard/          # Student dashboard
│   │   │   ├── courses/            # Course catalog + learn page
│   │   │   ├── certificates/       # Certificate gallery
│   │   │   ├── complete-profile/   # Profile completion (address + consent)
│   │   │   ├── select-institution/ # Institution browser for new users
│   │   │   ├── profile/            # Profile editing
│   │   │   ├── instructor/         # Instructor panel
│   │   │   └── admin/              # Admin panel
│   │   │       ├── courses/        # Course management
│   │   │       ├── users/          # User management
│   │   │       ├── enrollments/    # Enrollment management
│   │   │       ├── institutions/   # Institution config
│   │   │       ├── admissions/     # Admission request management
│   │   │       ├── analytics/      # Charts & KPIs
│   │   │       ├── zoom/           # Zoom dashboard, meeting details, reports
│   │   │       └── reset-data/     # Data management
│   │   └── api/
│   │       ├── auth/               # Session management
│   │       ├── courses/            # Course CRUD
│   │       ├── enrollments/        # Enrollment + progress
│   │       ├── payments/           # Razorpay integration
│   │       ├── certificates/       # Generation + verification
│   │       ├── exams/              # Exam management
│   │       ├── video-progress/     # Video tracking
│   │       ├── notifications/      # Push + WhatsApp send
│   │       ├── users/              # User management
│   │       ├── institutions/       # Institution CRUD + discovery
│   │       ├── memberships/        # Admission requests + review
│   │       ├── cron/               # Scheduled tasks
│   │       ├── webhooks/           # Razorpay + WhatsApp + Zoom
│   │       └── zoom/              # Zoom meetings CRUD, registrants, reports
│   ├── components/
│   │   ├── VideoPlayer.tsx         # YouTube/Drive player
│   │   ├── CheckpointOverlay.tsx   # Quiz overlay on video
│   │   ├── RichTextEditor.tsx      # TipTap editor
│   │   └── PhoneInput.tsx          # Phone number input
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Firebase auth provider
│   │   └── InstitutionContext.tsx   # Institution config provider
│   ├── hooks/
│   │   ├── usePushNotifications.ts # Push subscription hook
│   │   └── useVideoProgress.ts     # Video progress hook
│   ├── lib/
│   │   ├── firebase/               # Client + Admin SDK init
│   │   ├── google/                 # Google API wrappers
│   │   ├── zoom/                   # Zoom API library
│   │   │   ├── auth.ts             # S2S OAuth token management
│   │   │   ├── client.ts           # Meeting CRUD, registrants, reports
│   │   │   ├── config.ts           # Credential resolver
│   │   │   ├── webhook-verify.ts   # HMAC verification + CRC
│   │   │   ├── attendance.ts       # Participant-to-student matching
│   │   │   └── index.ts            # Barrel export
│   │   ├── notifications/
│   │   │   ├── push.ts             # Web Push (VAPID)
│   │   │   └── whatsapp.ts         # WhatsApp Cloud API
│   │   └── audit-log.ts            # Audit logging
│   └── styles/
│       └── globals.css             # Tailwind + CSS variables
├── functions/
│   └── src/                        # Firebase Cloud Functions
│       ├── index.ts                # Function exports
│       ├── triggers/
│       │   ├── onUserCreate.ts        # Multi-institution user provisioning
│       │   └── onEnrollmentCreate.ts  # Auto-register in Zoom + Classroom
│       └── lib/
│           ├── google-clients.ts   # Google API (server-side)
│           └── zoom-client.ts      # Zoom API for Cloud Functions
├── scripts/
│   ├── seed.ts                     # Seed data for production
│   ├── seed-emulator.ts            # Seed data for emulator
│   └── migrate-to-multi-institution.ts  # Migration script (dry-run supported)
├── firestore.rules                 # Security rules (incl. memberships)
├── package.json
└── tsconfig.json
```

---

## Getting Started

> **For detailed setup instructions, see [CONFIG.md](CONFIG.md).**

### Prerequisites

- **Node.js** 20+ and **npm**
- A **Firebase** project with Firestore, Authentication (Google provider), and Cloud Functions
- A **Google Cloud** project with Calendar, Classroom, Drive, Docs, and Admin SDK APIs enabled
- A **Google Workspace** domain with a service account configured for domain-wide delegation
- A **Razorpay** account (for payments)
- A **Zoom** Pro account with a Server-to-Server OAuth app (for Zoom meetings)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd GoogleWorkspaceEdu

# Install dependencies
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..

# Copy environment file
cp .env.local.example .env.local
```

### Development

```bash
# Start the Next.js dev server
npm run dev

# In another terminal, start Firebase emulators (optional)
firebase emulators:start
```

Visit `http://localhost:3000` to access the application.

---

## White-Label & Customization

This platform is designed to be fully white-labeled and customized for any organization.

- **Platform name** — Set `NEXT_PUBLIC_APP_NAME` in your environment variables to display your own platform name throughout the UI.
- **Institution branding** — Each institution can configure its own logo, colors, tagline, and footer text via the admin panel (Admin > Institutions > Settings).
- **Multi-institution support** — The platform supports multiple institutions simultaneously, each with its own branding, settings, and configuration. No code changes are required to add a new institution.
- **Per-institution settings** — Self-registration, external user access, maintenance mode, locale, and more can be configured independently for each institution.

---

## Environment Variables

Create a `.env.local` file in the project root (or copy from `.env.local.example`). The following environment variables are required:

| Category | Variables |
|----------|-----------|
| **Firebase Client SDK** | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| **Firebase Admin SDK** | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| **Google Workspace** | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_WORKSPACE_ADMIN_EMAIL` |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` |
| **Web Push (VAPID)** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| **WhatsApp (optional)** | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` |
| **Zoom (optional)** | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET`, `ZOOM_DEFAULT_USER_ID` |
| **App** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` |

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

> **For detailed explanations of each variable and step-by-step configuration, see [CONFIG.md](CONFIG.md).**

---

## Deployment

> **For detailed step-by-step setup, see [CONFIG.md](CONFIG.md).**

### Vercel (Next.js)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set all environment variables from `.env.local` in Vercel's project settings
4. Set the **Build Command** to `npm run build`
5. Set the **Output Directory** to `.next`
6. Deploy

### Firebase Cloud Functions

```bash
# Login to Firebase
firebase login

# Deploy functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

### Zoom Setup

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/) and create a **Server-to-Server OAuth** app
2. Note the **Account ID**, **Client ID**, and **Client Secret** — add them to `.env.local`
3. Add required scopes:
   - `meeting:write:meeting:admin` — create/update/delete meetings
   - `meeting:write:registrant:admin` — add registrants
   - `meeting:read:meeting:admin` — view meetings
   - `meeting:read:participant:admin` — view participants
   - `meeting:read:registrant:admin` — view registrants
   - `report:read:meeting:admin` — meeting reports
   - `report:read:list_meeting_participants:admin` — participant reports
4. Under **Feature** > **Event Subscriptions**, add webhook endpoint:
   ```
   https://your-domain.vercel.app/api/webhooks/zoom
   ```
5. Click **Validate** to verify the CRC challenge passes
6. Subscribe to events: `meeting.started`, `meeting.ended`, `meeting.participant_joined`, `meeting.participant_left`
7. Note the **Secret Token** from the webhook config — set as `ZOOM_WEBHOOK_SECRET` in `.env.local` and Vercel
8. Activate the app

---

## Screenshots

> Screenshots will be added after the first production deployment.

---

## Roadmap

- [x] Zoom integration (S2S OAuth, meetings, registrants, webhooks, reports, admin dashboard)
- [x] Performance optimization (session cache, API cache headers, auth retry reduction)
- [x] Multi-institution membership model with admission workflow
- [x] Institution discovery page with country/state filters + invite codes
- [x] Admin admissions panel (approve/reject/transfer with notes)
- [x] Course-type enrollment rules (self_paced/bootcamp open, instructor_led gated)
- [x] Structured address collection (city, state, country, pincode)
- [x] Migration script for existing single-institution users
- [x] Mother/child institution hierarchy (parentInstitutionId, institutionType)
- [x] Auto-enrollment in mother institution on sign-up and child approval
- [x] Cross-institution course visibility (students see mother + child courses)
- [x] Course copy API (deep-copy between institutions)
- [x] Institution branding badges on course cards
- [x] Gender, date of birth, street address fields on student profile
- [x] Age-based guardian requirement (under 13)
- [x] Selective data reset page (admin, per-category deletion with cascading cleanup)
- [ ] Geo-based institution discovery with geocoding API
- [ ] Merged multi-institution dashboard with timezone display
- [ ] Institution switcher in sidebar
- [ ] Google Cloud Storage video streaming with signed URLs
- [ ] Instructor dashboard for video analytics
- [ ] Server-side checkpoint answer validation
- [ ] Discussion forums per course
- [ ] Assignment submission with file uploads (Google Drive)
- [ ] Batch enrollment via CSV upload
- [ ] Multi-language support
- [ ] Mobile app (React Native / Capacitor)
- [ ] AI-powered content recommendations
- [ ] Plagiarism detection for assignments

---

## License

This project is open-source under the [MIT License](LICENSE).

---

Built with [Next.js](https://nextjs.org), [Firebase](https://firebase.google.com), [Google Workspace APIs](https://developers.google.com/workspace), and [Zoom API](https://developers.zoom.us).
