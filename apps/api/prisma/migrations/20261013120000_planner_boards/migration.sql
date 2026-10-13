-- CreateTable
CREATE TABLE "planner_boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planner_boards_updatedAt_idx" ON "planner_boards"("updatedAt");
