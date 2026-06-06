// Rules about who may log in and who is an admin. Driven entirely by env vars.

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function allowedDomains(): string[] {
  return csv(process.env.ALLOWED_DOMAINS);
}

export function isAllowedEmail(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1];
  return !!domain && allowedDomains().includes(domain);
}

export function isAdminEmail(email: string): boolean {
  return csv(process.env.ADMIN_EMAILS).includes(normalizeEmail(email));
}

// The display name is the part of the email before the "@".
export function usernameFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0];
}
