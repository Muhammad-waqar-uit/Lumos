import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/** Note links open outside the app window instead of navigating the UI away. */
const markdownComponents: Components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

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
