CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "instanceCode" TEXT NOT NULL DEFAULT 'main',
    "brandName" TEXT NOT NULL DEFAULT 'Lama Stage',
    "brandTagline" TEXT,
    "loginHeadline" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "websiteUrl" TEXT,
    "legalFooter" TEXT,
    "logoDarkBgUrl" TEXT,
    "logoLightBgUrl" TEXT,
    "documentLogoUrl" TEXT,
    "primaryColorHex" TEXT,
    "loginOptionsJson" TEXT NOT NULL DEFAULT '[]',
    "documentFooterText" TEXT,
    "emailSenderName" TEXT,
    "emailFooterText" TEXT,
    "replyToEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
