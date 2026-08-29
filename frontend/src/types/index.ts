export type UserRole = 'ADMIN' | 'OT_MANAGER' | 'NURSE' | 'CSSD_STAFF' | 'DOCTOR';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  current_location: string;
  readiness_score: number;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  created_at: string;
}

export interface Surgery {
  id: number;
  patient_id: number;
  surgeon: string;
  surgery_type: string;
  assigned_ot: string | null;
  scheduled_start: string;
  expected_duration: number;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  patient?: Patient;
}

export interface OperatingTheatre {
  id: number;
  name: string;
  status: 'AVAILABLE' | 'PREPARING' | 'PATIENT_WAITING' | 'PATIENT_IN_OT' | 'ANAESTHESIA' | 'SURGERY' | 'CLEANING' | 'DELAYED';
  current_surgery: string | null;
  utilization: number;
  available_from: string | null;
}

export interface InstrumentPack {
  id: number;
  pack_type: string;
  sterilization_status: 'REQUESTED' | 'CLEANING' | 'STERILIZING' | 'STERILE' | 'ISSUED' | 'USED' | 'REPROCESSING' | 'EXPIRED' | 'UNAVAILABLE';
  sterilized_at: string | null;
  expiry_at: string | null;
  availability: boolean;
  assigned_surgery_id: number | null;
}

export interface WorkflowEvent {
  id: number;
  patient_id: number | null;
  surgery_id: number | null;
  event_type: string;
  source: string;
  timestamp: string;
  metadata: string | null;
}

export interface PatientTransfer {
  id: number;
  patient_id: number;
  from_location: string;
  to_location: string;
  start_time: string;
  end_time: string | null;
  expected_duration: number;
  actual_duration: number | null;
  delay_minutes: number;
}

export interface Prediction {
  id: number;
  surgery_id: number;
  predicted_delay_minutes: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  created_at: string;
}

export interface Recommendation {
  id: number;
  surgery_id: number;
  recommendation_type: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
  created_at: string;
  surgery_type?: string;
  patient_code?: string;
}

export interface Notification {
  id: number;
  recipient_role: string;
  recipient_user_id: number | null;
  surgery_id: number | null;
  patient_id: number | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'RESOLVED';
  title: string;
  message: string;
  read_status: boolean;
  created_at: string;
}
