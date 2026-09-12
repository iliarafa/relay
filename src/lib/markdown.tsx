import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ text }: { text: string }) {
  return (
    <div
      className={[
        'text-[15px] leading-[1.7] font-light break-words',
        '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
        '[&_p]:my-2 [&_p]:whitespace-pre-wrap',
        '[&_strong]:font-medium [&_em]:italic',
        '[&_a]:underline [&_a]:underline-offset-2',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2',
        '[&_li]:my-0.5',
        '[&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-foreground/[0.04] [&_pre]:border [&_pre]:rounded-[2px] [&_pre]:overflow-x-auto [&_pre]:text-xs',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_code]:bg-foreground/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-[2px] [&_code]:text-[0.9em] [&_code]:font-mono',
        '[&_h1]:text-base [&_h1]:font-normal [&_h1]:mt-3 [&_h1]:mb-1',
        '[&_h2]:text-base [&_h2]:font-normal [&_h2]:mt-3 [&_h2]:mb-1',
        '[&_h3]:font-normal [&_h3]:mt-2 [&_h3]:mb-1',
        '[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground',
        '[&_hr]:my-3 [&_hr]:border-border',
        '[&_table]:my-2 [&_table]:border-collapse',
        '[&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:font-normal',
        '[&_td]:border [&_td]:px-2 [&_td]:py-1',
      ].join(' ')}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
