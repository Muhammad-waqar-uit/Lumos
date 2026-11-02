import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { createSlugger } from "@lumos/vault-utils/note-text";
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

/** The plain text of a heading's children, so its id matches the outline's slug. */
function headingText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map((child) => headingText(child)).join("");
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return headingText(children.props.children);
  }
  return "";
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
  // Heading ids come from the same slugger the outline uses, so a Contents entry always has a
  // target. Only h2/h3 are targets: the note's h1 is the title above it and h4 is detail.
  const slug = createSlugger();
  const components: Components = {
    ...markdownComponents,
    h2: ({ children }) => <h2 id={slug(headingText(children))}>{children}</h2>,
    h3: ({ children }) => <h3 id={slug(headingText(children))}>{children}</h3>,
  };

  return (
    <article className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Only a block the author tagged gets highlighted: guessing the language of an untagged
        // block colours prose and JSON alike as something they are not.
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
