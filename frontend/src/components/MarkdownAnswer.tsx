import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNode = { type?: string; value?: string; children?: MarkdownNode[] };

function safeLineBreaks() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.children) {
        node.children = node.children.map((child) => child.type === "html" && /^<br\s*\/?>$/i.test(child.value?.trim() || "") ? { type: "break" } : child);
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

const components: Components = {
  table({ node: _node, ...props }) {
    return <div className="markdown-table-wrap" role="region" aria-label="回答中的数据表格" tabIndex={0}><table {...props} /></div>;
  },
};

export function MarkdownAnswer({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, safeLineBreaks]} components={components}>{children}</ReactMarkdown>;
}
