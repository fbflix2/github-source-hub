export interface ProfileQualityData {
  has2FA: boolean;
  hasBM: boolean;
  hasPage: boolean;
  friendRange: string;
  profileYear?: number | null;
}

export interface ProfileQualityWithSource {
  has2FA: boolean;
  has2FA_source: "manual" | "task" | "both" | null;
  hasBM: boolean;
  hasBM_source: "manual" | "task" | "both" | null;
  hasPage: boolean;
  hasPage_source: "manual" | "task" | "both" | null;
  friendRange: string;
  profileYear?: number | null;
}

export interface ReadyCriteria {
  minFriends: number;
  require2FA: boolean;
  optionalBmMin: number;
  optionalBmMax: number;
  optionalPage: boolean;
  minWarmingDays: number;
}

export interface ReadyProfileLike {
  start_date?: string;
  created_at: string;
}

export interface QualityEvidenceTaskLike {
  title: string;
  description?: string | null;
  completed?: boolean;
}

export const DEFAULT_PROFILE_QUALITY_DATA: ProfileQualityData = {
  has2FA: false,
  hasBM: false,
  hasPage: false,
  friendRange: "0-5",
  profileYear: null,
};

export const DEFAULT_READY_CRITERIA: ReadyCriteria = {
  minFriends: 20,
  require2FA: true,
  optionalBmMin: 1,
  optionalBmMax: 2,
  optionalPage: true,
  minWarmingDays: 7,
};

const FRIEND_RANGE_MIN: Record<string, number> = {
  "0-5": 0,
  "5-19": 5,
  "20-50": 20,
  "50-100+": 50,
};

const FRIEND_RANGE_FROM_COUNT = [
  { min: 50, value: "50-100+" },
  { min: 20, value: "20-50" },
  { min: 5, value: "5-19" },
];

// Broader patterns to match real task titles from the database
const QUALITY_EVIDENCE_PATTERNS = {
  has2FA: [
    /2fa/i,
    /dois fatores/i,
    /two.?factor/i,
    /autenticacao/i,
  ],
  hasBM: [
    /\bbm\b/i,
    /business\s*manager/i,
    /ad\s*account/i,
    /conta\s*de\s*anun/i,
    /criar\s+bm/i,
    /bm\s*(fully|check|criada)/i,
  ],
  hasPage: [
    /bm\s*\/\s*page/i,
    /\bposts?\s+na\s+page\b/i,
    /criar\s+p[aá]g/i,
    /p[aá]gina\s+caso/i,
    /page\s+criada/i,
    /postar\s+(sua\s+)?p[aá]gina/i,
  ],
};

function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function taskMatchesEvidence(task: QualityEvidenceTaskLike, patterns: RegExp[]): boolean {
  if (task.completed === false) return false;

  const rawText = `${task.title} ${task.description ?? ""}`;
  const normalized = normalizeEvidenceText(rawText);
  
  return patterns.some((pattern) => {
    // Test both original and normalized text for patterns with special chars
    return pattern.test(rawText) || pattern.test(normalized);
  });
}

function inferFriendCountFromTasks(tasks: QualityEvidenceTaskLike[]): number {
  return tasks.reduce((total, task) => {
    if (task.completed === false) return total;

    const normalized = normalizeEvidenceText(`${task.title} ${task.description ?? ""}`);
    if (!/amig/.test(normalized)) return total;

    let taskTotal = 0;
    const rangeMatches = normalized.matchAll(/(?:adicionar|add|adicionando)?\s*(?:de\s*)?(\d+)\s*a\s*(\d+)\s+amig/g);
    for (const match of rangeMatches) {
      taskTotal += Number(match[1] || 0);
    }

    const singleMatches = normalized.matchAll(/(?:adicionar|add|adicionando)\s+(\d+)\s+amig/g);
    for (const match of singleMatches) {
      taskTotal += Number(match[1] || 0);
    }

    return total + taskTotal;
  }, 0);
}

function getInferredFriendRange(tasks: QualityEvidenceTaskLike[]): string | null {
  const friendCount = inferFriendCountFromTasks(tasks);
  return FRIEND_RANGE_FROM_COUNT.find((range) => friendCount >= range.min)?.value || null;
}

