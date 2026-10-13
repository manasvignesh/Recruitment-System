import { HttpError } from "./errors";
export function validateDocument(name: string, mime: string, bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > 2097152)
    throw new HttpError(422, "Resume files must be between 1 byte and 2 MB.");
  const pdf =
    name.toLowerCase().endsWith(".pdf") &&
    mime === "application/pdf" &&
    bytes.subarray(0, 5).toString() === "%PDF-";
  const docx =
    name.toLowerCase().endsWith(".docx") &&
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    bytes.length >= 22 &&
    bytes.readUInt32LE(0) === 0x04034b50 &&
    bytes.includes(Buffer.from("word/document.xml")) &&
    bytes.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (!pdf && !docx)
    throw new HttpError(422, "Choose a valid PDF or DOCX resume.");
  if (docx) {
    let total = 0;
    for (let i = 0; i < bytes.length - 46; i++) {
      if (bytes.readUInt32LE(i) === 0x02014b50)
        total += bytes.readUInt32LE(i + 24);
    }
    if (total > 10485760)
      throw new HttpError(
        422,
        "The document expands beyond the permitted size.",
      );
  }
  return pdf ? "pdf" : "docx";
}
