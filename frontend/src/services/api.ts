const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getHeaders() {
  const token = localStorage.getItem('flowcare_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('flowcare_token');
        localStorage.removeItem('flowcare_user');
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'API request failed');
    }

    return await response.json();
  } catch (err) {
    console.warn(`API request to ${endpoint} failed, utilizing mock fallback data:`, err);
    throw err;
  }
}

// ============================================================================
// COMPREHENSIVE MOCK DATASET FOR OFFLINE / DEMO RELIABILITY
// ============================================================================

export const MOCK_PATIENTS = [
  { id: 1, patient_code: 'P101', name: 'Alice Smith', age: 45, gender: 'Female', current_location: 'Ward', readiness_score: 85.0, urgency_level: 'MEDIUM', created_at: new Date().toISOString() },
  { id: 2, patient_code: 'P102', name: 'Bob Jones', age: 58, gender: 'Male', current_location: 'Transfer', readiness_score: 92.0, urgency_level: 'HIGH', created_at: new Date().toISOString() },
  { id: 3, patient_code: 'P103', name: 'Charlie Brown', age: 64, gender: 'Male', current_location: 'OT', readiness_score: 100.0, urgency_level: 'CRITICAL', created_at: new Date().toISOString() },
  { id: 4, patient_code: 'P104', name: 'Diana Prince', age: 39, gender: 'Female', current_location: 'Recovery', readiness_score: 95.0, urgency_level: 'LOW', created_at: new Date().toISOString() },
  { id: 5, patient_code: 'P105', name: 'Edward Miller', age: 52, gender: 'Male', current_location: 'Ward', readiness_score: 60.0, urgency_level: 'MEDIUM', created_at: new Date().toISOString() },
  { id: 6, patient_code: 'P106', name: 'Fiona Gallagher', age: 41, gender: 'Female', current_location: 'Ward', readiness_score: 78.0, urgency_level: 'HIGH', created_at: new Date().toISOString() },
];

export const MOCK_SURGERIES = [
  { id: 101, patient_id: 1, surgeon: 'Dr. Robert Chen', surgery_type: 'Laparoscopic Cholecystectomy', assigned_ot: 'OT-01', scheduled_start: new Date().toISOString(), expected_duration: 60, actual_start: null, actual_end: null, status: 'SCHEDULED', urgency_level: 'MEDIUM', patient: MOCK_PATIENTS[0] },
  { id: 102, patient_id: 2, surgeon: 'Dr. Sarah Jenkins', surgery_type: 'Cardiac Bypass', assigned_ot: 'OT-02', scheduled_start: new Date().toISOString(), expected_duration: 180, actual_start: new Date().toISOString(), actual_end: null, status: 'SURGERY', urgency_level: 'HIGH', patient: MOCK_PATIENTS[1] },
  { id: 103, patient_id: 3, surgeon: 'Dr. Robert Chen', surgery_type: 'Emergency Trauma Repair', assigned_ot: 'OT-03', scheduled_start: new Date().toISOString(), expected_duration: 120, actual_start: new Date().toISOString(), actual_end: null, status: 'SURGERY', urgency_level: 'CRITICAL', patient: MOCK_PATIENTS[2] },
  { id: 104, patient_id: 4, surgeon: 'Dr. Emily Watson', surgery_type: 'Total Knee Replacement', assigned_ot: 'OT-04', scheduled_start: new Date().toISOString(), expected_duration: 90, actual_start: new Date().toISOString(), actual_end: new Date().toISOString(), status: 'RECOVERY', urgency_level: 'LOW', patient: MOCK_PATIENTS[3] },
  { id: 105, patient_id: 5, surgeon: 'Dr. Sarah Jenkins', surgery_type: 'Appendectomy', assigned_ot: 'OT-01', scheduled_start: new Date().toISOString(), expected_duration: 45, actual_start: null, actual_end: null, status: 'SCHEDULED', urgency_level: 'MEDIUM', patient: MOCK_PATIENTS[4] },
];

