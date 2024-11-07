/*
  Warnings:

  - You are about to drop the `SpeedTestStats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "SpeedTestStats";

-- CreateTable
CREATE TABLE "SpeedTestHistory" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadSpeed" DOUBLE PRECISION NOT NULL,
    "uploadSpeed" DOUBLE PRECISION NOT NULL,
    "ping" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "isp" TEXT NOT NULL,

    CONSTRAINT "SpeedTestHistory_pkey" PRIMARY KEY ("id")
);
