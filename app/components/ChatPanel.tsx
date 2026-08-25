import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import type { ChatMessage, ClientMessage } from '~/types/Messages'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Input } from './Input'
import { Tooltip } from './Tooltip'

const formatTime = (sentAt: number) =>
	new Date(sentAt).toLocaleTimeString('da-DK', {
		hour: '2-digit',
		minute: '2-digit',
	})

const ChatMessageRow: FC<{ message: ChatMessage; isSelf: boolean }> = ({
	message,
	isSelf,
}) => {
	const { data } = useUserMetadata(message.from)
	return (
		<li className="space-y-0.5">
			<div className="flex items-baseline gap-2 text-xs text-zinc-500 dark:text-zinc-400">
				<span className="font-medium text-zinc-700 dark:text-zinc-200">
					{isSelf ? 'Dig' : data?.displayName}
				</span>
				<span>{formatTime(message.sentAt)}</span>
			</div>
			<p className="break-words text-sm text-zinc-800 dark:text-zinc-100">
				{message.message}
			</p>
		</li>
	)
}

interface ChatPanelProps {
	onClose: () => void
}

export const ChatPanel: FC<ChatPanelProps> = ({ onClose }) => {
	const { room } = useRoomContext()
	const { chatMessages, chatEnabled } = room.roomState
	const [draft, setDraft] = useState('')
	const listRef = useRef<HTMLUListElement>(null)

	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
	}, [chatMessages.length])

	return (
		<div className="flex w-80 flex-shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
			<div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-700">
				<h2 className="font-bold">Chat</h2>
				<Tooltip content="Luk chat">
					<Button displayType="ghost" onClick={onClose} aria-label="Luk chat">
						<VisuallyHidden>Luk chat</VisuallyHidden>
						<Icon type="xCircle" />
					</Button>
				</Tooltip>
			</div>
			<ul ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
				{chatMessages.map((message) => (
					<ChatMessageRow
						key={message.id}
						message={message}
						isSelf={message.fromId === room.identity?.id}
					/>
				))}
			</ul>
			<form
				className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700"
				onSubmit={(e) => {
					e.preventDefault()
					const message = draft.trim()
					if (!message) return
					room.websocket.send(
						JSON.stringify({
							type: 'chatMessage',
							message,
						} satisfies ClientMessage)
					)
					setDraft('')
				}}
			>
				{chatEnabled ? (
					<>
						<Input
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							maxLength={2000}
							placeholder="Skriv en besked…"
							aria-label="Chatbesked"
						/>
						<Tooltip content="Send besked">
							<Button type="submit" className="text-sm" aria-label="Send besked">
								Send
							</Button>
						</Tooltip>
					</>
				) : (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Værten har slået chat fra.
					</p>
				)}
			</form>
		</div>
	)
}
