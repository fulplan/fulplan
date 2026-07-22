-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cashAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "momoAmount" INTEGER NOT NULL DEFAULT 0;
