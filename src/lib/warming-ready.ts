export interface ProfileQualityData {
  has2FA: boolean;
  hasBM: boolean;
  hasPage: boolean;
  friendRange: string;
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

export const DEFAULT_PROFILE_QUALITY_DATA: ProfileQualityData = {
  has2FA: false,
  hasBM: false,
  hasPage: false,
  friendRange: "0-5",
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

  if (!minFriendsReached) return false;
  if (criteria.require2FA && !quality.has2FA) return false;
  if (!daysReached) return false;

  return true;
}