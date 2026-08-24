import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, useActionData, useLoaderData, useSearchParams } from '@remix-run/react'
import { desc, eq } from 'drizzle-orm'
import {
	AdminAuditLog,
	BannedIps,
	BannedUsernames,
	getDb,
	Meetings,
	Rooms,
	Users,
} from 'schema'
import invariant from 'tiny-invariant'
import { requireAdmin } from '~/adminSession.server'
import {
	AdminNav,
	AdminPanelSections,
	type AdminTabId,
} from '~/components/AdminPanel'
import { Button } from '~/components/Button'
import { Disclaimer } from '~/components/Disclaimer'
import { hashPassword } from '~/utils/hashPassword.server'
import getUsername from '~/utils/getUsername.server'
import { sendSetPasswordEmail } from '~/utils/sendEmail.server'

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
	const auditLog = db
		? await db
				.select()
				.from(AdminAuditLog)
				.orderBy(desc(AdminAuditLog.created))
				.limit(100)
		: []
	const bannedIps = db
		? await db.select().from(BannedIps).orderBy(desc(BannedIps.created))
		: []
	const bannedUsernames = db
		? await db
				.select()
				.from(BannedUsernames)
				.orderBy(desc(BannedUsernames.created))
		: []

	return json({
		rooms,
		meetings,
		users,
		auditLog,
		bannedIps,
		bannedUsernames,
		hasDb: Boolean(db),
	})
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
	await requireAdmin(request)
	const db = getDb(context)
	if (!db) {
		return json({ error: 'Ingen database er konfigureret.' }, { status: 400 })
	}

	const actorName = (await getUsername(request)) ?? 'Admin'

	async function logAction(
		action: string,
		targetId?: string,
		targetName?: string
	) {
		invariant(db)
		await db.insert(AdminAuditLog).values({
			action,
			actorId: actorName,
			actorName,
			targetId,
			targetName,
		})
	}

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'deleteRoom') {
		const roomId = formData.get('roomId')
		invariant(typeof roomId === 'string')
		await db.delete(Rooms).where(eq(Rooms.id, roomId))
		await logAction('deleteRoom', roomId, roomId)
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
		await logAction('createUser', username, username)

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
		await logAction('resendInvite', username, username)

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

	if (intent === 'updateUser') {
		const username = formData.get('username')
		const email = formData.get('email')
		const role = formData.get('role')
		invariant(typeof username === 'string')
		invariant(typeof email === 'string')
		invariant(role === 'admin' || role === 'moderator' || role === 'user')

		const trimmedEmail = email.trim()
		if (!trimmedEmail) {
			return json({ error: 'E-mail må ikke være tom.' }, { status: 400 })
		}

		await db
			.update(Users)
			.set({ email: trimmedEmail, role, modified: new Date().toISOString() })
			.where(eq(Users.username, username))
		await logAction('updateUser', username, username)
		return json({ ok: true })
	}

	if (intent === 'deleteUser') {
		const username = formData.get('username')
		invariant(typeof username === 'string')
		await db.delete(Users).where(eq(Users.username, username))
		await logAction('deleteUser', username, username)
		return json({ ok: true })
	}

	if (intent === 'deleteMeeting') {
		const meetingId = formData.get('meetingId')
		invariant(typeof meetingId === 'string')
		await db.delete(Meetings).where(eq(Meetings.id, meetingId))
		await logAction('deleteMeeting', meetingId, meetingId)
		return json({ ok: true })
	}

	if (intent === 'unbanIp') {
		const ip = formData.get('ip')
		invariant(typeof ip === 'string')
		await db.delete(BannedIps).where(eq(BannedIps.ip, ip))
		await logAction('unbanIp', ip, ip)
		return json({ ok: true })
	}

	if (intent === 'unbanUsername') {
		const username = formData.get('username')
		invariant(typeof username === 'string')
		await db.delete(BannedUsernames).where(eq(BannedUsernames.username, username))
		await logAction('unbanUsername', username, username)
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
		await logAction('configureRoom', name, name)
		return json({ ok: true })
	}

	return json({ error: 'Ukendt handling.' }, { status: 400 })
}

const isAdminTabId = (value: string | null): value is AdminTabId =>
	value === 'users' ||
	value === 'rooms' ||
	value === 'banned' ||
	value === 'meetings' ||
	value === 'auditLog'

export default function AdminDashboard() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const [searchParams, setSearchParams] = useSearchParams()
	const requestedTab = searchParams.get('tab')
	const activeTab: AdminTabId = isAdminTabId(requestedTab)
		? requestedTab
		: 'users'

	return (
		<div className="mx-auto flex h-full max-w-6xl flex-col text-zinc-800">
			<div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
				<h1 className="text-2xl font-bold text-[#0b565b]">Admin</h1>
				<Form method="post" action="/admin/logout">
					<Button type="submit" displayType="secondary" className="text-xs">
						Log ud
					</Button>
				</Form>
			</div>
			<div className="flex min-h-0 flex-1">
				<AdminNav
					activeTab={activeTab}
					onTabChange={(tab) => setSearchParams({ tab })}
				/>
				<div className="flex-1 overflow-y-auto p-6">
					<AdminPanelSections
						data={data}
						actionData={actionData}
						activeTab={activeTab}
						FormComponent={Form}
					/>
					<Disclaimer />
				</div>
			</div>
		</div>
	)
}
