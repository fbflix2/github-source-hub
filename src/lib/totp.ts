import * as OTPAuth from "otpauth";

export interface TOTPResult {
  code: string;
  remaining: number;
  period: number;
}

type TOTPAlgorithm = "SHA1" | "SHA256" | "SHA512";

const SUPPORTED_ALGORITHMS = new Set<TOTPAlgorithm>(["SHA1", "SHA256", "SHA512"]);

function normalizeBase32Secret(secret: string): string | null {
  const normalized = secret.replace(/[\s-]+/g, "").toUpperCase();
  return /^[A-Z2-7]+=*$/.test(normalized) ? normalized : null;
}

function buildTOTP(input: string): OTPAuth.TOTP | null {
  try {
    const trimmedInput = input.trim();
    if (!trimmedInput) return null;

    if (trimmedInput.toLowerCase().startsWith("otpauth://")) {
      const url = new URL(trimmedInput);
      const secretParam = url.searchParams.get("secret");
      const normalizedSecret = secretParam ? normalizeBase32Secret(secretParam) : null;
      const algorithm = (url.searchParams.get("algorithm") || "SHA1").toUpperCase() as TOTPAlgorithm;
      const digits = Number(url.searchParams.get("digits") || 6);
      const period = Number(url.searchParams.get("period") || 30);
      const label = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "2FA";
      const issuer = url.searchParams.get("issuer") || "FBFLIX";

      if (!normalizedSecret || !SUPPORTED_ALGORITHMS.has(algorithm)) return null;
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

    const code = totp.generate();
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now % totp.period;
    const remaining = elapsed === 0 ? totp.period : totp.period - elapsed;

    return { code, remaining, period: totp.period };
  } catch {
    return null;
  }
}
