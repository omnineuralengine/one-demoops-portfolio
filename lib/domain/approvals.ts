import { APPROVAL_STATUS } from "./enums";
import type { ApprovalReceipt } from "./types";

export interface ApprovalScope {
  targetType: ApprovalReceipt["targetType"];
  targetId: string;
  operation: ApprovalReceipt["operation"];
  agentId?: string | null;
}

export function approvalMatchesScope(
  approval: ApprovalReceipt,
  scope: ApprovalScope,
): boolean {
  return (
    approval.targetType === scope.targetType &&
    approval.targetId === scope.targetId &&
    approval.operation === scope.operation &&
    approval.agentId === (scope.agentId ?? null)
  );
}

export function isApprovalUsable(
  approval: ApprovalReceipt | null | undefined,
  scope: ApprovalScope,
  evaluatedAt: string,
): boolean {
  if (!approval || approval.status !== APPROVAL_STATUS.APPROVED) return false;
  if (approval.consumedAt !== null) return false;
  if (!approval.approverId || !approval.rationale.trim() || !approval.decidedAt) return false;
  if (approval.approverId === approval.requestedBy) return false;
  if (!approvalMatchesScope(approval, scope)) return false;
  const requestedAt = Date.parse(approval.requestedAt);
  const decidedAt = Date.parse(approval.decidedAt);
  const evaluated = Date.parse(evaluatedAt);
  if (![requestedAt, decidedAt, evaluated].every(Number.isFinite)) return false;
  if (requestedAt > decidedAt || decidedAt > evaluated) return false;
  if (approval.expiresAt) {
    const expiresAt = Date.parse(approval.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt < decidedAt || expiresAt < evaluated) return false;
  }
  return true;
}

export function consumeApproval(
  approval: ApprovalReceipt,
  consumedAt: string,
): ApprovalReceipt {
  if (approval.status !== APPROVAL_STATUS.APPROVED || approval.consumedAt) {
    return approval;
  }

  return {
    ...approval,
    status: APPROVAL_STATUS.CONSUMED,
    consumedAt,
  };
}
