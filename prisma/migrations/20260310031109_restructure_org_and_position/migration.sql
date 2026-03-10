-- AlterTable
ALTER TABLE "unit_kerja" ADD COLUMN     "direktorat" TEXT,
ADD COLUMN     "divisi" TEXT,
ADD COLUMN     "sub_divisi" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "position" TEXT;
