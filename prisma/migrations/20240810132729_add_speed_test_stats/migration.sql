-- CreateTable
CREATE TABLE "SpeedTestStats" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadSpeed" DOUBLE PRECISION NOT NULL,
    "uploadSpeed" DOUBLE PRECISION NOT NULL,
    "ping" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "isp" TEXT NOT NULL,

    CONSTRAINT "SpeedTestStats_pkey" PRIMARY KEY ("id")
);
