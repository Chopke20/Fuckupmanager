-- CreateTable
CREATE TABLE "led_screen_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectJson" TEXT NOT NULL,
    "orderId" TEXT,
    "offerBlockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "led_screen_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "led_screen_projects_updatedAt_idx" ON "led_screen_projects"("updatedAt");

-- CreateIndex
CREATE INDEX "led_screen_projects_orderId_offerBlockId_idx" ON "led_screen_projects"("orderId", "offerBlockId");

-- AddForeignKey
ALTER TABLE "led_screen_projects" ADD CONSTRAINT "led_screen_projects_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "led_screen_projects" ADD CONSTRAINT "led_screen_projects_offerBlockId_fkey" FOREIGN KEY ("offerBlockId") REFERENCES "order_offer_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
