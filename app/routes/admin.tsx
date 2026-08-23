import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { desc, eq } from 'drizzle-orm'
import { getDb, Meetings, Rooms, Users } from 'schema'
import invariant from 'tiny-invariant'
import { requireAdmin } from '~/adminSession.server'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { hashPassword } from '~/utils/hashPassword.server'
import { sendSetPasswordEmail } from '~/utils/sendEmail.server'

const roleLabels = {
	admin: 'Admin',
	moderator: 'Ordstyrer',
	user: 'Bruger',
} as const

function generateInviteToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32))
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

const INVITE_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	await requireAdmin(request)
	const db = getDb(context)

	const rooms = db
		? await db.select().from(Rooms).orderBy(desc(Rooms.created))
		: []
	const meetings = db
		? await db.select().from(Meetings).orderBy(desc(Meetings.created)).limit(50)
		: []
	const users = db
		? await db.select().from(Users).orderBy(desc(Users.created))
		: []

	return json({ rooms, meetings, users, hasDb: Boolean(db) })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	await requireAdmin(request)
	const db = getDb(context)
	if (!db) {
		return json({ error: 'Ingen database er konfigureret.' }, { status: 400 })
	}

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'deleteRoom') {
		const roomId = formData.get('roomId')
		invariant(typeof roomId === 'string')
		await db.delete(Rooms).where(eq(Rooms.id, roomId))
		return json({ ok: true })
	}

	if (intent === 'createUser') {
		const rawUsername = formData.get('username')
		const email = formData.get('email')
		const role = formData.get('role')
		invariant(typeof rawUsername === 'string')
		invariant(typeof email === 'string')
		invariant(role === 'admin' || role === 'moderator' || role === 'user')

		const username = rawUsername.trim()
		if (username.length < 4) {
			return json(
				{ error: 'Brugernavn skal være mindst 4 tegn.' },
				{ status: 400 }
			)
		}

		const [existing] = await db
			.select()
			.from(Users)
			.where(eq(Users.username, username))
		if (existing) {
			return json(
				{ error: 'Brugernavnet er allerede i brug.' },
				{ status: 400 }
			)
		}

		const rawToken = generateInviteToken()
		const inviteTokenHash = await hashPassword(rawToken)

		await db.insert(Users).values({
			username,
			email: email.trim(),
			role,
			inviteTokenHash,
			inviteTokenExpires: Date.now() + INVITE_TOKEN_LIFETIME_MS,
		})

		const setPasswordUrl = `${new URL(request.url).origin}/set-password?token=${rawToken}`
		const emailSent = await sendSetPasswordEmail(context.env, {
			to: email.trim(),
			username,
			setPasswordUrl,
		})

		return json({
			ok: true,
			setPasswordUrl: emailSent ? undefined : setPasswordUrl,
		})
	}

	if (intent === 'resendInvite') {
		const username = formData.get('username')
		invariant(typeof username === 'string')

		const rawToken = generateInviteToken()
		const inviteTokenHash = await hashPassword(rawToken)
		await db
			.update(Users)
			.set({
				inviteTokenHash,
				inviteTokenExpires: Date.now() + INVITE_TOKEN_LIFETIME_MS,
			})
			.where(eq(Users.username, username))

		const [user] = await db
			.select()
			.from(Users)
			.where(eq(Users.username, username))
		const setPasswordUrl = `${new URL(request.url).origin}/set-password?token=${rawToken}`
		const emailSent = user
			? await sendSetPasswordEmail(context.env, {
					to: user.email,
					username,
					setPasswordUrl,
				})
			: false

		return json({
			ok: true,
			setPasswordUrl: emailSent ? undefined : setPasswordUrl,
		})
	}

	if (intent === 'deleteUser') {
		const username = formData.get('username')
		invariant(typeof username === 'string')
		await db.delete(Users).where(eq(Users.username, username))
		return json({ ok: true })
	}

	if (intent === 'reserve') {
		const rawName = formData.get('name')
		invariant(typeof rawName === 'string')
		const name = rawName.trim().replace(/ /g, '-')
		if (!name)
			return json({ error: 'Rummet skal have et navn.' }, { status: 400 })

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
	const { rooms, meetings, users, hasDb } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const setPasswordUrl =
		actionData && 'setPasswordUrl' in actionData
			? (actionData.setPasswordUrl as string | undefined)
			: undefined
	const actionError =
		actionData && 'error' in actionData ? actionData.error : undefined

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

			{actionError && (
				<div className="rounded-md bg-red-100 p-3 text-sm text-red-800">
					{actionError}
				</div>
			)}
			{setPasswordUrl && (
				<div className="space-y-1 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
					<p>Kunne ikke sende e-mail — send dette link manuelt:</p>
					<p className="break-all font-mono text-xs">{setPasswordUrl}</p>
				</div>
			)}

			<section className="space-y-4">
				<h2 className="text-lg font-bold">Opret bruger</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2">
					<input type="hidden" name="intent" value="createUser" />
					<div className="space-y-2">
						<Label htmlFor="username">Brugernavn</Label>
						<Input id="username" name="username" required minLength={4} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">E-mail</Label>
						<Input id="email" name="email" type="email" required />
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="role">Rolle</Label>
						<select
							id="role"
							name="role"
							aria-label="Rolle"
							defaultValue="user"
							className="w-full rounded border-2 border-zinc-500 bg-zinc-50 px-2 py-1 dark:bg-zinc-700"
						>
							<option value="user">Bruger</option>
							<option value="moderator">Ordstyrer</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<Button type="submit" className="sm:col-span-2">
						Opret og send invitation
					</Button>
				</Form>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Brugere</h2>
				{users.length === 0 && (
					<p className="text-sm text-zinc-500">
						Ingen brugere er oprettet endnu.
					</p>
				)}
				<ul className="space-y-2">
					{users.map((user) => (
						<li
							key={user.username}
							className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm"
						>
							<div>
								<p className="font-medium">
									{user.username} · {roleLabels[user.role]}
								</p>
								<p className="text-zinc-500">
									{user.email} ·{' '}
									{user.passwordHash ? 'Aktiv' : 'Afventer aktivering'}
								</p>
							</div>
							<div className="flex gap-2">
								{!user.passwordHash && (
									<Form method="post">
										<input type="hidden" name="intent" value="resendInvite" />
										<input
											type="hidden"
											name="username"
											value={user.username}
										/>
										<Button
											type="submit"
											displayType="secondary"
											className="text-xs"
										>
											Send igen
										</Button>
									</Form>
								)}
								<Form method="post">
									<input type="hidden" name="intent" value="deleteUser" />
									<input type="hidden" name="username" value={user.username} />
									<Button
										type="submit"
										displayType="danger"
										className="text-xs"
									>
										Slet
									</Button>
								</Form>
							</div>
						</li>
					))}
				</ul>
			</section>

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
						<Label htmlFor="chatEnabledByDefault">
							Chat slået til fra start
						</Label>
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
					<p className="text-sm text-zinc-500">
						Ingen rum er konfigureret endnu.
					</p>
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
									{room.lockedByDefault ? 'Låst fra start' : 'Åbent fra start'}{' '}
									· {room.chatEnabledByDefault ? 'Chat til' : 'Chat fra'}
									{room.presetHostPasswordHash ? ' · adgangskode sat' : ''}
								</p>
							</div>
							<Form method="post">
								<input type="hidden" name="intent" value="deleteRoom" />
								<input type="hidden" name="roomId" value={room.id} />
								<Button type="submit" displayType="danger" className="text-xs">
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
									{meeting.ended ? 'Afsluttet' : 'Aktivt'} ·{' '}
									{meeting.peakUserCount} deltagere på det højeste
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
