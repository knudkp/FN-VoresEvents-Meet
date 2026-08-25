import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { requireAdmin } from '~/adminSession.server'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'
import type { Env } from '~/types/Env'
import type { User } from '~/types/Messages'
import getUsername from '~/utils/getUsername.server'

interface RoomAdminState {
	meetingId?: string
	roomLocked: boolean
	chatEnabled: boolean
	users: (User & { ip: string | null })[]
}

function callRoom(
	env: Env,
	roomName: string,
	path: string,
	init?: RequestInit
) {
	const id = env.rooms.idFromName(roomName)
	const stub = env.rooms.get(id)
	return stub.fetch(
		new Request(`https://internal.invalid${path}`, {
			...init,
			headers: { ...init?.headers, 'x-partykit-room': roomName },
		})
	)
}

export const loader = async ({
	request,
	context,
	params,
}: LoaderFunctionArgs) => {
	await requireAdmin(request)
	const roomName = params.roomName
	invariant(roomName)

	const res = await callRoom(context.env, roomName, '/admin/state')
	const state: RoomAdminState = await res.json()
	return json({ roomName, state })
}

export const action = async ({
	request,
	context,
	params,
}: ActionFunctionArgs) => {
	await requireAdmin(request)
	const roomName = params.roomName
	invariant(roomName)
	const actorName = (await getUsername(request)) ?? 'Admin'

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'lock' || intent === 'unlock') {
		await callRoom(context.env, roomName, '/admin/lock', {
			method: 'POST',
			body: JSON.stringify({ locked: intent === 'lock', actorName }),
		})
	} else if (intent === 'enable-chat' || intent === 'disable-chat') {
		await callRoom(context.env, roomName, '/admin/toggle-chat', {
			method: 'POST',
			body: JSON.stringify({ enabled: intent === 'enable-chat', actorName }),
		})
	} else if (intent === 'mute-all') {
		await callRoom(context.env, roomName, '/admin/mute-all', {
			method: 'POST',
			body: JSON.stringify({ actorName }),
		})
	} else if (intent === 'kick') {
		const id = formData.get('userId')
		invariant(typeof id === 'string')
		await callRoom(context.env, roomName, '/admin/kick', {
			method: 'POST',
			body: JSON.stringify({ id, actorName }),
		})
	} else if (intent === 'ban-ip') {
		const id = formData.get('userId')
		invariant(typeof id === 'string')
		await callRoom(context.env, roomName, '/admin/ban-ip', {
			method: 'POST',
			body: JSON.stringify({ id, actorName }),
		})
	} else if (intent === 'ban-username') {
		const id = formData.get('userId')
		invariant(typeof id === 'string')
		await callRoom(context.env, roomName, '/admin/ban-username', {
			method: 'POST',
			body: JSON.stringify({ id, actorName }),
		})
	}

	return json({ ok: true })
}

const roomRowButtonClassName =
	'rounded-md border px-3 py-1.5 text-xs font-medium normal-case tracking-normal'

export default function AdminRoomControl() {
	const { roomName, state } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-2xl space-y-8 p-6 text-zinc-800 dark:text-zinc-100">
			<h1 className="text-2xl font-bold text-[#0b565b]">{roomName}</h1>

			<section className="flex flex-wrap gap-3">
				<Form method="post">
					<input
						type="hidden"
						name="intent"
						value={state.roomLocked ? 'unlock' : 'lock'}
					/>
					<Tooltip
						content={
							state.roomLocked
								? 'Lås mødet op, så nye kan joine'
								: 'Lås mødet, så ingen nye kan joine'
						}
					>
						<Button
							type="submit"
							displayType="secondary"
							aria-label={state.roomLocked ? 'Lås op' : 'Lås mødet'}
						>
							{state.roomLocked ? 'Lås op' : 'Lås mødet'}
						</Button>
					</Tooltip>
				</Form>
				<Form method="post">
					<input
						type="hidden"
						name="intent"
						value={state.chatEnabled ? 'disable-chat' : 'enable-chat'}
					/>
					<Tooltip
						content={
							state.chatEnabled
								? 'Slå chatten fra for alle deltagere'
								: 'Slå chatten til for alle deltagere'
						}
					>
						<Button
							type="submit"
							displayType="secondary"
							aria-label={state.chatEnabled ? 'Slå chat fra' : 'Slå chat til'}
						>
							{state.chatEnabled ? 'Slå chat fra' : 'Slå chat til'}
						</Button>
					</Tooltip>
				</Form>
				<Form method="post">
					<input type="hidden" name="intent" value="mute-all" />
					<Tooltip content="Mute alle deltagere i mødet">
						<Button
							type="submit"
							displayType="danger"
							aria-label="Mute alle deltagere"
						>
							Mute alle
						</Button>
					</Tooltip>
				</Form>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Deltagere</h2>
				{state.users.length === 0 ? (
					<p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
						Ingen er i mødet lige nu.
					</p>
				) : (
					<ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
						{state.users.map((user) => (
							<li
								key={user.id}
								className="flex items-center justify-between gap-3 p-3 text-sm"
							>
								<div>
									<p className="font-medium">
										{user.name}
										{user.isHost ? ' (vært)' : ''}
									</p>
									{user.ip && (
										<p className="font-mono text-xs text-zinc-500">
											{user.ip}
										</p>
									)}
								</div>
								<div className="flex gap-2">
									<Form method="post">
										<input type="hidden" name="intent" value="kick" />
										<input type="hidden" name="userId" value={user.id} />
										<Tooltip content={`Fjern ${user.name} fra mødet`}>
											<Button
												type="submit"
												displayType="secondary"
												className={roomRowButtonClassName}
												aria-label={`Fjern ${user.name}`}
											>
												Fjern
											</Button>
										</Tooltip>
									</Form>
									<Form method="post">
										<input type="hidden" name="intent" value="ban-username" />
										<input type="hidden" name="userId" value={user.id} />
										<Tooltip content="Forhindrer denne deltager i at joine igen med samme navn">
											<Button
												type="submit"
												displayType="danger"
												className={roomRowButtonClassName}
												aria-label={`Ban brugernavnet ${user.name}`}
											>
												Ban bruger
											</Button>
										</Tooltip>
									</Form>
									<Form method="post">
										<input type="hidden" name="intent" value="ban-ip" />
										<input type="hidden" name="userId" value={user.id} />
										<Tooltip
											content={
												user.ip
													? 'Forhindrer denne IP-adresse i at joine noget møde igen'
													: 'IP-adresse ukendt'
											}
										>
											<Button
												type="submit"
												displayType="danger"
												className={roomRowButtonClassName}
												disabled={!user.ip}
												aria-label="Ban IP-adresse"
											>
												Ban IP
											</Button>
										</Tooltip>
									</Form>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
