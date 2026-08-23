import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, useLoaderData } from '@remix-run/react'
import invariant from 'tiny-invariant'
import type { Env } from '~/types/Env'
import type { User } from '~/types/Messages'
import { requireAdmin } from '~/adminSession'
import { Button } from '~/components/Button'

interface RoomAdminState {
	meetingId?: string
	roomLocked: boolean
	chatEnabled: boolean
	users: User[]
}

function callRoom(env: Env, roomName: string, path: string, init?: RequestInit) {
	const id = env.rooms.idFromName(roomName)
	const stub = env.rooms.get(id)
	return stub.fetch(
		new Request(`https://internal.invalid${path}`, {
			...init,
			headers: { ...init?.headers, 'x-partykit-room': roomName },
		})
	)
}

export const loader = async ({ request, context, params }: LoaderFunctionArgs) => {
	await requireAdmin(request)
	const roomName = params.roomName
	invariant(roomName)

	const res = await callRoom(context.env, roomName, '/admin/state')
	const state: RoomAdminState = await res.json()
	return json({ roomName, state })
}

export const action = async ({ request, context, params }: ActionFunctionArgs) => {
	await requireAdmin(request)
	const roomName = params.roomName
	invariant(roomName)

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'lock' || intent === 'unlock') {
		await callRoom(context.env, roomName, '/admin/lock', {
			method: 'POST',
			body: JSON.stringify({ locked: intent === 'lock' }),
		})
	} else if (intent === 'enable-chat' || intent === 'disable-chat') {
		await callRoom(context.env, roomName, '/admin/toggle-chat', {
			method: 'POST',
			body: JSON.stringify({ enabled: intent === 'enable-chat' }),
		})
	} else if (intent === 'mute-all') {
		await callRoom(context.env, roomName, '/admin/mute-all', { method: 'POST' })
	} else if (intent === 'kick') {
		const id = formData.get('userId')
		invariant(typeof id === 'string')
		await callRoom(context.env, roomName, '/admin/kick', {
			method: 'POST',
			body: JSON.stringify({ id }),
		})
	}

	return json({ ok: true })
}

export default function AdminRoomControl() {
	const { roomName, state } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-2xl space-y-8 p-6 text-zinc-800">
			<h1 className="text-2xl font-bold text-[#0b565b]">{roomName}</h1>

			<section className="flex flex-wrap gap-3">
				<Form method="post">
					<input
						type="hidden"
						name="intent"
						value={state.roomLocked ? 'unlock' : 'lock'}
					/>
					<Button type="submit" displayType="secondary">
						{state.roomLocked ? 'Lås op' : 'Lås mødet'}
					</Button>
				</Form>
				<Form method="post">
					<input
						type="hidden"
						name="intent"
						value={state.chatEnabled ? 'disable-chat' : 'enable-chat'}
					/>
					<Button type="submit" displayType="secondary">
						{state.chatEnabled ? 'Slå chat fra' : 'Slå chat til'}
					</Button>
				</Form>
				<Form method="post">
					<input type="hidden" name="intent" value="mute-all" />
					<Button type="submit" displayType="danger">
						Mute alle
					</Button>
				</Form>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Deltagere</h2>
				{state.users.length === 0 && (
					<p className="text-sm text-zinc-500">Ingen er i mødet lige nu.</p>
				)}
				<ul className="space-y-2">
					{state.users.map((user) => (
						<li
							key={user.id}
							className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm"
						>
							<span>
								{user.name}
								{user.isHost ? ' (vært)' : ''}
							</span>
							<Form method="post">
								<input type="hidden" name="intent" value="kick" />
								<input type="hidden" name="userId" value={user.id} />
								<Button type="submit" displayType="danger" className="text-xs">
									Fjern
								</Button>
							</Form>
						</li>
					))}
				</ul>
			</section>
		</div>
	)
}