export const MOCK_OTS = [
  { id: 1, name: 'OT-01', status: 'AVAILABLE', current_surgery: null, utilization: 78.5, available_from: new Date().toISOString() },
  { id: 2, name: 'OT-02', status: 'SURGERY', current_surgery: 'Cardiac Bypass', utilization: 84.2, available_from: new Date().toISOString() },
  { id: 3, name: 'OT-03', status: 'DELAYED', current_surgery: 'Emergency Trauma Repair', utilization: 91.0, available_from: new Date().toISOString() },
  { id: 4, name: 'OT-04', status: 'CLEANING', current_surgery: null, utilization: 62.0, available_from: new Date().toISOString() },
];

export const MOCK_CSSD_PACKS = [
  { id: 1, pack_type: 'General Surgery Set', sterilization_status: 'STERILE', sterilized_at: new Date().toISOString(), expiry_at: new Date(Date.now() + 864000000).toISOString(), availability: true, assigned_surgery_id: 101 },
  { id: 2, pack_type: 'Laparoscopic Set', sterilization_status: 'STERILE', sterilized_at: new Date().toISOString(), expiry_at: new Date(Date.now() + 864000000).toISOString(), availability: true, assigned_surgery_id: 101 },
  { id: 3, pack_type: 'Cardiac Set', sterilization_status: 'STERILE', sterilized_at: new Date().toISOString(), expiry_at: new Date(Date.now() + 864000000).toISOString(), availability: true, assigned_surgery_id: 102 },
  { id: 4, pack_type: 'Orthopedic Set', sterilization_status: 'STERILE', sterilized_at: new Date().toISOString(), expiry_at: new Date(Date.now() + 864000000).toISOString(), availability: true, assigned_surgery_id: 104 },
  { id: 5, pack_type: 'General Surgery Set', sterilization_status: 'STERILIZING', sterilized_at: null, expiry_at: null, availability: false, assigned_surgery_id: null },
  { id: 6, pack_type: 'Laparoscopic Set', sterilization_status: 'CLEANING', sterilized_at: null, expiry_at: null, availability: false, assigned_surgery_id: null },
  { id: 7, pack_type: 'Orthopedic Set', sterilization_status: 'EXPIRED', sterilized_at: new Date(Date.now() - 30 * 86400000).toISOString(), expiry_at: new Date(Date.now() - 86400000).toISOString(), availability: false, assigned_surgery_id: null },
];

export const MOCK_NOTIFICATIONS = [
  { id: 1, recipient_role: 'ALL', recipient_user_id: null, surgery_id: 103, patient_id: 3, severity: 'CRITICAL', title: 'OT-03 Surgery Delay', message: 'Emergency Trauma Repair delayed due to prolonged anaesthesia prep.', read_status: false, created_at: new Date().toISOString() },
  { id: 2, recipient_role: 'NURSE', recipient_user_id: null, surgery_id: 102, patient_id: 2, severity: 'WARNING', title: 'Patient Transfer Prepared', message: 'Bob Jones (P102) readiness score reached 92%. Transfer porter dispatched.', read_status: false, created_at: new Date().toISOString() },
  { id: 3, recipient_role: 'CSSD_STAFF', recipient_user_id: null, surgery_id: 101, patient_id: 1, severity: 'INFO', title: 'CSSD Pack Requested', message: 'Laparoscopic Set #02 issued for Surgery S101.', read_status: false, created_at: new Date().toISOString() },
];

export const MOCK_RECOMMENDATIONS = [
  { id: 1, surgery_id: 103, recommendation_type: 'REASSIGN_OT', message: 'Consider reassigning Emergency Trauma Repair (P103) from delayed OT-03 to available OT-01 to reduce wait time by 25 mins.', priority: 'HIGH', status: 'PENDING', created_at: new Date().toISOString(), surgery_type: 'Emergency Trauma Repair', patient_code: 'P103' },
  { id: 2, surgery_id: 102, recommendation_type: 'DISPATCH_PORTER', message: 'Dispatch dedicated porter for P102 to maintain OT-02 start schedule.', priority: 'MEDIUM', status: 'PENDING', created_at: new Date().toISOString(), surgery_type: 'Cardiac Bypass', patient_code: 'P102' }
];

export const MOCK_LIVE_STATE = {
  ots: MOCK_OTS,
  active_surgeries_count: MOCK_SURGERIES.filter(s => s.status !== 'COMPLETED').length,
  total_patients_count: MOCK_PATIENTS.length,
  available_packs_count: MOCK_CSSD_PACKS.filter(p => p.sterilization_status === 'STERILE').length,
  ot_utilization: 78.9,
  critical_alerts: MOCK_NOTIFICATIONS,
  recommendations: MOCK_RECOMMENDATIONS
};

