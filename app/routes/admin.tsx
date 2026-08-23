import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { desc, eq } from 'drizzle-orm'
import invariant from 'tiny-invariant'
import { getDb, Meetings, Rooms } from 'schema'
import { requireAdmin } from '~/adminSession'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { hashPassword } from '~/utils/hashPassword.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	await requireAdmin(request)
	const db = getDb(context)

	const rooms = db ? await db.select().from(Rooms).orderBy(desc(Rooms.created)) : []
	const meetings = db
		? await db.select().from(Meetings).orderBy(desc(Meetings.created)).limit(50)
		: []

	return json({ rooms, meetings, hasDb: Boolean(db) })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	await requireAdmin(request)
	const db = getDb(context)
	if (!db) {
		return json({ error: 'Ingen database er konfigureret.' }, { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'delete') {
		const roomId = formData.get('roomId')
		invariant(typeof roomId === 'string')
		await db.delete(Rooms).where(eq(Rooms.id, roomId))
		return json({ ok: true })
	}

	if (intent === 'reserve') {
		const rawName = formData.get('name')
		invariant(typeof rawName === 'string')
		const name = rawName.trim().replace(/ /g, '-')
		if (!name) return json({ error: 'Rummet skal have et navn.' }, { status: 400 })

		const lockedByDefault = formData.get('lockedByDefault') === 'on'
		const chatEnabledByDefault = formData.get('chatEnabledByDefault') === 'on'
		const password = formData.get('password')
		const presetHostPasswordHash =
			typeof password === 'string' && password.trim().length > 0
				? await hashPassword(password.trim())
				: null

		const [existing] = await db.select().from(Rooms).where(eq(Rooms.id, name))
		if (existing) {
			await db
				.update(Rooms)
				.set({
					lockedByDefault,
					chatEnabledByDefault,
					presetHostPasswordHash,
					modified: new Date().toISOString(),
				})
				.where(eq(Rooms.id, name))
		} else {
			await db.insert(Rooms).values({
				id: name,
				lockedByDefault,
				chatEnabledByDefault,
				presetHostPasswordHash,
				reservedBy: 'admin',
			})
		}
		return json({ ok: true })
	}

	return json({ error: 'Ukendt handling.' }, { status: 400 })
}

export default function AdminDashboard() {
	const { rooms, meetings, hasDb } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-3xl space-y-10 p-6 text-zinc-800">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-[#0b565b]">Admin</h1>
				<Form method="post" action="/admin/logout">
					<Button type="submit" displayType="secondary" className="text-xs">
						Log ud
					</Button>
				</Form>
			</div>

			{!hasDb && (
				<div className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-600">
					Ingen database er konfigureret — rum-konfiguration og mødelister er
					tomme, indtil en D1-database er koblet på.
				</div>
			)}

			<section className="space-y-4">
				<h2 className="text-lg font-bold">Konfigurér rum</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="intent" value="reserve" />
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="name">Rumnavn</Label>
						<Input id="name" name="name" required />
					</div>
					<div className="flex items-center gap-2">
						<Checkbox id="lockedByDefault" name="lockedByDefault" />
						<Label htmlFor="lockedByDefault">Låst fra start</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="chatEnabledByDefault"
							name="chatEnabledByDefault"
							defaultChecked
						/>
						<Label htmlFor="chatEnabledByDefault">Chat slået til fra start</Label>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="password">Vært-adgangskode (valgfri)</Label>
						<Input id="password" name="password" type="password" />
					</div>
					<Button type="submit" className="sm:col-span-2">
						Gem
					</Button>
				</Form>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Konfigurerede rum</h2>
				{rooms.length === 0 && (
					<p className="text-sm text-zinc-500">Ingen rum er konfigureret endnu.</p>
				)}
				<ul className="space-y-2">
					{rooms.map((room) => (
						<li
							key={room.id}
							className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm"
						>
							<div>
								<p className="font-medium">{room.id}</p>
								<p className="text-zinc-500">
									{room.lockedByDefault ? 'Låst fra start' : 'Åbent fra start'} ·{' '}
									{room.chatEnabledByDefault ? 'Chat til' : 'Chat fra'}
									{room.presetHostPasswordHash ? ' · adgangskode sat' : ''}
								</p>
							</div>
							<Form method="post">
								<input type="hidden" name="intent" value="delete" />
								<input type="hidden" name="roomId" value={room.id} />
								<Button
									type="submit"
									displayType="danger"
									className="text-xs"
								>
									Slet
								</Button>
							</Form>
						</li>
					))}
				</ul>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Møder</h2>
				{meetings.length === 0 && (
					<p className="text-sm text-zinc-500">Ingen møder endnu.</p>
				)}
				<ul className="space-y-2">
					{meetings.map((meeting) => (
						<li
							key={meeting.id}
							className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm"
						>
							<div>
								<p className="font-medium">{meeting.id}</p>
								<p className="text-zinc-500">
									{meeting.ended ? 'Afsluttet' : 'Aktivt'} · {meeting.peakUserCount}{' '}
									deltagere på det højeste
								</p>
							</div>
							{!meeting.ended && meeting.roomName && (
								<Link
									to={`/admin/rooms/${meeting.roomName}`}
									className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
								>
									Styr live
								</Link>
							)}
						</li>
					))}
				</ul>
			</section>

			<Disclaimer />
		</div>
	)
}
