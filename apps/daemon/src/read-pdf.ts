/**
 * @lumos daemon - reading a PDF's text for the link pane.
 *
 * A PDF is bytes, not markup, so this is the one place in the daemon that needs a real parser.
 * unpdf wraps pdf.js for serverless use - no worker, no canvas - which suits a headless local
 * daemon. The parser's own failure wording never reaches a person: the sentence is fixed here,
 * and whatever actually went wrong rides along as the error's cause so it can be inspected.
 */
import { extractText } from "unpdf";

/** The bytes were a PDF the parser could not read: encrypted, broken, or cut off mid-download. */
export class PdfReadError extends Error {
  constructor(cause: unknown) {
    super("That PDF could not be read.", { cause });
    this.name = "PdfReadError";
  }
}

/**
 * The whole document's text as one string.
 *
 * A PDF with no text layer (a scan) is not a failure - it reads as an empty string, and the
 * app already says a page had no readable text. A document with no pages at all is a failure:
 * nothing was read, and saying so is more honest than showing an empty card.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { text, totalPages } = await extractText(bytes, { mergePages: true });
    if (totalPages === 0) throw new Error("the document has no pages");
    return text;
  } catch (err: unknown) {
    throw new PdfReadError(err);
  }
}
