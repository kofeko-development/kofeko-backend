declare module 'pdf-parse' {
  import type { Buffer } from 'node:buffer';

  type PdfParseResult = {
    text?: string;
  };

  const pdfParse: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}

