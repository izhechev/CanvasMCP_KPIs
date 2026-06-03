// stripHtml removes all HTML tags from a string and normalises whitespace.
// Canvas stores message bodies as raw HTML (e.g. "<p>Hello <b>world</b></p>").
// An LLM does not need HTML markup — it needs clean readable text.
// Used by getInboxTool before returning conversation messages.
export function stripHtml(html: string): string {
  // Replace every HTML tag (anything between < and >) with a space
  // so words from adjacent tags do not merge together
  return (
    html
      .replace(/<[^>]*>/g, ' ')
      // Collapse multiple consecutive whitespace characters into a single space
      .replace(/\s+/g, ' ')
      // Remove leading and trailing whitespace
      .trim()
  );
}
