import { describe, expect, it } from "vitest";
import { pickStatementAttachment } from "@/app/api/inbound-email/handler";

const att = (filename: string, contentType: string) => ({
  filename,
  contentType,
  buffer: Buffer.from("x"),
});

describe("pickStatementAttachment", () => {
  it("returns null when there are no attachments", () => {
    expect(pickStatementAttachment([])).toBeNull();
  });

  it("returns the only attachment", () => {
    const only = att("Statement #1 - OWN10905.pdf", "application/pdf");
    expect(pickStatementAttachment([only])).toBe(only);
  });

  it("prefers the PDF over an image", () => {
    // Agents issue statements as PDFs, so an image alongside one is far more
    // likely to be a photo of something else than the statement itself.
    const photo = att("maintenance.jpg", "image/jpeg");
    const statement = att("Statement #7 - OWN10905.pdf", "application/pdf");
    expect(pickStatementAttachment([photo, statement])).toBe(statement);
  });

  it("detects a PDF by extension when the content type is generic", () => {
    // Some mail providers send application/octet-stream for every attachment.
    const photo = att("photo.png", "image/png");
    const statement = att("statement.pdf", "application/octet-stream");
    expect(pickStatementAttachment([photo, statement])).toBe(statement);
  });

  it("falls back to the first attachment when no PDF is present", () => {
    // A scanned statement is still better evidence than none.
    const scan = att("scan-001.jpg", "image/jpeg");
    const other = att("scan-002.jpg", "image/jpeg");
    expect(pickStatementAttachment([scan, other])).toBe(scan);
  });

  it("takes the first PDF when several are attached", () => {
    const first = att("statement.pdf", "application/pdf");
    const second = att("invoice.pdf", "application/pdf");
    expect(pickStatementAttachment([first, second])).toBe(first);
  });
});
