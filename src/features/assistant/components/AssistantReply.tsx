import Markdown from "react-markdown";

export function AssistantReply({ content }: { content: string }) {
  return (
    <div className="space-y-3 whitespace-normal break-words leading-relaxed">
      <Markdown
        skipHtml
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children, start }) => <ol start={start} className="list-decimal space-y-1 pl-5">{children}</ol>,
          h1: ({ children }) => <p className="font-bold">{children}</p>,
          h2: ({ children }) => <p className="font-bold">{children}</p>,
          h3: ({ children }) => <p className="font-bold">{children}</p>,
          a: ({ children, href }) => href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2">{children}</a> : <span>{children}</span>,
          pre: ({ children }) => <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/10 p-2">{children}</pre>,
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >{content}</Markdown>
    </div>
  );
}
