import { useNavigate } from '@remix-run/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
	ClientMessage,
	KnownErrorCode,
	RoomState,
	ServerMessage,
} from '~/types/Messages'

import usePartySocket from 'partysocket/react'
import type { UserMedia } from './useUserMedia'

const knownErrorCodes: KnownErrorCode[] = [
	'not-authorized',
	'invalid-host-password',
	'host-password-too-short',
	'host-password-not-configured',
	'room-locked',
	'chat-disabled',
	'chat-message-too-long',
]

function isKnownErrorCode(error: unknown): error is KnownErrorCode {
	return (
		typeof error === 'string' &&
		knownErrorCodes.includes(error as KnownErrorCode)
	)
}

export default function useRoom({
	roomName,
	userMedia,
}: {
	roomName: string
	userMedia: UserMedia
}) {
	const navigate = useNavigate()
	const [roomState, setRoomState] = useState<RoomState>({
		users: [],
		roomLocked: false,
		chatEnabled: true,
		chatMessages: [],
		ai: { enabled: false },
	})
	const [deniedReason, setDeniedReason] = useState<'room-locked' | null>(null)
	const [lastError, setLastError] = useState<KnownErrorCode | undefined>()

	const userLeftFunctionRef = useRef(() => {})

	useEffect(() => {
		return () => userLeftFunctionRef.current()
	}, [])

	const websocket = usePartySocket({
		party: 'rooms',
		room: roomName,
		onMessage: (e) => {
			const message = JSON.parse(e.data) as ServerMessage
			switch (message.type) {
				case 'roomState':
					// prevent updating state if nothing has changed
					if (JSON.stringify(message.state) === JSON.stringify(roomState)) break
					setRoomState(message.state)
					break
				case 'error':
					console.error('Received error message from WebSocket')
					console.error(message.error)
					if (isKnownErrorCode(message.error)) {
						setLastError(message.error)
						if (message.error === 'room-locked') setDeniedReason('room-locked')
					}
					break
				case 'kicked':
					navigate('/?removed=1')
					break
				case 'directMessage':
					break
				case 'muteMic':
					userMedia.turnMicOff()
					break
				case 'partyserver-pong':
				case 'e2eeMlsMessage':
				case 'userLeftNotification':
					// do nothing
					break
				default:
					message satisfies never
					break
			}
		},
	})

	userLeftFunctionRef.current = () =>
		websocket.send(JSON.stringify({ type: 'userLeft' } satisfies ClientMessage))

	useEffect(() => {
		function onBeforeUnload() {
			userLeftFunctionRef.current()
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
		}
	}, [websocket])

	// setup a heartbeat
	useEffect(() => {
		const interval = setInterval(() => {
			websocket.send(
				JSON.stringify({ type: 'heartbeat' } satisfies ClientMessage)
			)
		}, 5_000)

		return () => clearInterval(interval)
	}, [websocket])

	const identity = useMemo(
		() => roomState.users.find((u) => u.id === websocket.id),
		[roomState.users, websocket.id]
	)

	const otherUsers = useMemo(
		() => roomState.users.filter((u) => u.id !== websocket.id && u.joined),
		[roomState.users, websocket.id]
	)

	return { identity, otherUsers, websocket, roomState, deniedReason, lastError }
}