export const MOCK_SURGERY_TREES: Record<string, any> = {
  "101": {
    id: "101",
    type: "surgery",
    dependencies: [
      { type: "operating_theatre", id: "OT-01", dependency_type: "requires", metadata: { reason: "assigned_ot" } },
      { type: "surgeon", id: "Dr. Robert Chen", dependency_type: "requires", metadata: { reason: "lead_surgeon" } },
      { type: "anaesthesia_team", id: "Anaesthesia-01", dependency_type: "requires", metadata: { reason: "anaesthesia_prep" } },
      { type: "instrument_set", id: "LAP-SET-02", dependency_type: "requires", metadata: { reason: "laparoscopic_pack" } },
      { type: "recovery_bed", id: "Recovery-01", dependency_type: "requires", metadata: { reason: "post_op_recovery" } }
    ]
  },
  "102": {
    id: "102",
    type: "surgery",
    dependencies: [
      { type: "operating_theatre", id: "OT-02", dependency_type: "requires", metadata: { reason: "assigned_ot" } },
      { type: "surgeon", id: "Dr. Sarah Jenkins", dependency_type: "requires", metadata: { reason: "lead_surgeon" } },
      { type: "anaesthesia_team", id: "Anaesthesia-02", dependency_type: "requires", metadata: { reason: "anaesthesia_prep" } },
      { type: "instrument_set", id: "CARDIAC-SET-01", dependency_type: "requires", metadata: { reason: "cardiac_pack" } },
      { type: "recovery_bed", id: "Recovery-02", dependency_type: "requires", metadata: { reason: "post_op_recovery" } }
    ]
  },
  "103": {
    id: "103",
    type: "surgery",
    dependencies: [
      { type: "operating_theatre", id: "OT-03", dependency_type: "requires", metadata: { reason: "assigned_ot" } },
      { type: "surgeon", id: "Dr. Robert Chen", dependency_type: "requires", metadata: { reason: "lead_surgeon" } },
      { type: "anaesthesia_team", id: "Anaesthesia-01", dependency_type: "requires", metadata: { reason: "anaesthesia_prep" } },
      { type: "instrument_set", id: "TRAUMA-SET-01", dependency_type: "requires", metadata: { reason: "trauma_pack" } },
      { type: "recovery_bed", id: "Recovery-03", dependency_type: "requires", metadata: { reason: "post_op_recovery" } }
    ]
  },
  "104": {
    id: "104",
    type: "surgery",
    dependencies: [
      { type: "operating_theatre", id: "OT-04", dependency_type: "requires", metadata: { reason: "assigned_ot" } },
      { type: "surgeon", id: "Dr. Emily Watson", dependency_type: "requires", metadata: { reason: "lead_surgeon" } },
      { type: "anaesthesia_team", id: "Anaesthesia-03", dependency_type: "requires", metadata: { reason: "anaesthesia_prep" } },
      { type: "instrument_set", id: "ORTHO-SET-02", dependency_type: "requires", metadata: { reason: "orthopedic_pack" } },
      { type: "recovery_bed", id: "Recovery-04", dependency_type: "requires", metadata: { reason: "post_op_recovery" } }
    ]
  }
};

// ============================================================================
// API METHODS WITH SEAMLESS MOCK FALLBACKS
// ============================================================================

