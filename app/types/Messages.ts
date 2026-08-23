import { type ApiHistoryEntry } from 'partytracks/client'
import type { TrackObject } from '~/utils/callsTypes'

export type User = {
	id: string
	name: string
	transceiverSessionId?: string
	raisedHand: boolean
	speaking: boolean
	joined: boolean
	isHost?: boolean
	tracks: {
		audio?: string
		audioEnabled?: boolean
		audioUnavailable: boolean
		video?: string
		videoEnabled?: boolean
		screenshare?: string
		screenShareEnabled?: boolean
	}
}

export type ChatMessage = {
	id: string
	fromId: string
	from: string
	message: string
	sentAt: number
}

export type RoomState = {
	meetingId?: string
	users: User[]
	roomLocked: boolean
	chatEnabled: boolean
	chatMessages: ChatMessage[]
	ai: {
		enabled: boolean
		controllingUser?: string
		error?: string
		connectionPending?: boolean
	}
}

export type KnownErrorCode =
	| 'not-authorized'
	| 'invalid-host-password'
	| 'host-password-too-short'
	| 'host-password-not-configured'
	| 'room-locked'
	| 'chat-disabled'
	| 'chat-message-too-long'

export type ServerMessage =
	| {
			type: 'roomState'
			state: RoomState
	  }
	| {
			type: 'error'
			error?: KnownErrorCode | string
	  }
	| {
			type: 'directMessage'
			from: string
			message: string
	  }
	| {
			type: 'muteMic'
	  }
	| {
			type: 'kicked'
	  }
	| {
			type: 'partyserver-pong'
	  }
	| {
			type: 'e2eeMlsMessage'
			payload: string
	  }
	| {
			type: 'userLeftNotification'
			id: string
	  }

export type ClientMessage =
	| {
			type: 'userUpdate'
			user: User
	  }
	| {
			type: 'directMessage'
			to: string
			message: string
	  }
	| {
			type: 'muteUser'
			id: string
	  }
	| {
			type: 'muteAll'
	  }
	| {
			type: 'kickUser'
			id: string
	  }
	| {
			type: 'claimHost'
			password: string
	  }
	| {
			type: 'lockRoom'
			locked: boolean
	  }
	| {
			type: 'toggleChat'
			enabled: boolean
	  }
	| {
			type: 'chatMessage'
			message: string
	  }
	| {
			type: 'userLeft'
	  }
	| {
			type: 'partyserver-ping'
	  }
	| {
			type: 'heartbeat'
	  }
	| {
			type: 'enableAi'
			instructions?: string
			voice?: string
	  }
	| {
			type: 'disableAi'
	  }
	| {
			type: 'requestAiControl'
			track: TrackObject
	  }
	| {
			type: 'relenquishAiControl'
	  }
	| {
			type: 'callsApiHistoryEntry'
			entry: ApiHistoryEntry
			sessionId?: string
	  }
	| {
			type: 'e2eeMlsMessage'
			payload: string
	  }
