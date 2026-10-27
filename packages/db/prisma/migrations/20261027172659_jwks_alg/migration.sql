-- DropIndex
DROP INDEX "doc_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "jwks" ADD COLUMN     "alg" TEXT,
ADD COLUMN     "crv" TEXT;
