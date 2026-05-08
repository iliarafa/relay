import { MessageList } from './MessageList'
import { PromptBar } from './PromptBar'

export function ChatView() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MessageList />
      <PromptBar />
    </div>
  )
}
