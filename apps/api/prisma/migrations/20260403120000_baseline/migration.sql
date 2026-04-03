-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR_FULL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_definitions" (
    "id" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "permissionsJson" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR_FULL',
    "fullName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "address" TEXT,
    "nip" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_year_sequences" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_year_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "venue" TEXT,
    "venuePlaceId" TEXT,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "discountGlobal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 23,
    "orderYear" INTEGER,
    "orderNumber" INTEGER,
    "offerVersion" INTEGER NOT NULL DEFAULT 0,
    "offerNumber" TEXT,
    "offerValidityDays" INTEGER NOT NULL DEFAULT 14,
    "projectContactKey" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "exchangeRateEur" DOUBLE PRECISION,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "recurringConfig" TEXT,
    "parentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_note_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_note_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_stages" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "label" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "dailyPrice" DOUBLE PRECISION NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'szt.',
    "internalCode" TEXT,
    "technicalNotes" TEXT,
    "imageUrl" TEXT,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "pricingRule" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_equipment_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Inne',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricingRule" TEXT,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "isRental" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_equipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_production_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rateType" TEXT NOT NULL DEFAULT 'FLAT',
    "rateValue" DOUBLE PRECISION NOT NULL,
    "units" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stageIds" TEXT,
    "isTransport" BOOLEAN NOT NULL DEFAULT false,
    "isAutoCalculated" BOOLEAN NOT NULL DEFAULT true,
    "isSubcontractor" BOOLEAN NOT NULL DEFAULT false,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_production_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_pricing_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rangesJson" TEXT NOT NULL DEFAULT '[{"fromKm":0,"toKm":50,"flatNet":150},{"fromKm":50,"toKm":100,"flatNet":250}]',
    "shortDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "mediumDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "shortDistanceNet" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "mediumDistanceNet" DOUBLE PRECISION NOT NULL DEFAULT 250,
    "longDistancePerKm" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_document_exports" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_document_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_document_drafts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_document_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_reservations" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderEquipmentItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "equipment_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_blocks" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_profiles" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "role_definitions_roleKey_key" ON "role_definitions"("roleKey");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_module_createdAt_idx" ON "audit_logs"("module", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokens_tokenHash_key" ON "invitation_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "invitation_tokens_email_expiresAt_idx" ON "invitation_tokens"("email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionTokenHash_key" ON "sessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "clients_companyName_key" ON "clients"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "orders_offerNumber_key" ON "orders"("offerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderYear_orderNumber_key" ON "orders"("orderYear", "orderNumber");

-- CreateIndex
CREATE INDEX "calendar_note_events_dateFrom_dateTo_idx" ON "calendar_note_events"("dateFrom", "dateTo");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_internalCode_key" ON "equipment"("internalCode");

-- CreateIndex
CREATE INDEX "order_document_exports_orderId_documentType_idx" ON "order_document_exports"("orderId", "documentType");

-- CreateIndex
CREATE INDEX "order_document_exports_documentType_documentNumber_idx" ON "order_document_exports"("documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "order_document_exports_orderId_documentType_documentNumber_key" ON "order_document_exports"("orderId", "documentType", "documentNumber");

-- CreateIndex
CREATE INDEX "order_document_drafts_orderId_documentType_idx" ON "order_document_drafts"("orderId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "order_document_drafts_orderId_documentType_key" ON "order_document_drafts"("orderId", "documentType");

-- CreateIndex
CREATE INDEX "equipment_reservations_equipmentId_date_idx" ON "equipment_reservations"("equipmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_reservations_equipmentId_orderEquipmentItemId_dat_key" ON "equipment_reservations"("equipmentId", "orderEquipmentItemId", "date");

-- CreateIndex
CREATE INDEX "equipment_blocks_equipmentId_dateFrom_dateTo_idx" ON "equipment_blocks"("equipmentId", "dateFrom", "dateTo");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_profiles_profileKey_key" ON "issuer_profiles"("profileKey");

-- CreateIndex
CREATE INDEX "issuer_profiles_isDefault_idx" ON "issuer_profiles"("isDefault");

-- CreateIndex
CREATE INDEX "issuer_profiles_sortOrder_idx" ON "issuer_profiles"("sortOrder");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_equipment_items" ADD CONSTRAINT "order_equipment_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_equipment_items" ADD CONSTRAINT "order_equipment_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_production_items" ADD CONSTRAINT "order_production_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_document_exports" ADD CONSTRAINT "order_document_exports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_document_drafts" ADD CONSTRAINT "order_document_drafts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_reservations" ADD CONSTRAINT "equipment_reservations_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_reservations" ADD CONSTRAINT "equipment_reservations_orderEquipmentItemId_fkey" FOREIGN KEY ("orderEquipmentItemId") REFERENCES "order_equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_blocks" ADD CONSTRAINT "equipment_blocks_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
