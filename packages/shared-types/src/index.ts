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
export * from './schemas/app-settings.schema';

// Explicitly re-export commonly used schemas
export { CreateClientSchema, UpdateClientSchema, ClientSchema } from './schemas/client.schema';
export {
  CreateOrderSchema,
  UpdateOrderSchema,
  OrderSchema,
  UpdateOrderOfferBlockItemSchema,
} from './schemas/order.schema';
export { CreateEquipmentSchema, UpdateEquipmentSchema, EquipmentSchema } from './schemas/equipment.schema';
export {
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  AcceptInviteRequestSchema,
  CreateInvitationRequestSchema,
  PublicCompanySchema,
  UserRoleSchema,
} from './schemas/auth.schema';
export { UserPublicSchema, InvitationSchema } from './schemas/user.schema';
export { AppSettingsSchema, AppSettingsPublicSchema, UpdateAppSettingsSchema } from './schemas/app-settings.schema';
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
export {
  ORDER_LINE_DESCRIPTION_MAX_LENGTH,
  ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH,
  clampOrderLineDescription,
  normalizeOrderLineDescriptionForSave,
  truncateOrderLineDescriptionForPdf,
} from './constants/orderLineDescription';
export {
  ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH,
  clampOrderOfferBlockTitle,
} from './constants/orderOfferBlock';
export { validateOrderOfferBlocksForSave } from './utils/orderOfferBlockValidation';
export {
  computeProposalEquipmentNet,
  computeProposalProductionNet,
  applyGlobalDiscountAndVat,
  proposalOptionKey,
} from './utils/proposalFinance';
export {
  STAGE_TOL_M,
  STAGE_GAP_WARN_M,
  analyzeStageLayout,
  computeSharedEdgeMeters,
  computeStageAreaM2,
  computeStageBounds,
  computeStageJunctions,
  computeStageOutline,
  findEdgeCovering,
  intervalsLength,
  subtractIntervals,
  round2,
  roundM,
} from './utils/stagePlatformGeometry';
export type {
  StageRect,
  StageEdge,
  StageEdgeSide,
  StageLayoutIssues,
} from './utils/stagePlatformGeometry';
export {
  STAGE_PLAN_LINE_MARKER,
  STAGE_PLAN_VERSION,
  STAGE_LEG_HEIGHTS_CM,
  STAGE_GRID_STEPS_M,
  STAGE_DEFAULT_GRID_STEP_M,
  STAGE_MAGNET_M,
  STAGE_MAX_SPAN_M,
  STAGE_MAX_DECKS,
  STAGE_DEFAULT_STAIR_WIDTH_M,
  STAGE_MIN_STAIR_WIDTH_M,
  STAGE_MAX_STAIR_WIDTH_M,
  STAGE_STEP_RISE_CM,
  STAGE_STEP_TREAD_M,
  STAGE_ACCESSORY_MIN_CM,
  STAGE_EDGE_SIDES,
  buildStagePlan,
  createDefaultStagePlan,
  createStageDeck,
  createStageStair,
  clampStairWidth,
  edgeSelection,
  edgeSelectionLabel,
  edgeSideLabel,
  emptyStagePlanInput,
  fillRectWithDecks,
  isEdgeSelected,
  isStagePlan,
  migrateLegacyStagePlan,
  parseStagePlanJson,
  rotateStageDeck,
  selectedEdges,
  serializeStagePlan,
  snapToStep,
  stageStairDepthM,
  stageStairSteps,
  stairIsAttached,
  toggleEdgeInSelection,
  toggleSideInSelection,
  formatMeters,
  claddingMaterialLabel,
  floorMaterialLabel,
} from './utils/stagePlatformPlan';
export type {
  StageDeckKind,
  StageCladdingMaterial,
  StageFloorMaterial,
  StageBomUnit,
  StageDeck,
  StageStair,
  StageEdgeSelection,
  StageBomLine,
  StagePlanInput,
  StagePlan,
} from './utils/stagePlatformPlan';
export {
  STAGE_PALETTES,
  STAGE_RAILING_OFFSET_M,
  STAGE_LEG_INSET_M,
  renderStagePlanSvg,
  stageGridLines,
  stageLegDots,
  stagePlanLegend,
  stagePlanViewport,
  stageRailingSegments,
  stageStairShape,
} from './utils/stagePlatformRender';
export type {
  StagePlanTheme,
  StagePalette,
  StageViewport,
  StageStairShape,
} from './utils/stagePlatformRender';
