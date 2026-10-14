# CampusFlow V2 — Enterprise Placement Management System

CampusFlow is a production-grade, single-college Placement Management System built with a **React + Vite** frontend, a **Node.js + Express** backend, and a **MongoDB + Mongoose** database. 

It streamlines the entire campus recruitment lifecycle: multiple placement sessions, department and cohort mappings, structured student profiles, independent SGPA and official CGPA tracking, drive-specific student data requirements, strict backend eligibility evaluation, immutable submission snapshots, and authorized candidate exports for recruiting companies.

---

## 🚀 Key Features in CampusFlow V2

### 1. Multi-Cohort Placement Session Management
- **Explicit Cohort Isolation:** Support for graduating classes (2025–26, 2026–27, 2027–28, etc.).
- **Session Lifecycle:** `UPCOMING` → `ACTIVE` → `CLOSED` → `ARCHIVED`.
- **Deterministic Mapping:** Students are automatically assigned to placement sessions based on admission year and standard degree durations.
- **Cross-Session Safeguards:** TPO dashboard filters ensure drives, candidate rosters, and statistics never mix across distinct academic cohorts.

### 2. Comprehensive Student Profile & Academic Integrity
- **Independent Semester SGPA (Semesters 1 to 8):** Stored independently. Missing or future semesters remain `Not entered` and are never silently converted to zero or averaged.
- **Preserved Official CGPA:** Overall CGPA is entered by the student from their official transcript and is never computed or overwritten by automatic averaging.
- **Dedicated Class 10 & 12/Diploma Records:** Dynamic qualification selector (`Class 12 / PUC` vs. `Diploma` vs. `Equivalent`) displaying only relevant fields (e.g. diploma branch vs. board of education).
- **Education & Year-Gap Management:** Dedicated section for gap declarations with duration, reason categorizations, and supporting documents. Education gaps are **not** treated as automatic disqualifiers unless an explicit drive criterion is configured.
- **Family Details & Address Confidentiality:** Parents' details, phone numbers, and addresses are strictly protected with role-based access control and excluded from company exports by default.

### 3. Drive-Specific Student Data Requirements
- **Configurable Matrix per Drive:** TPO officers can independently configure three flags for every student profile attribute:
  1. `requiredToApply`: Student must have valid data to submit an application.
  2. `visibleToTpo`: Displayed to authorized TPO officers in candidate inspection views.
  3. `shareWithCompany`: Included in company applicant exports.
- **Controlled Field Catalogue:** All fields are validated against a server-side allowlist (`fullName`, `usn`, `cgpa`, `semesterSGPA`, `activeBacklogs`, `tenthPercentage`, `twelfthOrDiploma`, `resume`, etc.).
- **Privacy Warnings:** Explicit banner alerts when sensitive family information is marked for export.

### 4. Student Pre-Application Checklist & Immutable Submission Snapshot
- **Real-Time Precheck (`GET /:driveId/precheck`):** Displays which requirements are satisfied, which profile fields or documents are missing, and eligibility status before applying.
- **Click-to-Edit Dashboard Integration:** Direct navigation from missing profile chips to the specific drawer section in edit mode.
- **Immutable Submission Snapshots:** When applying, the backend captures an immutable `submittedSnapshot` of the candidate's exact profile state (CGPA, SGPAs, marks, resume reference) at the moment of submission. Subsequent profile edits do not alter historical applications.

### 5. Company Candidate Export & Compliance Audit Log
- **Multi-Format Export (`POST /:driveId/export`):** Formatted CSV and Excel-compatible reports with **UTF-8 Byte Order Mark (`\uFEFF`)** for seamless character rendering in Microsoft Excel.
- **Privacy by Default:** Sensitive family information and private addresses are excluded unless explicitly selected.
- **Audit Logging:** Every export event is permanently logged in the `ExportLog` collection (`exportedBy`, `driveId`, `applicantCount`, `exportedFields`, `timestamp`, `ipAddress`).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios, React Hot Toast, React Router DOM |
| **Backend** | Node.js, Express.js (ES Modules), Mongoose, JWT (`jsonwebtoken`), Bcrypt |
| **Database** | MongoDB Atlas / Local MongoDB (replica-set compatible) |
| **File Storage** | Cloudinary / Local Multer storage for avatars, resumes, and marksheets |
| **Email & Alerts** | Nodemailer (SMTP / Gmail) with HTML notifications |

---

## 🔑 Canonical Accounts & Credentials

The system comes pre-configured with default credentials for evaluation and demonstration:

