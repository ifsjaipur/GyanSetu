# GyanSetu — Google Workspace-Native Education Platform

A secure, scalable Learning Management System built on **Google Workspace** and **Firebase**, designed for Indian educational institutions. GyanSetu (meaning "Bridge of Knowledge") provides end-to-end course management, video-based learning, live class scheduling, payments, certifications, and multi-channel notifications — all from a single, white-label platform.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Multi-Institution Support
- Fully **multi-tenant** — every document scoped by `institutionId`
- Per-institution **white-label branding** (logo, colors, tagline, footer)
- Institution-level settings: self-registration, external user access, maintenance mode, locale
- Admin panel to manage institution configuration without any code changes

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
- Session cookie-based auth for API routes
- External user support (Gmail) with mandatory profile completion
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
- **Firebase Client SDK lazy initialization** — Prevents build failures in Next.js (no env vars at build time).
- **Server-side session cookies** — API routes verify Firebase session cookies, not ID tokens, for better security.
- **Google Workspace service account with domain-wide delegation** — Backend operations (calendar events, Drive files, Classroom sync) run as a service account impersonating an admin user.

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
│   │   ├── user.ts            # UserProfile, roles
│   │   ├── video-progress.ts  # VideoProgress, WatchedSegment
│   │   ├── payment.ts         # Payment records
│   │   ├── certificate.ts     # Certificate type
│   │   ├── exam.ts            # Exam, ExamAttempt
│   │   └── zoom.ts            # Zoom meeting, registrant, participant types
│   ├── enums/                 # Shared enumerations
│   └── validators/            # Zod validation schemas (incl. zoom.validator.ts)
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
│   │   │   ├── profile/            # Profile editing
│   │   │   ├── instructor/         # Instructor panel
│   │   │   └── admin/              # Admin panel
│   │   │       ├── courses/        # Course management
│   │   │       ├── users/          # User management
│   │   │       ├── enrollments/    # Enrollment management
│   │   │       ├── institutions/   # Institution config
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
│   │       ├── institutions/       # Institution CRUD
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
│       │   └── onEnrollmentCreate.ts  # Auto-register in Zoom + Classroom
│       └── lib/
│           ├── google-clients.ts   # Google API (server-side)
│           └── zoom-client.ts      # Zoom API for Cloud Functions
├── firestore.rules                 # Security rules
├── package.json
└── tsconfig.json
```

---

## Getting Started

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
git clone https://github.com/ifsjaipur/GyanSetu.git
cd GyanSetu

# Install dependencies
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..

# Copy environment file
cp .env.example .env.local
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

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-side only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Google Workspace Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_WORKSPACE_ADMIN_EMAIL=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# WhatsApp Cloud API (optional)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=

# Zoom (Server-to-Server OAuth)
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_WEBHOOK_SECRET=
ZOOM_DEFAULT_USER_ID=me

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

---

## Deployment

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
- [ ] Google Cloud Storage video streaming with signed URLs
- [ ] Instructor dashboard for video analytics
- [ ] Server-side checkpoint answer validation
- [ ] Discussion forums per course
- [ ] Assignment submission with file uploads (Google Drive)
- [ ] Batch enrollment via CSV upload
- [ ] Multi-language support (Hindi, Kannada, Marathi)
- [ ] Mobile app (React Native / Capacitor)
- [ ] AI-powered content recommendations
- [ ] Plagiarism detection for assignments

---

## License

This project is proprietary software developed for the [Institute of Financial Studies, Jaipur](https://ifsjaipur.com). All rights reserved.

---

Built with Next.js, Firebase, Google Workspace APIs, and Zoom API.
