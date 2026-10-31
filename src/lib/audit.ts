import prisma from '@/lib/db';

export interface AuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
}

/**
 * Record an audit log entry for mutations (PRD Section 3 & 11)
 */
export async function recordAuditLog(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? JSON.stringify(params.before, (_, v) => typeof v === 'bigint' ? v.toString() : v) : null,
        after: params.after ? JSON.stringify(params.after, (_, v) => typeof v === 'bigint' ? v.toString() : v) : null,
        requestId: params.requestId ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
