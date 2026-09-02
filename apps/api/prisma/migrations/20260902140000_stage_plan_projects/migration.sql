-- CreateTable
CREATE TABLE "stage_plan_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_plan_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stage_plan_projects_orderId_key" ON "stage_plan_projects"("orderId");

-- CreateIndex
CREATE INDEX "stage_plan_projects_updatedAt_idx" ON "stage_plan_projects"("updatedAt");

-- AddForeignKey
ALTER TABLE "stage_plan_projects" ADD CONSTRAINT "stage_plan_projects_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
