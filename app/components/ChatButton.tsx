import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '~/types/Messages'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Tooltip } from './Tooltip'

interface ChatButtonProps {
	chatOpen: boolean
	onClick: () => void
	messages: ChatMessage[]
}

export const ChatButton: FC<ChatButtonProps> = ({
	chatOpen,
	onClick,
	messages,
}) => {
	const lastSeenCount = useRef(messages.length)
	const [unreadCount, setUnreadCount] = useState(0)

	useEffect(() => {
		if (chatOpen) {
			lastSeenCount.current = messages.length
			setUnreadCount(0)
		} else {
			setUnreadCount(Math.max(0, messages.length - lastSeenCount.current))
		}
	}, [chatOpen, messages.length])

	return (
		<Tooltip content="Chat">
			<Button
				className="relative"
				displayType={chatOpen ? 'primary' : 'secondary'}
				onClick={onClick}
				aria-label="Chat"
			>
				<VisuallyHidden>Chat</VisuallyHidden>
				<Icon type="chatBubble" />
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white">
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				)}
			</Button>
		</Tooltip>
	)
}
