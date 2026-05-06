import type { Buffer } from "node:buffer";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../errors/AppError";
import { ERROR_CODES } from "../errors/errorCodes";

const MAX_BYTES = 8 * 1024 * 1024;

export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_BYTES) {
    throw new AppError("File is too large (max 8 MB).", StatusCodes.REQUEST_TOO_LONG, ERROR_CODES.VALIDATION_ERROR);
  }

  const lower = filename.toLowerCase();

  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    if (!text) {
      throw new AppError(
        "Could not read text from this PDF (it may be scanned images).",
        StatusCodes.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    return text;
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (!text) {
      throw new AppError("Could not read text from this DOCX file.", StatusCodes.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
    }
    return text;
  }

  throw new AppError("Unsupported format. Use PDF, DOCX, or TXT.", StatusCodes.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.VALIDATION_ERROR);
}
