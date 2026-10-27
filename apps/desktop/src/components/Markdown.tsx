import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { OpenLink } from "./OpenLink";

/** Note links open in Lumos's separate, capability-isolated webview. */
const markdownComponents: Components = {
  a: ({ href, title, children }) => {
    const safeHref = href ? safeLinkHref(href) : undefined;
    if (!safeHref) return <span title={title}>{children}</span>;

    return (
      <OpenLink href={safeHref} title={title} className="underline hover:text-foreground">
        {children}
      </OpenLink>
    );
  },
};

function safeLinkHref(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

interface Props {
  source: string;
}

/**
 * A note body as rendered Markdown.
 *
 * One pipeline for the reader and the editor's preview. A second renderer would be a second set of
 * rules, and a preview that disagrees with the saved note is worse than no preview.
 */
export function Markdown({ source }: Props) {
  return (
    <article className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Only a block the author tagged gets highlighted: guessing the language of an untagged
        // block colours prose and JSON alike as something they are not.
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
