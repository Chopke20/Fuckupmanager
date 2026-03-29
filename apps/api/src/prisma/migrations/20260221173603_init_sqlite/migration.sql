-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "address" TEXT,
    "nip" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "venue" TEXT,
    "dateFrom" DATETIME NOT NULL,
    "dateTo" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "discountGlobal" REAL NOT NULL DEFAULT 0,
    "vatRate" REAL NOT NULL DEFAULT 23,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringConfig" TEXT,
    "parentOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "label" TEXT,
    "date" DATETIME NOT NULL,
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_stages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "dailyPrice" REAL NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'szt.',
    "internalCode" TEXT,
    "technicalNotes" TEXT,
    "imageUrl" TEXT,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "pricingRule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "order_equipment_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Inne',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "discount" REAL NOT NULL DEFAULT 0,
    "pricingRule" TEXT,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "order_equipment_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_equipment_items_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_production_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rateType" TEXT NOT NULL DEFAULT 'FLAT',
    "rateValue" REAL NOT NULL,
    "units" REAL NOT NULL DEFAULT 1,
    "discount" REAL NOT NULL DEFAULT 0,
    "stageIds" TEXT,
    "isSubcontractor" BOOLEAN NOT NULL DEFAULT false,
    "visibleInOffer" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "order_production_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "equipment_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderEquipmentItemId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "equipment_reservations_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "equipment_reservations_orderEquipmentItemId_fkey" FOREIGN KEY ("orderEquipmentItemId") REFERENCES "order_equipment_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_companyName_key" ON "clients"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE INDEX "equipment_reservations_equipmentId_date_idx" ON "equipment_reservations"("equipmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_reservations_equipmentId_orderEquipmentItemId_date_key" ON "equipment_reservations"("equipmentId", "orderEquipmentItemId", "date");