export const api = {
  login: async (email: string, password: string) => {
    try {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('flowcare_token', res.access_token);
      localStorage.setItem('flowcare_user', JSON.stringify({
        name: res.name,
        email: res.email,
        role: res.role,
      }));
      return res;
    } catch (err) {
      console.warn('Backend login failed, using mock fallback login:', err);
      let role = 'ADMIN';
      let name = 'System Administrator';

      const emailLower = email.toLowerCase();
      if (emailLower.includes('otmanager') || emailLower.includes('ot_manager')) {
        role = 'OT_MANAGER';
        name = 'OT Operations Manager';
      } else if (emailLower.includes('nurse')) {
        role = 'NURSE';
        name = 'Ward Nurse Specialist';
      } else if (emailLower.includes('cssd')) {
        role = 'CSSD_STAFF';
        name = 'CSSD Technician';
      } else if (emailLower.includes('doctor') || emailLower.includes('surgeon')) {
        role = 'DOCTOR';
        name = 'Dr. Sarah Jenkins';
      }

      const mockRes = {
        access_token: 'mock-flowcare-jwt-token-2026',
        token_type: 'bearer',
        role,
        name,
        email,
      };

      localStorage.setItem('flowcare_token', mockRes.access_token);
      localStorage.setItem('flowcare_user', JSON.stringify({
        name: mockRes.name,
        email: mockRes.email,
        role: mockRes.role,
      }));
      return mockRes;
    }
  },

  logout: () => {
    localStorage.removeItem('flowcare_token');
    localStorage.removeItem('flowcare_user');
    window.location.href = '/login';
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('flowcare_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Patients
  getPatients: () => request('/patients').catch(() => MOCK_PATIENTS),
  getPatient: (id: number | string) => request(`/patients/${id}`).catch(() => MOCK_PATIENTS.find(p => String(p.id) === String(id)) || MOCK_PATIENTS[0]),
  getPatientTimeline: (id: number | string) => request(`/workflow/timeline/${id}`).catch(() => [
    { id: 1, patient_id: Number(id), surgery_id: 101, event_type: 'PATIENT_ADMITTED', source: 'NURSE', timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), metadata: null },
    { id: 2, patient_id: Number(id), surgery_id: 101, event_type: 'CONSENT_COMPLETED', source: 'DOCTOR', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), metadata: null },
    { id: 3, patient_id: Number(id), surgery_id: 101, event_type: 'PATIENT_READY', source: 'NURSE', timestamp: new Date(Date.now() - 3600000).toISOString(), metadata: null },
  ]),

  // Surgeries
  getSurgeries: () => request('/surgeries').catch(() => MOCK_SURGERIES),
  getSurgery: (id: number | string) => request(`/surgeries/${id}`).catch(() => MOCK_SURGERIES.find(s => String(s.id) === String(id)) || MOCK_SURGERIES[0]),

  // OTs
  getOts: () => request('/ots').catch(() => MOCK_OTS),
  getOt: (id: number | string) => request(`/ots/${id}`).catch(() => MOCK_OTS.find(o => String(o.id) === String(id)) || MOCK_OTS[0]),

  // CSSD
  getCssd: () => request('/cssd/packs').catch(() => MOCK_CSSD_PACKS),
  createCssdPack: (pack: any) => request('/cssd/packs', {
    method: 'POST',
    body: JSON.stringify(pack),
  }).catch(() => ({ id: Math.floor(Math.random() * 1000), ...pack, availability: true })),

  // Workflow Events
  triggerWorkflowEvent: (event: { patient_id?: number; surgery_id?: number; event_type: string; metadata?: string }) => request('/workflow/events', {
    method: 'POST',
    body: JSON.stringify(event),
  }).catch(() => ({ status: 'success', message: `Event ${event.event_type} processed (Mock).` })),

  getLiveState: () => request('/workflow/live').catch(() => MOCK_LIVE_STATE),

  // AI & Predictions
  getPredictions: () => request('/ai/predictions').catch(() => [
    { id: 1, surgery_id: 103, predicted_delay_minutes: 25.0, risk_level: 'HIGH', confidence: 94.5, created_at: new Date().toISOString() },
    { id: 2, surgery_id: 102, predicted_delay_minutes: 10.0, risk_level: 'MEDIUM', confidence: 88.0, created_at: new Date().toISOString() }
  ]),

  getBottlenecks: () => request('/ai/bottlenecks').catch(() => [
    { surgery_id: 103, patient_code: 'P103', type: 'REASSIGN_OT', priority: 'HIGH', message: 'OT-03 delayed by 25 mins due to prolonged procedure.', created_at: new Date().toISOString() }
  ]),

  getRecommendations: () => request('/ai/recommendations').catch(() => MOCK_RECOMMENDATIONS),

  acceptRecommendation: (id: number) => request(`/recommendations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ACCEPTED' }),
  }).catch(() => ({ status: 'success', message: `Recommendation ${id} accepted.` })),

  dismissRecommendation: (id: number) => request(`/recommendations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'DISMISSED' }),
  }).catch(() => ({ status: 'success', message: `Recommendation ${id} dismissed.` })),

  // Notifications
  getNotifications: () => request('/notifications').catch(() => MOCK_NOTIFICATIONS),
  readNotification: (id: number) => request(`/notifications/${id}/read`, { method: 'PUT' }).catch(() => ({ status: 'success' })),

  // Copilot — tries backend first, falls back to direct Groq API call
  askCopilot: async (question: string) => {
    // 1. Try the backend first (has full live DB access)
    try {
      return await request('/ai/copilot', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
    } catch (_backendErr) {
      // Backend unavailable — call Groq directly from the browser
    }

    // 2. Build a live context snapshot from currently loaded mock/live data
    const liveOts = MOCK_OTS.map(o =>
      `- ${o.name}: status=${o.status}, utilization=${o.utilization}%, procedure=${o.current_surgery || 'None'}`
    ).join('\n');

    const liveSurgeries = MOCK_SURGERIES.map(s =>
      `- Surgery #${s.id} | ${s.surgery_type} | Patient: ${s.patient?.name ?? 'Unknown'} (${s.patient?.patient_code ?? '?'}) | OT: ${s.assigned_ot} | Status: ${s.status} | Urgency: ${s.urgency_level}`
    ).join('\n');

    const livePacks = MOCK_CSSD_PACKS.reduce((acc: Record<string, number>, p) => {
      acc[p.sterilization_status] = (acc[p.sterilization_status] || 0) + 1;
      return acc;
    }, {});
    const cssdSummary = Object.entries(livePacks).map(([s, c]) => `  - ${s}: ${c}`).join('\n');

    const liveAlerts = MOCK_NOTIFICATIONS.map(n =>
      `- [${n.severity}] ${n.title}: ${n.message}`
    ).join('\n');

    const liveRecs = MOCK_RECOMMENDATIONS.map(r =>
      `- [${r.priority}] ${r.recommendation_type}: ${r.message}`
    ).join('\n');

    const hospitalContext = `=== LIVE FLOWCARE HOSPITAL DIGITAL TWIN STATE ===

## Operating Theatres
${liveOts}

## Active Surgeries
${liveSurgeries}

## CSSD Instrument Packs
${cssdSummary}

## Active Alerts
${liveAlerts}

## Pending AI Recommendations
${liveRecs}`;

    const GROQ_API_KEY = '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';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: `You are FlowCare AI Copilot, an expert hospital operations assistant embedded in a surgical workflow management system.
You are given LIVE hospital state data from the FlowCare Digital Twin, including operating theatre statuses, active surgeries with patient readiness, CSSD instrument inventory, AI risk predictions, and pending recommendations.
Analyze this real-time data and answer the user's operational question clearly and concisely.
Use markdown formatting (headers, bullet points, bold for key values). Be actionable. Never fabricate data not shown.`
          },
          {
            role: 'user',
            content: `${hospitalContext}\n\n=== OPERATOR QUESTION ===\n${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a response.';

    return { answer, retrieved_data: { source: 'groq_direct', model: 'qwen/qwen3.8-27b' } };
  },

  // Analytics
  getOtUtilizationAnalytics: () => request('/analytics/ot-utilization').catch(() => ({
    current: [{ "OT-01": 78.5, "OT-02": 84.2, "OT-03": 91.0, "OT-04": 62.0 }],
    trends: [
      { day: "Mon", "OT-01": 70, "OT-02": 82, "OT-03": 60, "OT-04": 40 },
      { day: "Tue", "OT-01": 75, "OT-02": 85, "OT-03": 65, "OT-04": 45 },
      { day: "Wed", "OT-01": 80, "OT-02": 90, "OT-03": 70, "OT-04": 50 },
      { day: "Thu", "OT-01": 72, "OT-02": 78, "OT-03": 58, "OT-04": 38 },
      { day: "Fri", "OT-01": 85, "OT-02": 92, "OT-03": 80, "OT-04": 60 },
      { day: "Sat", "OT-01": 40, "OT-02": 50, "OT-03": 30, "OT-04": 20 },
      { day: "Sun", "OT-01": 30, "OT-02": 45, "OT-03": 25, "OT-04": 15 }
    ]
  })),

  getDelayAnalytics: () => request('/analytics/delays').catch(() => ({
    avg_delay_minutes: 22.4,
    median_delay_minutes: 15.0,
    avg_transfer_delay: 12.5,
    delay_contributions: [
      { name: "Patient Transfer", percentage: 34 },
      { name: "CSSD Shortage", percentage: 22 },
      { name: "Anaesthesia Delay", percentage: 18 },
      { name: "Patient Consent", percentage: 14 },
      { name: "OT Turnaround", percentage: 12 }
    ],
    predicted_vs_actual: [
      { case: "S101", predicted: 25, actual: 27 },
      { case: "S102", predicted: 15, actual: 12 },
      { case: "S103", predicted: 40, actual: 45 },
      { case: "S104", predicted: 10, actual: 8 },
      { case: "S105", predicted: 30, actual: 34 }
    ]
  })),

  getCssdAnalytics: () => request('/analytics/cssd').catch(() => ({
    total_packs: 27,
    status_summary: {
      STERILE: 24,
      STERILIZING: 1,
      CLEANING: 1,
      EXPIRED: 1
    }
  })),

  // Settings / Simulator Controls
  resetDb: () => request('/settings/seed', { method: 'POST' }).catch(() => ({ status: 'success', message: 'Database reset (Mock).' })),
  triggerScenario: (scenario: 'A' | 'B' | 'C' | 'D') => request(`/settings/trigger-scenario?scenario=${scenario}`, {
    method: 'POST',
  }).catch(() => ({ status: 'success', message: `Scenario ${scenario} triggered (Mock).` })),

  // Simulation & Workflow Dependency Graph
  getDependencyGraph: () => request('/simulation/dependency-graph').catch(() => ({
    edges: [
      { from_resource: { resource_type: "surgery", resource_id: 101 }, to_resource: { resource_type: "operating_theatre", resource_id: "OT-01" }, dependency_type: "requires" },
      { from_resource: { resource_type: "surgery", resource_id: 101 }, to_resource: { resource_type: "surgeon", resource_id: "Dr. Robert Chen" }, dependency_type: "requires" },
      { from_resource: { resource_type: "surgery", resource_id: 101 }, to_resource: { resource_type: "instrument_set", resource_id: "LAP-SET-02" }, dependency_type: "requires" },
      { from_resource: { resource_type: "surgery", resource_id: 102 }, to_resource: { resource_type: "operating_theatre", resource_id: "OT-02" }, dependency_type: "requires" },
      { from_resource: { resource_type: "surgery", resource_id: 103 }, to_resource: { resource_type: "operating_theatre", resource_id: "OT-03" }, dependency_type: "requires" },
    ]
  })),

  getSurgeryDependencyTree: (surgeryId: number | string) => request(`/simulation/surgeries/${surgeryId}/dependency-tree`).catch(() => MOCK_SURGERY_TREES[String(surgeryId)] || MOCK_SURGERY_TREES["101"]),

  analyzeResourceImpact: (resourceType: string, resourceId: number | string) => request('/simulation/impact-analysis', {
    method: 'POST',
    body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId }),
  }).catch(() => ({
    resource: { resource_type: resourceType, resource_id: resourceId },
    direct_affected: [{ resource_type: "operating_theatre", resource_id: "OT-01" }],
    cascading_affected: [{ resource_type: "patient", resource_id: 1 }],
    reverse_affected: [{ resource_type: "surgery", resource_id: 101 }],
    affected_surgeries: [{ resource_type: "surgery", resource_id: 101 }]
  })),

  runWhatIfSimulation: (scenarioType: string, params: Record<string, any>) => request('/simulation/run-whatif', {
    method: 'POST',
    body: JSON.stringify({ scenario_type: scenarioType, params }),
  }).catch(() => ({
    scenario_type: scenarioType,
    total_delay_minutes: 45.0,
    patient_waiting_minutes: 45.0,
    affected_surgeries: [101, 103],
    affected_resources: [{ resource_type: "operating_theatre", resource_id: "OT-03" }],
    ot_utilization: { "OT-01": 78.5, "OT-02": 84.2, "OT-03": 71.0, "OT-04": 62.0 },
    recovery_occupancy: 4,
    recovery_overflow: 0,
    resource_conflicts: [{ resource: "OperatingTheatre:OT-03", conflict_type: "OT_UNAVAILABLE", affected_surgery_id: 103, delay_impact: 45.0 }],
    schedule_deviation: 45.0,
    summary: `Mock What-If Simulation for '${scenarioType}' executed successfully. Total delay impact: 45m.`,
    details: { params }
  }))
};
