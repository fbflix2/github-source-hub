export interface WarmingProfile {
  id: string;
  profile_code: string;
  profile_name: string | null;
  track_type: string;
  track_days: number;
  start_date: string;
  current_day: number;
  status: string;
  trust_tier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WarmingTask {
  id: string;
  profile_id: string;
  day_number: number;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface OperatorGoal {
  id: string;
  operator_id: string;
  goal_type: string;
  target_profiles: number;
  active: boolean;
}

export interface OperatorStats {
  operatorId: string;
  operatorName: string;
  totalProfiles: number;
  activeProfiles: number;
  completedProfiles: number;
  restrictedProfiles: number;
  checkpointProfiles: number;
  totalTaskTime: number; // seconds
  avgTimePerProfile: number; // seconds
  avgTimePerTask: number; // seconds
  profilesToday: number;
  profilesThisWeek: number;
  dailyGoal: number | null;
  weeklyGoal: number | null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}min ${secs > 0 ? secs + "s" : ""}`.trim();
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins > 0 ? remMins + "min" : ""}`.trim();
}

export function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export const TRACKS: Record<string, { label: string; days: number }> = {
  "7_days": { label: "7 Dias - Básica", days: 7 },
  "15_days": { label: "15 Dias - Média", days: 15 },
  "30_days": { label: "30 Dias - Premium", days: 30 },
};
