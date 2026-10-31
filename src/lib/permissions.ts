/**
 * Permissions Module
 * 
 * Central permission matrix used by API middleware AND UI gating.
 * Single source of truth for what each role can do.
 */

import { UserRole } from '@prisma/client';

export type Resource =
  | 'products' | 'variants' | 'taxes' | 'plans' | 'payment_terms'
  | 'customers' | 'quotation_templates' | 'subscriptions' | 'invoices'
  | 'payments' | 'discounts' | 'reports' | 'settings' | 'staff'
  | 'billing_runs' | 'clock' | 'audit_log' | 'ledger_health';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * Permission matrix: role -> resource -> allowed actions
 * If a resource is not listed for a role, all actions are denied.
 */
const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  admin: {
    products: ['create', 'read', 'update', 'delete', 'list'],
    variants: ['create', 'read', 'update', 'delete', 'list'],
    taxes: ['create', 'read', 'update', 'delete', 'list'],
    plans: ['create', 'read', 'update', 'delete', 'list'],
    payment_terms: ['create', 'read', 'update', 'delete', 'list'],
    customers: ['create', 'read', 'update', 'delete', 'list'],
    quotation_templates: ['create', 'read', 'update', 'delete', 'list'],
    subscriptions: ['create', 'read', 'update', 'delete', 'list'],
    invoices: ['create', 'read', 'update', 'delete', 'list'],
    payments: ['create', 'read', 'update', 'delete', 'list'],
    discounts: ['create', 'read', 'update', 'delete', 'list'],
    reports: ['read', 'list'],
    settings: ['read', 'update'],
    staff: ['create', 'read', 'update', 'delete', 'list'],
    billing_runs: ['create', 'read', 'list'],
    clock: ['read', 'update'],
    audit_log: ['read', 'list'],
    ledger_health: ['read'],
  },
  staff: {
    customers: ['create', 'read', 'update', 'list'],
    quotation_templates: ['read', 'list'],
    subscriptions: ['create', 'read', 'update', 'list'],
    invoices: ['create', 'read', 'update', 'list'],
    payments: ['create', 'read', 'update', 'list'],
    discounts: ['read', 'list'],  // Staff can read/attach discounts but not create/edit rules
    reports: ['read', 'list'],
    products: ['read', 'list'],
    variants: ['read', 'list'],
    taxes: ['read', 'list'],
    plans: ['read', 'list'],
    payment_terms: ['read', 'list'],
    billing_runs: ['read', 'list'],
    audit_log: ['read', 'list'],
    ledger_health: ['read'],
  },
  customer: {
    subscriptions: ['read', 'update', 'list'],  // own only, update = qty change, pause, cancel
    invoices: ['read', 'list'],                  // own only
    payments: ['create', 'read', 'list'],        // own only, create = portal pay
    customers: ['read', 'update'],               // own profile only
  },
};

/** Check if a role has permission for an action on a resource */
export function hasPermission(role: UserRole, resource: Resource, action: Action): boolean {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;
  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;
  return resourcePerms.includes(action);
}

/** Get all allowed actions for a role on a resource */
export function getAllowedActions(role: UserRole, resource: Resource): Action[] {
  return PERMISSIONS[role]?.[resource] ?? [];
}

/** Get all resources a role has any access to */
export function getAccessibleResources(role: UserRole): Resource[] {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return [];
  return Object.keys(rolePerms) as Resource[];
}

/** Check if the role is internal (admin or staff) */
export function isInternalRole(role: UserRole): boolean {
  return role === 'admin' || role === 'staff';
}

/** Fields that must NEVER be returned to customer role */
export const CUSTOMER_HIDDEN_FIELDS = ['costPrice', 'cost_price', 'margin'] as const;
