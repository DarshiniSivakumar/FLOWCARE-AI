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
      window.location.href = '/login';
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'API request failed');
  }

  return response.json();
}

export const api = {
  login: async (email: string, password: string) => {
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
  getPatients: () => request('/patients'),
  getPatient: (id: number | string) => request(`/patients/${id}`),
  getPatientTimeline: (id: number | string) => request(`/workflow/timeline/${id}`),

  // Surgeries
  getSurgeries: () => request('/surgeries'),
  getSurgery: (id: number | string) => request(`/surgeries/${id}`),

  // OTs
  getOts: () => request('/ots'),
  getOt: (id: number | string) => request(`/ots/${id}`),

  // CSSD
  getCssd: () => request('/cssd/packs'),
  createCssdPack: (pack: any) => request('/cssd/packs', {
    method: 'POST',
    body: JSON.stringify(pack),
  }),

  // Workflow Events
  triggerWorkflowEvent: (event: { patient_id?: number; surgery_id?: number; event_type: string; metadata?: string }) => request('/workflow/events', {
    method: 'POST',
    body: JSON.stringify(event),
  }),
  getLiveState: () => request('/workflow/live'),

  // AI & Predictions
  getPredictions: () => request('/ai/predictions'),
  getBottlenecks: () => request('/ai/bottlenecks'),
  getRecommendations: () => request('/ai/recommendations'),
  acceptRecommendation: (id: number) => request(`/recommendations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ACCEPTED' }),
  }),
  dismissRecommendation: (id: number) => request(`/recommendations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'DISMISSED' }),
  }),

  // Notifications
  getNotifications: () => request('/notifications'),
  readNotification: (id: number) => request(`/notifications/${id}/read`, { method: 'PUT' }),

  // Copilot
  askCopilot: (question: string) => request('/ai/copilot', {
    method: 'POST',
    body: JSON.stringify({ question }),
  }),

  // Analytics
  getOtUtilizationAnalytics: () => request('/analytics/ot-utilization'),
  getDelayAnalytics: () => request('/analytics/delays'),
  getCssdAnalytics: () => request('/analytics/cssd'),

  // Settings / Simulator Controls
  resetDb: () => request('/settings/seed', { method: 'POST' }),
  triggerScenario: (scenario: 'A' | 'B' | 'C' | 'D') => request(`/settings/trigger-scenario?scenario=${scenario}`, {
    method: 'POST',
  }),
};
