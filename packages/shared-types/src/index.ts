// Re-export all schemas and types
export * from './schemas/common.schema';
export * from './schemas/client.schema';
export * from './schemas/equipment.schema';
export * from './schemas/order.schema';
export * from './schemas/order-document.schema';
export * from './schemas/auth.schema';
export * from './schemas/user.schema';
export * from './schemas/permission.schema';
export * from './schemas/audit.schema';
export * from './schemas/transport.schema';
export * from './schemas/issuer-profile.schema';
export * from './schemas/nip-lookup.schema';

// Explicitly re-export commonly used schemas
export { CreateClientSchema, UpdateClientSchema, ClientSchema } from './schemas/client.schema';
export { CreateOrderSchema, UpdateOrderSchema, OrderSchema } from './schemas/order.schema';
export { CreateEquipmentSchema, UpdateEquipmentSchema, EquipmentSchema } from './schemas/equipment.schema';
export {
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  AcceptInviteRequestSchema,
  CreateInvitationRequestSchema,
  UserRoleSchema,
} from './schemas/auth.schema';
export { UserPublicSchema, InvitationSchema } from './schemas/user.schema';
export {
  PermissionSchema,
  RoleDefinitionSchema,
  CreateRoleDefinitionSchema,
  UpdateRoleDefinitionSchema,
} from './schemas/permission.schema';
export { AuditLogSchema } from './schemas/audit.schema';

// Utility functions for orders
export { calculateOrderNetValue, formatOrderNetValue } from './utils/orderCalculations';
export { formatOrderReference, buildDocumentNumber } from './utils/orderReferenceFormat';