### 1. Training & Placement Officer (TPO Admin)
- **Email:** `admin@campusflow.edu`
- **Password:** `Admin@12345`
- **Role:** `admin` (Head of Training & Placement)
- **Employee ID:** `TPO-2026-001`
- **Console:** [`http://localhost:5173/admin-dashboard`](http://localhost:5173/admin-dashboard)
- **Admin Secret Passkey:** `TPO_ADMIN_2026` *(for provisioning additional TPO accounts via `/api/v1/admin/register`)*

### 2. Canonical Demo Student
- **Email:** `student@campusflow.edu`
- **USN / Roll Number:** `1MS23CS001` *(supports login via email or USN)*
- **Password:** `Student@12345`
- **Program:** Computer Science and Engineering (`B.Tech`, 2023–2027)
- **Placement Cohort:** Placement Session 2026–2027 (Active)
- **Profile Status:** Verified complete academic profile (CGPA: 8.75, Semesters 1–4 SGPAs, Class 10 & 12 details, 0 backlogs, resume attached). Eligible for active drives out-of-the-box.

### 3. Brand New Student (Zero Data Start)
- Students registering via **`/signup`** start with a **clean, fresh profile with zero pre-filled academic data** (CGPA and SGPA are unentered/null, never fabricated or coerced to 0).
- Completing the profile drawer unlocks drive eligibility dynamically.

---

## 📂 Project Structure

```text
campus_flow/
├── frontend/                     # React + Vite Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/           # TPO Management (Drives, Applications, Students, Sessions, Export)
│   │   │   └── studentDashboard/# ProfileDrawer, ApplyModal, Stats, Drive Cards
│   │   ├── context/             # AuthContext with persistent JWT session
│   │   ├── pages/
│   │   │   ├── admin/           # Admin Dashboard Console
│   │   │   ├── auth/            # Login (with 1-Click Demo Fillers) & Multi-Step Signup
│   │   │   └── student/         # Student Portal & Application Tracker
│   │   └── services/            # Axios API Clients
│   └── package.json
│
└── major-backend/                # Node.js + Express API Server
    ├── src/
    │   ├── controllers/         # Application, Drive, StudentProfile, Session, Admin controllers
    │   ├── models/              # StudentProfile, PlacementDrive, Application, PlacementSession, ExportLog
    │   ├── routes/              # Express API Route Handlers
    │   ├── middlewares/         # JWT Verification, Role Authorization, Security Limiter
    │   ├── scripts/
    │   │   └── seedCleanState.js# Pristine database reset & canonical seed script
    │   └── db/                  # MongoDB Connection Manager
    ├── tests/                   # Automated E2E & Unit Test Suites
    └── package.json
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB:** Active MongoDB Atlas URI or local instance running on port 27017

### 1. Environment Setup

#### Backend Configuration (`major-backend/.env`)
Create `major-backend/.env` with the following variables:
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/placement_portal
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

ACCESS_TOKEN_SECRET=your_super_secret_access_key_min_64_chars
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_min_64_chars
REFRESH_TOKEN_EXPIRY=7d

ADMIN_SECRET_KEY=TPO_ADMIN_2026
FRONTEND_URL=http://localhost:5173
```

#### Frontend Configuration (`frontend/.env`)
Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000/api/v1
```

### 2. Install Dependencies

```powershell
# In major-backend
cd major-backend
npm install

# In frontend
cd ../frontend
npm install
```

### 3. Initialize & Seed Pristine Database

To reset the database, purge test artifacts, and provision official placement sessions, departments, TPO officer, demo student, and an active drive:
```powershell
cd major-backend
node src/scripts/seedCleanState.js
```

### 4. Run the Development Servers

```powershell
# Terminal 1 - Backend Server (Port 8000)
cd major-backend
npm run dev

# Terminal 2 - Frontend Client (Port 5173)
cd frontend
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## 🧪 Automated Test Verification

CampusFlow V2 includes comprehensive end-to-end regression and verification test suites:

```powershell
cd major-backend

# 1. Clean Start, Demo Accounts & New Student Lifecycle Test Suite (15 Tests)
node tests/clean_start_demo_verification.mjs

# 2. Drive Requirements, Pre-Check & Candidate Export Suite (22 Tests)
node tests/profile_requirements_export_verification.mjs

# 3. Student Registration & Placement Session Assignment Suite (43 Tests)
node tests/registration_session_verification.mjs

# 4. Centralized Eligibility Engine & Application State Machine (66 Tests)
node tests/phase4_phase5_verification.mjs
```

---

## 📡 API Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/users/login` | Public | Authenticates student with email or USN / password |
| `POST` | `/api/v1/admin/login` | Public | Authenticates TPO admin officer |
| `POST` | `/api/v1/users/register` | Public | Registers a new student with session & department mapping |
| `GET` | `/api/v1/placementdrive/all-drives` | Authenticated | Lists placement drives scoped by session & department |
| `GET` | `/api/v1/placementdrive/field-catalogue` | Admin | Returns catalogue of available profile requirements |
| `GET` | `/api/v1/application/:driveId/precheck` | Student | Pre-application checklist checking required fields & eligibility |
| `POST` | `/api/v1/application/:driveId/apply` | Student | Submits drive application with immutable snapshot |
| `POST` | `/api/v1/application/:driveId/export` | Admin | Exports candidates in CSV (with UTF-8 BOM) or Excel format |
| `GET` | `/api/v1/sessions` | Public / Admin | Returns placement sessions with active cohort status |
| `GET` | `/api/v1/departments` | Public | Returns active college academic departments |

---

## 🔒 Security & Data Privacy

1. **Role-Based Middleware:** Routes enforce `verifyJWT`, `verifyStudent`, and `verifyAdmin` strictly on the backend.
2. **Session Immutability:** Students cannot mutate their assigned `placementSession` via payload injection.
3. **No Credential Leakage:** User passwords and tokens are explicitly stripped via Mongoose projection (`-password -refreshToken`).
4. **Confidential Family Records:** Parents' occupations, phone numbers, and addresses are strictly excluded from default corporate exports.
5. **Rate Limiting:** Prevents brute-force login attempts and repeated application submissions.

---

## 📄 License
This project is proprietary and developed for collegiate placement management and recruitment automation.