export function getEffectiveProfileQuality(
  quality: Partial<ProfileQualityData> | undefined,
  tasks: QualityEvidenceTaskLike[] = [],
): ProfileQualityData {
  const inferredFriendRange = getInferredFriendRange(tasks);
  return {
    has2FA:
      Boolean(quality?.has2FA) ||
      tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.has2FA)),
    hasBM:
      Boolean(quality?.hasBM) ||
      tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.hasBM)),
    hasPage:
      Boolean(quality?.hasPage) ||
      tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.hasPage)),
    friendRange: quality?.friendRange && quality.friendRange !== DEFAULT_PROFILE_QUALITY_DATA.friendRange
      ? quality.friendRange
      : inferredFriendRange || quality?.friendRange || DEFAULT_PROFILE_QUALITY_DATA.friendRange,
  };
}

export function getEffectiveProfileQualityWithSource(
  quality: Partial<ProfileQualityData> | undefined,
  tasks: QualityEvidenceTaskLike[] = [],
): ProfileQualityWithSource {
  const manual2FA = Boolean(quality?.has2FA);
  const task2FA = tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.has2FA));
  const manualBM = Boolean(quality?.hasBM);
  const taskBM = tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.hasBM));
  const manualPage = Boolean(quality?.hasPage);
  const taskPage = tasks.some((task) => taskMatchesEvidence(task, QUALITY_EVIDENCE_PATTERNS.hasPage));
  const inferredFriendRange = getInferredFriendRange(tasks);

  function source(manual: boolean, task: boolean): "manual" | "task" | "both" | null {
    if (manual && task) return "both";
    if (manual) return "manual";
    if (task) return "task";
    return null;
  }

  return {
    has2FA: manual2FA || task2FA,
    has2FA_source: source(manual2FA, task2FA),
    hasBM: manualBM || taskBM,
    hasBM_source: source(manualBM, taskBM),
    hasPage: manualPage || taskPage,
    hasPage_source: source(manualPage, taskPage),
    friendRange: quality?.friendRange && quality.friendRange !== DEFAULT_PROFILE_QUALITY_DATA.friendRange
      ? quality.friendRange
      : inferredFriendRange || quality?.friendRange || DEFAULT_PROFILE_QUALITY_DATA.friendRange,
    profileYear: quality?.profileYear ?? null,
  };
}

export function parseReadyCriteria(value: unknown): ReadyCriteria {
  if (!value || typeof value !== "object") return DEFAULT_READY_CRITERIA;

  const raw = value as Partial<ReadyCriteria>;

  return {
    minFriends: Number(raw.minFriends ?? DEFAULT_READY_CRITERIA.minFriends),
    require2FA: Boolean(raw.require2FA ?? DEFAULT_READY_CRITERIA.require2FA),
    optionalBmMin: Number(raw.optionalBmMin ?? DEFAULT_READY_CRITERIA.optionalBmMin),
    optionalBmMax: Number(raw.optionalBmMax ?? DEFAULT_READY_CRITERIA.optionalBmMax),
    optionalPage: Boolean(raw.optionalPage ?? DEFAULT_READY_CRITERIA.optionalPage),
    minWarmingDays: Number(raw.minWarmingDays ?? DEFAULT_READY_CRITERIA.minWarmingDays),
  };
}

export function getProfileWarmingDays(profile: ReadyProfileLike): number {
  const startedAt = new Date(profile.start_date || profile.created_at).getTime();
  const diffMs = Date.now() - startedAt;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function isProfileReadyForSale(
  profile: ReadyProfileLike,
  quality: ProfileQualityData,
  criteria: ReadyCriteria,
): boolean {
  const minFriendsReached = (FRIEND_RANGE_MIN[quality.friendRange] ?? 0) >= criteria.minFriends;
  const daysReached = getProfileWarmingDays(profile) >= criteria.minWarmingDays;

  // Atalho: perfil já atingiu Nível 3 (2FA + BM + Página + amigos suficientes)
  // pode ser dado como pronto imediatamente, sem precisar cumprir esteira/dias.
  if (quality.has2FA && quality.hasBM && quality.hasPage && minFriendsReached) {
    return true;
  }

  if (!minFriendsReached) return false;
  if (criteria.require2FA && !quality.has2FA) return false;
  if (!daysReached) return false;

  return true;
}
