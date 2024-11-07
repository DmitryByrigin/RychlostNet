/*
  Warnings:

  - The primary key for the `SpeedTestHistory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `SpeedTestHistory` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `userId` to the `SpeedTestHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SpeedTestHistory" DROP CONSTRAINT "SpeedTestHistory_pkey",
ADD COLUMN     "userId" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "SpeedTestHistory_pkey" PRIMARY KEY ("id");
