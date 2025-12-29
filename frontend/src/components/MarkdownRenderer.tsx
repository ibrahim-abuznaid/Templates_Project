import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) {
    return <span className="text-gray-400 italic">No content</span>;
  }

  return (
    <div className={`markdown-content prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900 mt-3 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-800 mt-3 mb-1 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-gray-800 mt-2 mb-1 first:mt-0">{children}</h4>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-700 leading-relaxed mb-3 last:mb-0">{children}</p>
          ),
          
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline decoration-primary-300 hover:decoration-primary-500 transition-colors"
            >
              {children}
            </a>
          ),
          
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-gray-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-gray-700">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700">{children}</li>
          ),
          
          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-100 text-primary-700 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono ${className}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-300 pl-4 py-1 my-3 bg-primary-50/50 rounded-r-lg text-gray-700 italic">
              {children}
            </blockquote>
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-100">
              {children}
            </td>
          ),
          
          // Horizontal rule
          hr: () => <hr className="my-4 border-gray-200" />,
          
          // Strong & emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),
          
          // Task lists (GFM)
          input: ({ checked }) => (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

