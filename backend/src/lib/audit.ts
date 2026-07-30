import type { PrismaClient } from "@prisma/client";

interface AuditParams {
  prisma: PrismaClient;
  organizationId: string;
  actorId?: string;
  actorName?: string;
  action: string;        // e.g. "product.priceChange"
  entityType: string;    // "Product" | "Sale" | "User"
  entityId: string;
  changes?: { before?: unknown; after?: unknown };
}

export async function writeAuditLog(p: AuditParams): Promise<void> {
  try {
    await p.prisma.auditLog.create({
      data: {
        organizationId: p.organizationId,
        actorId: p.actorId,
        actorName: p.actorName,
        action: p.action,
        entityType: p.entityType,
        entityId: p.entityId,
        changes: p.changes
          ? (p.changes as import("@prisma/client").Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (err) {
    // Audit log failures must never break the main request
    console.error("[audit] failed to write log:", err);
  }
}
