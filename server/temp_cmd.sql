-- AddForeignKey
ALTER TABLE "CbtAnswer" ADD CONSTRAINT "CbtAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CbtQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;