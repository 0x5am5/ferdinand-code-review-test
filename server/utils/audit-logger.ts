/**
 * Security audit logging utility
 * Logs security events including role switching, authorization decisions, and privilege escalation attempts
 */

export interface RoleSwitchingAuditLog {
  userId: number;
  userEmail?: string;
  userRole: string;
  requestedViewingRole: string | null;
  authorizationDecision: "allowed" | "denied";
  reason?: string;
  timestamp: Date;
  requestPath?: string;
  requestMethod?: string;
  ipAddress?: string;
}

/**
 * Log role switching authorization decisions
 * This function logs to console and can be extended to persist to database
 */
export function logRoleSwitchingAudit(entry: RoleSwitchingAuditLog): void {
  const timestamp = entry.timestamp.toISOString();
  const logLevel = entry.authorizationDecision === "denied" ? "WARN" : "INFO";

  const logMessage = [
    `[ROLE_SWITCHING_AUDIT] ${timestamp}`,
    `[${logLevel}]`,
    `User ID: ${entry.userId}`,
    entry.userEmail ? `Email: ${entry.userEmail}` : null,
    `Actual Role: ${entry.userRole}`,
    `Requested Viewing Role: ${entry.requestedViewingRole ?? "none"}`,
    `Decision: ${entry.authorizationDecision.toUpperCase()}`,
    entry.reason ? `Reason: ${entry.reason}` : null,
    entry.requestPath
      ? `Path: ${entry.requestMethod} ${entry.requestPath}`
      : null,
    entry.ipAddress ? `IP: ${entry.ipAddress}` : null,
  ]
    .filter(Boolean)
    .join(" - ");

  if (entry.authorizationDecision === "denied") {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }

  // TODO: In the future, persist to a security_audit_logs database table
  // This would allow for:
  // - Security monitoring dashboards
  // - Compliance reporting
  // - Forensic analysis
  // - Alerting on suspicious patterns
}

/**
 * Extract IP address from Express request
 */
export function getClientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(",")[0].trim();
    return ips;
  }

  // Fallback to req.ip
  return req.ip;
}
