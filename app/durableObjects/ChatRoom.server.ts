import type { Env } from '~/types/Env'
import type {
	ChatMessage,
	ClientMessage,
	ServerMessage,
	User,
} from '~/types/Messages'
import { assertError } from '~/utils/assertError'
import assertNever from '~/utils/assertNever'
import { assertNonNullable } from '~/utils/assertNonNullable'
import getUsername from '~/utils/getUsername.server'

import { eq, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { nanoid } from 'nanoid'
import {
	Server,
	type Connection,
	type ConnectionContext,
	type WSMessage,
} from 'partyserver'
import {
	AdminAuditLog,
	ChatMessages as ChatMessagesTable,
	getDb,
	Meetings,
	Rooms,
	Users,
} from 'schema'
import invariant from 'tiny-invariant'
import { hashPassword } from '~/utils/hashPassword.server'
import { log } from '~/utils/logging'
import {
	CallsNewSession,
	CallsSession,
	checkNewTracksResponse,
	requestOpenAIService,
	type SessionDescription,
} from '~/utils/openai.server'

const alarmInterval = 15_000
const defaultOpenAIModelID = 'gpt-4o-realtime-preview-2024-10-01'

/**
 * The ChatRoom Durable Object Class
 *
 * ChatRoom implements a Durable Object that coordinates an
 * individual chat room. Participants connect to the room using
 * WebSockets, and the room broadcasts messages from each participant
 * to all others.
 */
export class ChatRoom extends Server<Env> {
	env: Env
	db: DrizzleD1Database<Record<string, never>> | null

	// static options = { hibernate: true }

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.env = env
		this.db = getDb(this)
	}

	// a small typesafe wrapper around connection.send
	sendMessage<M extends ServerMessage>(connection: Connection, message: M) {
		connection.send(JSON.stringify(message))
	}

	async onStart(): Promise<void> {
		const meetingId = await this.getMeetingId()
		log({ eventName: 'onStart', meetingId })
		this.db = getDb(this)
		// TODO: make this a part of partyserver
		// this.ctx.setWebSocketAutoResponse(
		// 	new WebSocketRequestResponsePair(
		// 		JSON.stringify({ type: 'partyserver-ping' }),
		// 		JSON.stringify({ type: 'partyserver-pong' })
		// 	)
		// )
	}

	async onConnect(
		connection: Connection<User>,
		ctx: ConnectionContext
	): Promise<void> {
		// let's start the periodic alarm if it's not already started
		if (!(await this.ctx.storage.getAlarm())) {
			// start the alarm to broadcast state every 30 seconds
			this.ctx.storage.setAlarm(Date.now() + alarmInterval)
		}

		const username = await getUsername(ctx.request)
		assertNonNullable(username)

		const roomLocked = (await this.ctx.storage.get<boolean>('roomLocked')) ?? false
		if (roomLocked) {
			const hostConnectionIds = await this.getHostConnectionIds()
			let isReconnectingHost = false
			for (const hostId of hostConnectionIds) {
				const hostUser = await this.ctx.storage.get<User>(`session-${hostId}`)
				if (hostUser?.name === username) {
					isReconnectingHost = true
					break
				}
			}
			if (!isReconnectingHost) {
				this.sendMessage(connection, { type: 'error', error: 'room-locked' })
				log({
					eventName: 'roomLockedRejection',
					meetingId: await this.getMeetingId(),
					connectionId: connection.id,
				})
				connection.close(4003, 'Room is locked')
				return
			}
		}

		let user = await this.ctx.storage.get<User>(`session-${connection.id}`)
		const foundInStorage = user !== undefined
		if (!foundInStorage) {
			user = {
				id: connection.id,
				name: username,
				joined: false,
				raisedHand: false,
				speaking: false,
				tracks: {
					audioEnabled: false,
					audioUnavailable: false,
					videoEnabled: false,
					screenShareEnabled: false,
				},
			}
		}

		// store the user's data in storage
		await this.ctx.storage.put(`session-${connection.id}`, user)
		await this.ctx.storage.put(`heartbeat-${connection.id}`, Date.now())
		await this.trackPeakUserCount()

		// moderators are automatically host in every meeting they join,
		// no manual "Bliv vært" needed
		if (this.db) {
			const [dbUser] = await this.db
				.select()
				.from(Users)
				.where(eq(Users.username, username))
			if (dbUser?.role === 'moderator') {
				await this.addHostConnectionId(connection.id)
			}
		}

		await this.broadcastRoomState()
		const meetingId = await this.getMeetingId()
		log({
			eventName: 'onConnect',
			meetingId,
			foundInStorage,
			connectionId: connection.id,
		})
	}

	async trackPeakUserCount() {
		let meetingId = await this.getMeetingId()
		const meeting = meetingId
			? await this.getMeeting(meetingId)
			: await this.createMeeting()
		await this.cleanupOldConnections()
		if (this.db) {
			if (!meeting) return
			if (meeting.ended !== null) {
				await this.db
					.update(Meetings)
					.set({ ended: null })
					.where(eq(Meetings.id, meeting.id))
			}

			const previousCount = meeting.peakUserCount
			const userCount = (await this.getUsers()).size
			if (userCount > previousCount) {
				await this.db
					.update(Meetings)
					.set({
						peakUserCount: userCount,
					})
					.where(eq(Meetings.id, meeting.id))
			}
		}
		return meetingId
	}

	async getMeetingId() {
		return this.ctx.storage.get<string>('meetingId')
	}

	async createMeeting() {
		const meetingId = crypto.randomUUID()
		await this.ctx.storage.put('meetingId', meetingId)
		log({ eventName: 'startingMeeting', meetingId })

		let roomPreset = null
		if (this.db) {
			;[roomPreset] = await this.db
				.select()
				.from(Rooms)
				.where(eq(Rooms.id, this.name))
		}
		if (roomPreset) {
			await this.ctx.storage.put('roomLocked', roomPreset.lockedByDefault)
			await this.ctx.storage.put('chatEnabled', roomPreset.chatEnabledByDefault)
		}

		if (this.db) {
			return this.db
				.insert(Meetings)
				.values({
					id: meetingId,
					peakUserCount: 1,
					hostPasswordHash: roomPreset?.presetHostPasswordHash,
					roomName: this.name,
				})
				.returning()
				.then(([m]) => m)
		}
	}

	async getMeeting(meetingId: string) {
		if (!this.db) return null
		const [meeting] = await this.db
			.select()
			.from(Meetings)
			.where(eq(Meetings.id, meetingId))

		return meeting
	}

	async broadcastMessage(
		message: ServerMessage,
		excludedConnection?: Connection
	) {
		let didSomeoneQuit = false
		const meetingId = await this.getMeetingId()
		const messageAsString = JSON.stringify(message)

		for (const connection of this.getConnections()) {
			try {
				if (excludedConnection && connection === excludedConnection) continue
				connection.send(messageAsString)
			} catch (err) {
				connection.close(1011, 'Failed to broadcast state')
				log({
					eventName: 'errorBroadcastingToUser',
					meetingId,
					connectionId: connection.id,
				})
				await this.ctx.storage.delete(`session-${connection.id}`)
				didSomeoneQuit = true
			}
		}

		if (didSomeoneQuit) {
			// broadcast again to remove the user who quit
			await this.broadcastRoomState()
		}
	}

	async broadcastRoomState() {
		const meetingId = await this.getMeetingId()
		const aiEnabled =
			(await this.ctx.storage.get<boolean>('ai:enabled')) ?? false
		const aiSessionId =
			(await this.ctx.storage.get<string>('ai:sessionId')) ?? undefined
		const aiAudioTrack =
			(await this.ctx.storage.get<string>('ai:trackName')) ?? undefined
		const hostConnectionIds = await this.getHostConnectionIds()
		const roomLocked =
			(await this.ctx.storage.get<boolean>('roomLocked')) ?? false
		const chatEnabled =
			(await this.ctx.storage.get<boolean>('chatEnabled')) ?? true
		const chatMessages = [
			...(await this.ctx.storage.list<ChatMessage>({ prefix: 'chat:' })).values(),
		].slice(-200)
		const roomState = {
			type: 'roomState',
			state: {
				ai: {
					enabled: aiEnabled,
					controllingUser:
						await this.ctx.storage.get<string>('ai:userControlling'),
					connectionPending: await this.ctx.storage.get<boolean>(
						'ai:connectionPending'
					),
					error: await this.ctx.storage.get<string>('ai:error'),
				},
				meetingId,
				roomLocked,
				chatEnabled,
				chatMessages,
				users: [
					...[...(await this.getUsers()).values()].map((u) => ({
						...u,
						isHost: hostConnectionIds.includes(u.id),
					})),
					...(aiEnabled
						? [
								{
									id: 'ai',
									name: 'AI',
									joined: true,
									raisedHand: false,
									transceiverSessionId: aiSessionId,
									speaking: false,
									tracks: {
										audioEnabled: true,
										audio: aiSessionId + '/' + aiAudioTrack,
										audioUnavailable: false,
										videoEnabled: false,
										screenShareEnabled: false,
									},
								} satisfies User,
							]
						: []),
				],
			},
		} satisfies ServerMessage
		return this.broadcastMessage(roomState)
	}

	async logAdminAction(
		meetingId: string | undefined,
		action: string,
		actorId: string,
		actorName: string,
		targetId?: string,
		targetName?: string
	) {
		if (!this.db || !meetingId) return
		await this.db.insert(AdminAuditLog).values({
			meetingId,
			action,
			actorId,
			actorName,
			targetId,
			targetName,
		})
	}

	// The following perform* methods hold the actual admin-action logic,
	// shared between the websocket onMessage cases (a host acting from
	// inside the room) and the onRequest admin HTTP endpoints (an admin
	// acting remotely from the /admin dashboard, with no live connection
	// of their own).

	async performLock(locked: boolean, actorId: string, actorName: string) {
		const meetingId = await this.getMeetingId()
		await this.ctx.storage.put('roomLocked', locked)
		await this.logAdminAction(
			meetingId,
			locked ? 'lockRoom' : 'unlockRoom',
			actorId,
			actorName
		)
		await this.broadcastRoomState()
	}

	async performToggleChat(enabled: boolean, actorId: string, actorName: string) {
		const meetingId = await this.getMeetingId()
		await this.ctx.storage.put('chatEnabled', enabled)
		await this.logAdminAction(
			meetingId,
			enabled ? 'enableChat' : 'disableChat',
			actorId,
			actorName
		)
		await this.broadcastRoomState()
	}

	async performMuteAll(actorId: string, actorName: string) {
		const meetingId = await this.getMeetingId()
		for (const otherConnection of this.getConnections<User>()) {
			if (otherConnection.id === actorId) continue
			const otherUser = await this.ctx.storage.get<User>(
				`session-${otherConnection.id}`
			)
			if (!otherUser) continue
			await this.ctx.storage.put(`session-${otherConnection.id}`, {
				...otherUser,
				tracks: {
					...otherUser.tracks,
					audioEnabled: false,
				},
			})
			this.sendMessage(otherConnection, { type: 'muteMic' })
		}
		await this.logAdminAction(meetingId, 'muteAll', actorId, actorName)
		await this.broadcastRoomState()
	}

	async performKick(
		targetId: string,
		actorId: string,
		actorName: string
	): Promise<boolean> {
		const meetingId = await this.getMeetingId()
		const targetConnection = [...this.getConnections<User>()].find(
			(c) => c.id === targetId
		)
		if (!targetConnection) {
			console.warn(`User with id "${targetId}" not found, cannot kick user`)
			return false
		}
		const targetUser = await this.ctx.storage.get<User>(
			`session-${targetId}`
		)
		this.sendMessage(targetConnection, { type: 'kicked' })
		targetConnection.close(4001, 'Removed by host')
		await this.ctx.storage.delete(`session-${targetId}`).catch(() => {
			console.warn(`Failed to delete session session-${targetId} on kick`)
		})
		await this.ctx.storage.delete(`heartbeat-${targetId}`).catch(() => {
			console.warn(`Failed to delete session heartbeat-${targetId} on kick`)
		})
		this.userLeftNotification(targetId)
		await this.logAdminAction(
			meetingId,
			'kickUser',
			actorId,
			actorName,
			targetId,
			targetUser?.name
		)
		await this.broadcastRoomState()
		return true
	}

	// More than one connection can be host at once (someone who claimed
	// host plus any auto-hosted moderators), so this is a set, not a
	// single id.
	async getHostConnectionIds(): Promise<string[]> {
		return (await this.ctx.storage.get<string[]>('hostConnectionIds')) ?? []
	}

	async addHostConnectionId(connectionId: string) {
		const ids = await this.getHostConnectionIds()
		if (!ids.includes(connectionId)) {
			await this.ctx.storage.put('hostConnectionIds', [...ids, connectionId])
		}
	}

	// Single source of truth for host permission checks. Sends an
	// error back to the requester and returns false when denied, so
	// every gated case in onMessage can early-return on this one line.
	async requireHost(connection: Connection, action: string): Promise<boolean> {
		const hostConnectionIds = await this.getHostConnectionIds()
		if (hostConnectionIds.includes(connection.id)) return true
		this.sendMessage(connection, { type: 'error', error: 'not-authorized' })
		const meetingId = await this.getMeetingId()
		log({
			eventName: 'unauthorizedHostAction',
			meetingId,
			connectionId: connection.id,
			action,
		})
		return false
	}

	async onClose(
		connection: Connection,
		code: number,
		reason: string,
		wasClean: boolean
	) {
		const meetingId = await this.getMeetingId()
		log({
			eventName: 'onClose',
			meetingId,
			connectionId: connection.id,
			code,
			reason,
			wasClean,
		})
	}

	async onMessage(
		connection: Connection<User>,
		message: WSMessage
	): Promise<void> {
		try {
			const meetingId = await this.getMeetingId()
			if (typeof message !== 'string') {
				console.warn('Received non-string message')
				return
			}

			let data: ClientMessage = JSON.parse(message)

			switch (data.type) {
				case 'userLeft': {
					connection.close(1000, 'User left')
					this.userLeftNotification(connection.id)
					await this.ctx.storage
						.delete(`session-${connection.id}`)
						.catch(() => {
							console.warn(
								`Failed to delete session session-${connection.id} on userLeft`
							)
						})
					await this.ctx.storage
						.delete(`heartbeat-${connection.id}`)
						.catch(() => {
							console.warn(
								`Failed to delete session session-heartbeat-${connection.id} on userLeft`
							)
						})
					log({ eventName: 'userLeft', meetingId, connectionId: connection.id })

					await this.broadcastRoomState()
					break
				}
				case 'userUpdate': {
					this.ctx.storage.put(`session-${connection.id}`, data.user)
					await this.broadcastRoomState()
					break
				}
				case 'callsApiHistoryEntry': {
					const { entry, sessionId } = data
					log({
						eventName: 'clientNegotiationRecord',
						connectionId: connection.id,
						meetingId,
						entry,
						sessionId,
					})
					break
				}
				case 'directMessage': {
					const { to, message } = data
					const fromUser = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)

					for (const otherConnection of this.getConnections<User>()) {
						if (otherConnection.id === to) {
							this.sendMessage(otherConnection, {
								type: 'directMessage',
								from: fromUser!.name,
								message,
							})
							break
						}
					}
					console.warn(
						`User with id "${to}" not found, cannot send DM from "${fromUser!.name}"`
					)
					break
				}
				case 'muteUser': {
					const isSelfMute = data.id === connection.id
					if (!isSelfMute && !(await this.requireHost(connection, 'muteUser')))
						break
					const user = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					let mutedUser = false
					for (const otherConnection of this.getConnections<User>()) {
						if (otherConnection.id === data.id) {
							const otherUser = await this.ctx.storage.get<User>(
								`session-${data.id}`
							)
							await this.ctx.storage.put(`session-${data.id}`, {
								...otherUser!,
								tracks: {
									...otherUser!.tracks,
									audioEnabled: false,
								},
							})
							this.sendMessage(otherConnection, {
								type: 'muteMic',
							})

							await this.broadcastRoomState()
							mutedUser = true
							break
						}
					}
					if (!mutedUser) {
						console.warn(
							`User with id "${data.id}" not found, cannot mute user from "${user!.name}"`
						)
					}
					break
				}

				case 'muteAll': {
					if (!(await this.requireHost(connection, 'muteAll'))) break
					const actor = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					await this.performMuteAll(connection.id, actor?.name ?? 'unknown')
					break
				}

				case 'kickUser': {
					if (!(await this.requireHost(connection, 'kickUser'))) break
					if (data.id === connection.id) break
					const actor = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					await this.performKick(
						data.id,
						connection.id,
						actor?.name ?? 'unknown'
					)
					break
				}

				case 'claimHost': {
					if (!this.env.ADMIN_USERNAME) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'host-password-not-configured',
						})
						break
					}
					const trimmedUsername = data.username.trim()
					if (
						trimmedUsername.toLowerCase() !==
						this.env.ADMIN_USERNAME.trim().toLowerCase()
					) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'invalid-host-password',
						})
						break
					}

					const trimmedPassword = data.password.trim()
					if (trimmedPassword.length < 4) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'host-password-too-short',
						})
						break
					}

					const isMasterPassword =
						!!this.env.HOST_PASSWORD &&
						trimmedPassword === this.env.HOST_PASSWORD

					let authorized = isMasterPassword

					if (!authorized) {
						if (!this.db || !meetingId) {
							this.sendMessage(connection, {
								type: 'error',
								error: 'host-password-not-configured',
							})
							break
						}
						const [meeting] = await this.db
							.select()
							.from(Meetings)
							.where(eq(Meetings.id, meetingId))
						if (!meeting) {
							this.sendMessage(connection, {
								type: 'error',
								error: 'host-password-not-configured',
							})
							break
						}
						const passwordHash = await hashPassword(trimmedPassword)
						if (!meeting.hostPasswordHash) {
							// First person to claim host for this meeting sets its password.
							await this.db
								.update(Meetings)
								.set({ hostPasswordHash: passwordHash })
								.where(eq(Meetings.id, meetingId))
							authorized = true
						} else {
							authorized = passwordHash === meeting.hostPasswordHash
						}
					}

					if (!authorized) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'invalid-host-password',
						})
						break
					}

					await this.addHostConnectionId(connection.id)
					const sender = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					await this.logAdminAction(
						meetingId,
						'hostClaimed',
						connection.id,
						sender?.name ?? 'unknown'
					)
					log({
						eventName: 'hostClaimed',
						meetingId,
						connectionId: connection.id,
					})
					await this.broadcastRoomState()
					break
				}

				case 'lockRoom': {
					if (!(await this.requireHost(connection, 'lockRoom'))) break
					const actor = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					await this.performLock(
						data.locked,
						connection.id,
						actor?.name ?? 'unknown'
					)
					break
				}

				case 'toggleChat': {
					if (!(await this.requireHost(connection, 'toggleChat'))) break
					const actor = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					await this.performToggleChat(
						data.enabled,
						connection.id,
						actor?.name ?? 'unknown'
					)
					break
				}

				case 'chatMessage': {
					const chatEnabled =
						(await this.ctx.storage.get<boolean>('chatEnabled')) ?? true
					if (!chatEnabled) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'chat-disabled',
						})
						break
					}
					const trimmed = data.message.trim()
					if (trimmed.length === 0) break
					if (trimmed.length > 2000) {
						this.sendMessage(connection, {
							type: 'error',
							error: 'chat-message-too-long',
						})
						break
					}
					const sender = await this.ctx.storage.get<User>(
						`session-${connection.id}`
					)
					if (!sender) break
					const sentAt = Date.now()
					const chatMessage = {
						id: nanoid(),
						fromId: connection.id,
						from: sender.name,
						message: trimmed,
						sentAt,
					} satisfies ChatMessage
					await this.ctx.storage.put(
						`chat:${sentAt}-${chatMessage.id}`,
						chatMessage
					)
					if (this.db && meetingId) {
						await this.db.insert(ChatMessagesTable).values({
							meetingId,
							fromId: connection.id,
							fromName: sender.name,
							message: trimmed,
							sentAt,
						})
					}
					await this.broadcastRoomState()
					break
				}

				case 'partyserver-ping': {
					// do nothing, this should never be received
					console.warn(
						"Received partyserver-ping from client. You shouldn't be seeing this message. Did you forget to enable hibernation?"
					)
					break
				}
				case 'e2eeMlsMessage': {
					// forward as-is
					this.broadcastMessage(data, connection)
					break
				}
				case 'heartbeat': {
					await this.ctx.storage.put(`heartbeat-${connection.id}`, Date.now())
					break
				}
				case 'disableAi': {
					await this.ctx.storage
						.list({
							prefix: 'ai:',
						})
						.then((map) => {
							for (const key of map.keys()) {
								this.ctx.storage.delete(key)
							}
						})
					this.broadcastRoomState()

					break
				}
				case 'enableAi': {
					await this.ctx.storage.put('ai:connectionPending', true)
					await this.ctx.storage.delete('ai:error')
					this.broadcastRoomState()

					try {
						// This session establishes a PeerConnection between Calls and OpenAI.
						// CallsNewSession thirdparty parameter must be true to be able to connect to an external WebRTC server
						const openAiSession = await CallsNewSession(
							this.env.CALLS_APP_ID,
							this.env.CALLS_APP_SECRET,
							this.env.API_EXTRA_PARAMS,
							await this.getMeetingId(),
							true
						)
						const openAiTracksResponse = await openAiSession.NewTracks({
							// No offer is provided so Calls will generate one for us
							tracks: [
								{
									location: 'local',
									trackName: 'ai-generated-voice',
									// Let it know a sendrecv transceiver is wanted to receive this track instead of a recvonly one
									bidirectionalMediaStream: true,
									// Needed to create an appropriate response
									kind: 'audio',
								},
							],
						})
						checkNewTracksResponse(openAiTracksResponse, true)

						invariant(this.env.OPENAI_MODEL_ENDPOINT)
						invariant(this.env.OPENAI_API_TOKEN)

						const params = new URLSearchParams()
						const { voice, instructions } = data
						if (voice) {
							params.set('voice', voice)
						}
						if (instructions) {
							params.set('instructions', instructions)
						}

						params.set(
							'model',
							this.env.OPENAI_MODEL_ID || defaultOpenAIModelID
						)

						// The Calls's offer is sent to OpenAI
						const openaiAnswer = await requestOpenAIService(
							openAiTracksResponse.sessionDescription ||
								({} as SessionDescription),
							this.env.OPENAI_API_TOKEN,
							this.env.OPENAI_MODEL_ENDPOINT,
							params
						)

						console.log('OpenAI answer', openaiAnswer)

						// And the negotiation is completed by setting the answer from OpenAI
						const renegotiationResponse =
							await openAiSession.Renegotiate(openaiAnswer)
						console.log('renegotiationResponse', renegotiationResponse)

						console.log('set ai:sessionId', openAiSession.sessionId)
						await this.ctx.storage.put('ai:sessionId', openAiSession.sessionId)
						await this.ctx.storage.put(
							'ai:trackName',
							openAiTracksResponse.tracks[0].trackName
						)
						await this.ctx.storage.put('ai:enabled', true)
						await this.ctx.storage.put('ai:connectionPending', false)
						this.broadcastRoomState()

						break
					} catch (error) {
						console.error(error)
						await this.ctx.storage.put('ai:connectionPending', false)
						await this.ctx.storage.put(
							'ai:error',
							'Error establishing connection with AI'
						)
						this.broadcastRoomState()
						break
					}
				}
				case 'requestAiControl': {
					const userControllingPending = await this.ctx.storage.get<string>(
						'ai:userControlling:pending'
					)
					if (userControllingPending) {
						break
					}
					await this.ctx.storage.put(
						'ai:userControlling:pending',
						connection.id
					)
					try {
						const aiSessionId =
							await this.ctx.storage.get<string>('ai:sessionId')
						invariant(aiSessionId)
						const openAiSession = new CallsSession(
							aiSessionId,
							{
								Authorization: `Bearer ${this.env.CALLS_APP_SECRET}`,
								'Content-Type': 'application/json',
							},
							`https://rtc.live.cloudflare.com/apps/${this.env.CALLS_APP_ID}`
						)

						const { track } = data

						console.log('starting exchangeStepTwo, pulling', {
							session: track.sessionId,
							trackName: track.trackName,
						})
						const exchangeStepTwo = await openAiSession.NewTracks({
							tracks: [
								{
									location: 'remote',
									sessionId: track.sessionId,
									trackName: track.trackName,
									// Let Calls to find out the actual mid value
									mid: `#ai-generated-voice`,
								},
							],
						})

						console.log('exchangeStepTwo result', exchangeStepTwo)
						checkNewTracksResponse(exchangeStepTwo)

						await this.ctx.storage.put('ai:userControlling', connection.id)
						this.broadcastRoomState()
					} finally {
						await this.ctx.storage.delete('ai:userControlling:pending')
					}
					break
				}
				case 'relenquishAiControl': {
					await this.ctx.storage.delete('ai:userControlling:pending')
					this.ctx.storage.delete('ai:userControlling')
					this.broadcastRoomState()
					break
				}
				default: {
					assertNever(data)
					break
				}
			}
		} catch (error) {
			const meetingId = await this.getMeetingId()
			log({
				eventName: 'errorHandlingMessage',
				meetingId,
				connectionId: connection.id,
				error,
			})
			assertError(error)
			// TODO: should this even be here?
			// Report any exceptions directly back to the client. As with our handleErrors() this
			// probably isn't what you'd want to do in production, but it's convenient when testing.
			this.sendMessage(connection, {
				type: 'error',
				error: error.stack,
			} satisfies ServerMessage)
		}
	}

	onError(connection: Connection, error: unknown): void | Promise<void> {
		log({
			eventName: 'onErrorHandler',
			error,
		})
		return this.getMeetingId().then((meetingId) => {
			log({
				eventName: 'onErrorHandlerDetails',
				meetingId,
				connectionId: connection.id,
				error,
			})
			this.broadcastRoomState()
		})
	}

	// HTTP entry point for the /admin dashboard's remote room controls.
	// Reached via a direct DO stub fetch (see app/routes/admin.rooms.$roomName.tsx),
	// never from the public internet — the calling Remix action already
	// verified the admin session before constructing the stub, so these
	// endpoints don't re-check credentials themselves.
	async onRequest(request: Request): Promise<Response> {
		const { pathname } = new URL(request.url)

		if (pathname === '/admin/state' && request.method === 'GET') {
			const hostConnectionIds = await this.getHostConnectionIds()
			const roomLocked =
				(await this.ctx.storage.get<boolean>('roomLocked')) ?? false
			const chatEnabled =
				(await this.ctx.storage.get<boolean>('chatEnabled')) ?? true
			const users = [...(await this.getUsers()).values()].map((u) => ({
				...u,
				isHost: hostConnectionIds.includes(u.id),
			}))
			return Response.json({
				meetingId: await this.getMeetingId(),
				roomLocked,
				chatEnabled,
				users,
			})
		}

		if (pathname === '/admin/lock' && request.method === 'POST') {
			const { locked } = (await request.json()) as { locked: boolean }
			await this.performLock(locked, 'admin', 'Admin')
			return Response.json({ ok: true })
		}

		if (pathname === '/admin/toggle-chat' && request.method === 'POST') {
			const { enabled } = (await request.json()) as { enabled: boolean }
			await this.performToggleChat(enabled, 'admin', 'Admin')
			return Response.json({ ok: true })
		}

		if (pathname === '/admin/mute-all' && request.method === 'POST') {
			await this.performMuteAll('admin', 'Admin')
			return Response.json({ ok: true })
		}

		if (pathname === '/admin/kick' && request.method === 'POST') {
			const { id } = (await request.json()) as { id: string }
			const kicked = await this.performKick(id, 'admin', 'Admin')
			return Response.json({ ok: kicked })
		}

		return new Response('Not found', { status: 404 })
	}

	getUsers() {
		return this.ctx.storage.list<User>({
			prefix: 'session-',
		})
	}

	async endMeeting(meetingId: string) {
		log({ eventName: 'endingMeeting', meetingId })
		if (this.db) {
			// stamp meeting as ended
			await this.db
				.update(Meetings)
				.set({
					ended: sql`CURRENT_TIMESTAMP`,
				})
				.where(eq(Meetings.id, meetingId))
		}
		await this.ctx.storage.deleteAll()
	}

	userLeftNotification(id: string) {
		this.broadcastMessage({
			type: 'userLeftNotification',
			id,
		})
	}

	async cleanupOldConnections() {
		const meetingId = await this.getMeetingId()
		if (!meetingId) log({ eventName: 'meetingIdNotFoundInCleanup' })
		const now = Date.now()
		const users = await this.getUsers()
		let removedUsers = 0
		const connections = [...this.getConnections()]

		for (const [key, user] of users) {
			const connectionId = key.replace('session-', '')
			const heartbeat = await this.ctx.storage.get<number>(
				`heartbeat-${connectionId}`
			)
			if (heartbeat === undefined || heartbeat + alarmInterval < now) {
				this.userLeftNotification(connectionId)
				removedUsers++
				await this.ctx.storage.delete(key).catch(() => {
					console.warn(
						`Failed to delete session ${key} in cleanupOldConnections`
					)
				})

				const connection = connections.find((c) => c.id === connectionId)
				if (connection) {
					connection.close(1011)
				}
				log({ eventName: 'userTimedOut', connectionId: user.id, meetingId })
			}
		}

		const activeUserCount = (await this.getUsers()).size

		if (meetingId && activeUserCount === 0) {
			this.endMeeting(meetingId)
		} else if (removedUsers > 0) {
			this.broadcastRoomState()
		}

		return activeUserCount
	}

	async alarm(): Promise<void> {
		const meetingId = await this.getMeetingId()
		log({ eventName: 'alarm', meetingId })
		const activeUserCount = await this.cleanupOldConnections()
		await this.broadcastRoomState()
		if (activeUserCount !== 0) {
			this.ctx.storage.setAlarm(Date.now() + alarmInterval)
		}
	}
}
