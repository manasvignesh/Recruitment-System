import type { PoolClient } from "pg";
import type { Upload } from "./domains/files";
/** Replace with a private object adapter before high-volume production usage. */
export interface PrivateAttachmentStorage {
  put(
    c: PoolClient,
    organizationId: string,
    candidateId: string,
    file: Upload,
  ): Promise<string>;
}
export const attachmentStorage: PrivateAttachmentStorage = {
  async put(c, org, candidate, file) {
    const result = await c.query(
      "insert into morrow.documents(org_id,candidate_id,name,mime,size,content,extracted_text,parsing_status) values($1,$2,$3,$4,$5,$6,$7,$8) returning id",
      [
        org,
        candidate,
        file.name,
        file.mime,
        file.size,
        file.bytes,
        file.text,
        file.status,
      ],
    );
    return result.rows[0].id;
  },
};
