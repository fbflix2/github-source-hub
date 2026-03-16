import * as OTPAuth from "otpauth";

export interface TOTPResult {
  code: string;
  remaining: number;
  period: number;
}

let serverTimeOffsetMs = 0;
let serverTimeSyncPromise: Promise<number> | null = null;

function normalizeBase32Secret(secret: string): string | null {
  const normalized = secret
    .replace(/[\s-]+/g, "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I");

  return /^[A-Z2-7]+=*$/.test(normalized) ? normalized : null;
}

export function sanitizeTOTPInput(input: string) {
  const trimmedInput = input.trim();
  if (trimmedInput.toLowerCase().startsWith("otpauth://")) return trimmedInput;
  return normalizeBase32Secret(trimmedInput) || trimmedInput;
}

function getTrustedNow() {
  return Date.now() + serverTimeOffsetMs;
}

export async function syncTOTPTimeOffset() {
  if (typeof window === "undefined") return serverTimeOffsetMs;
  if (serverTimeSyncPromise) return serverTimeSyncPromise;

  serverTimeSyncPromise = fetch(window.location.origin, {
    method: "HEAD",
    cache: "no-store",
  })
    .then((response) => {
      const serverDate = response.headers.get("date");
      const serverTimestamp = serverDate ? new Date(serverDate).getTime() : Number.NaN;

      if (!Number.isNaN(serverTimestamp)) {
        serverTimeOffsetMs = serverTimestamp - Date.now();
      }

      return serverTimeOffsetMs;
    })
    .catch(() => serverTimeOffsetMs)
    .finally(() => {
      serverTimeSyncPromise = null;
    });

  return serverTimeSyncPromise;
}

function buildTOTP(input: string): OTPAuth.TOTP | null {
  try {
    const trimmedInput = input.trim();
    if (!trimmedInput) return null;

    if (trimmedInput.toLowerCase().startsWith("otpauth://")) {
      const url = new URL(trimmedInput);
      const secretParam = url.searchParams.get("secret");
      const normalizedSecret = secretParam ? normalizeBase32Secret(secretParam) : null;
      const algorithm = (url.searchParams.get("algorithm") || "SHA1").toUpperCase();
      const digits = Number(url.searchParams.get("digits") || 6);
      const period = Number(url.searchParams.get("period") || 30);
      const label = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "2FA";
      const issuer = url.searchParams.get("issuer") || "FBFLIX";

      if (!normalizedSecret) return null;
      if (!Number.isInteger(digits) || digits < 4 || digits > 10) return null;
      if (!Number.isInteger(period) || period <= 0) return null;

      return new OTPAuth.TOTP({
        issuer,
        label,
        algorithm,
        digits,
        period,
        secret: OTPAuth.Secret.fromBase32(normalizedSecret),
      });
    }

    const normalizedSecret = normalizeBase32Secret(trimmedInput);
    if (!normalizedSecret) return null;

    return new OTPAuth.TOTP({
      issuer: "FBFLIX",
      label: "2FA",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(normalizedSecret),
    });
  } catch {
    return null;
  }
}

export function generateTOTP(input: string): TOTPResult | null {
  try {
    const totp = buildTOTP(input);
    if (!totp) return null;

    const timestamp = getTrustedNow();
    const code = totp.generate({ timestamp });
    const remaining = totp.remaining({ timestamp });

    return { code, remaining, period: totp.period };
  } catch {
    return null;
  }
}
