# FlowCare AI — Hospital Operational Intelligence & Digital Twin

FlowCare AI is an operational intelligence layer and real-time digital twin designed for resource-constrained hospitals. It connects admissions, ward prep, transport corridors, CSSD sterile supplies, operating theatres (OT), and recovery departments to track patient journeys, predict delays, analyze root causes, and recommend actionable scheduling improvements.

---

## 🏥 Project Overview
Traditional Hospital Management Systems (HMS) and Electronic Health Records (EHR) focus on billing and clinical history. FlowCare AI is a **software-first operational twin** designed to monitor logistical patient flows, identify clinical bottlenecks in real-time, predict operational delay risks using Machine Learning, and provide interactive recommendations to hospital staff.

### The Five Core Questions answered by FlowCare AI:
1. **What is happening now?** (Visualized in the Command Center & Digital Twin)
2. **Where is the bottleneck?** (Aggregated across CSSD, Anaesthesia, Transfers, and Turnarounds)
3. **Which patient/workflow is at risk of delay?** (Ranked by clinical urgency & operational impact)
4. **Why is the delay happening?** (Analytical Root-Cause Engine)
5. **What action should the staff take?** (Authorized recommendation approval triggers)

---

## 🏗️ System Architecture & Workflow

FlowCare AI operates on a modern event-driven telemetry pattern:
```
Hospital Workflow Events (e.g. PATIENT_READY, TRANSFER_STARTED)
        ↓
FastAPI Backend API
        ↓
SQLite/PostgreSQL Database
        ↓
Workflow Correlation Engine
 ┌─────────────────────────────┐
 │ 1. Checklist Readiness Score│
 │ 2. ML Delay Predictor       │
 │ 3. Priority Engine (CRIT)   │
 │ 4. Root Cause Analyzer      │
 │ 5. Recommendation Generator │
 └──────────────┬──────────────┘
                ↓
  WebSocket Real-Time Broadcast
 ┌──────────────┴──────────────┐
 ↓                             ↓
Admin/OT Dashboard          Mobile Staff App
(Vite + React + TS)          (Flutter / Riverpod)
```

### Logistical Patient Journey Workflow:
```
Admission → Pre-op Prep → Patient Ready → Consent Signed → CSSD Sterile Ready → OT Room Ready → Anaesthesia Prepared → Patient Transfer → OT Arrival → Surgery In Progress → Cleaning Turnaround → Recovery Ward
```

---

## ⚡ Technical Stack

### Backend
- **Framework**: Python 3.11+ / FastAPI
- **Database**: SQLite (default for quick hackathon review) / PostgreSQL support
- **ORM**: SQLAlchemy 2.0 style
- **Real-time**: HTML5 WebSockets (event push)
- **Security**: Password hashing (bcrypt) + JWT role-based access control (RBAC)

### AI / ML
- **Model**: Scikit-Learn Random Forest Regressor
- **Features**: Surgery type, expected duration, OT utilization, Anaesthesia readiness, Patient readiness score, CSSD pack availability, transfer delays, previous delays, surgeon availability.
- **Output**: Delay minutes, risk category (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and prediction confidence (ensemble tree variance).

### Frontend Dashboard
- **Library**: React 18+ with TypeScript
- **Bundler**: Vite
- **UI Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Live Sync**: WebSockets

### Mobile Staff App
- **Framework**: Flutter / Dart
- **State Management**: Riverpod
- **Use Case**: Logistical updates (patient transit, autoclave sterilization cycle)

---

## 📊 Database Schema (Key Tables)
1. **users**: Admin, OT Managers, Nurses, CSSD Staff, Doctors.
2. **patients**: Patient details, clinical urgency, live location, readiness score.
3. **surgeries**: Assigned OT, scheduled times, expected durations, status.
4. **operating_theatres**: Room status (AVAILABLE, PREPARING, ANAESTHESIA, SURGERY, CLEANING), current surgery, utilization.
5. **workflow_events**: Audited timeline logs for event replay.
6. **instrument_packs**: CSSD inventory, sterilization logs, expiry validations.
7. **patient_transfers**: Tracked transfer segments, delay calculations.
8. **predictions**: Saved ML inference results.
9. **recommendations**: Actionable suggestions (e.g., reassign OT, start cycle).
10. **notifications**: Role-based alert notifications (RBAC routing).

---

## ⚙️ Setup & Local Run Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.11+)
- *Optionally*: Docker / Docker Compose

---

### Method A: Running with Docker (Recommended)
1. In the root directory, run:
   ```bash
   docker compose up --build
   ```
2. The services will start:
   - **Frontend**: `http://localhost:3000`
   - **Backend**: `http://localhost:8000`
3. Click the reset button in Settings to automatically initialize the SQLite DB.

---

### Method B: Manual Local Setup (Without Docker)

#### 1. Backend Server Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Seed and train the Machine Learning model:
   ```bash
   python -m app.ml
   ```
5. Run the FastAPI dev server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### 2. Frontend Dashboard Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```
4. Access the web command center at `http://localhost:3000`.

---

## 🛠️ Testing Instructions
We supply automated unit tests covering workflow states, prioritizations, ML, and bottleneck detections.

To execute tests:
1. Ensure your backend virtual environment is active.
2. Run:
   ```bash
   pytest backend/tests/test_backend.py
   ```

---

## 🧪 Hackathon Demo Scenarios

Within the **Settings / Simulator** panel, you can instantly inject four simulation cases:

- **Scenario A (Normal)**: Complete path with no warnings or delay risks.
- **Scenario B (Anaesthesia Delay)**: Incomplete checklist triggers warning, predicted delay, and a recommendation to reassign rooms.
- **Scenario C (CSSD Shortage)**: Missing instrument packs raises alert and suggests autoclave sterilization cycles.
- **Scenario D (Multiple Simultaneous Delays)**: Demonstrates the Priority Engine. Creates 4 delayed surgeries with varying urgency levels. The system prioritizes the Emergency (P102) case and redirects notifications to the respective RBAC role.

### Demo Credentials
- **System Admin**: `admin@flowcare.demo` / password: `password123`
- **OT Manager**: `otmanager@flowcare.demo` / password: `password123`
- **Ward Nurse**: `nurse@flowcare.demo` / password: `password123`
- **CSSD Tech**: `cssd@flowcare.demo` / password: `password123`

---

## ⚠️ Disclaimer
FlowCare AI is a prototype designed for operational intelligence and workflow scheduling support. **All recommendations are purely advisory.** FlowCare AI does not make diagnostic, clinical treatment, or autonomous medical decisions. All clinical determinations must be verified by licensed health professionals. The default model uses synthetic demo data and has not been clinically validated.
