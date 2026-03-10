-- AlterTable
ALTER TABLE "unit_kerja" ADD COLUMN     "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "unit_kerja" ADD CONSTRAINT "unit_kerja_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "unit_kerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
