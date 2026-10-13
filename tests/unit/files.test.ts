import { it, expect, describe } from "vitest";
import { validateDocument } from "../../src/server/file-policy";
describe("Upload policy", () => {
  it("accepts a PDF signature with a PDF extension and MIME", () =>
    expect(
      validateDocument(
        "Resume.PDF",
        "application/pdf",
        Buffer.from("%PDF-1.4\n"),
      ),
    ).toBe("pdf"));
  it.each([
    ["resume.exe", "application/pdf", "%PDF-1.4"],
    ["resume.pdf", "image/jpeg", "%PDF-1.4"],
    ["resume.pdf", "application/pdf", "not a PDF"],
    [
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "P",
    ],
  ])(
    "rejects mismatched extension, MIME, or signature: %s",
    (name, mime, bytes) =>
      expect(() => validateDocument(name, mime, Buffer.from(bytes))).toThrow(),
  );
  it("rejects empty files", () =>
    expect(() =>
      validateDocument("resume.pdf", "application/pdf", Buffer.alloc(0)),
    ).toThrow());
  it("rejects files over 2 MB", () =>
    expect(() =>
      validateDocument("resume.pdf", "application/pdf", Buffer.alloc(2097153)),
    ).toThrow());
  it("rejects ZIP archives without a Word document", () =>
    expect(() =>
      validateDocument(
        "resume.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Buffer.from("PK\x03\x04" + "x".repeat(80)),
      ),
    ).toThrow());
});
