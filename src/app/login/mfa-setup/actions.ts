"use server";

import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit/log";

export async function logMfaEnrolledAction() {
  const user = await requireUser();
  const headerList = await headers();
  await writeAuditEvent({
    userId: user.id,
    eventType: "mfa_enrolled",
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  });
}
