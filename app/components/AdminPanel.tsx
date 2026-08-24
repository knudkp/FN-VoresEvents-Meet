import { Link } from '@remix-run/react'
import type { ElementType } from 'react'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Label } from './Label'
import { cn } from '~/utils/style'

// Bare ElementType (no prop generic): Remix's `Form` and a fetcher's `.Form`
// have subtly incompatible prop types, so a precisely-typed variant fails
// structural assignability between the two.
export type AdminFormComponent = ElementType

export type UserRow = {
	username: string
	email: string
	role: 'admin' | 'moderator' | 'user'
	passwordHash: string | null
}

export type RoomRow = {
	id: string
	lockedByDefault: boolean
	chatEnabledByDefault: boolean
	presetHostPasswordHash: string | null
}

export type MeetingRow = {
	id: string
	ended: string | null
	roomName: string | null
	peakUserCount: number
}

export type AuditLogRow = {
	id: number
	created: string
	action: string
	actorName: string
	targetName: string | null
}

export type AdminData = {
	rooms: RoomRow[]
	meetings: MeetingRow[]
	users: UserRow[]
	auditLog: AuditLogRow[]
	hasDb: boolean
}

export type AdminActionData =
	| { error: string }
	| { ok: boolean; setPasswordUrl?: string }
	| undefined

export const ADMIN_TAB_GROUPS = [
	{
		label: 'Administration',
		items: [
			{ id: 'users', label: 'Brugere', formId: 'admin-users-form' },
			{ id: 'rooms', label: 'Rum', formId: 'admin-rooms-form' },
		],
	},
	{
		label: 'Overblik',
		items: [
			{ id: 'meetings', label: 'Møder', formId: undefined },
			{ id: 'auditLog', label: 'System log', formId: undefined },
		],
	},
] as const

export type AdminTabId =
	(typeof ADMIN_TAB_GROUPS)[number]['items'][number]['id']

export function adminTabFormId(tab: AdminTabId): string | undefined {
	for (const group of ADMIN_TAB_GROUPS) {
		const item = group.items.find((i) => i.id === tab)
		if (item) return item.formId
	}
	return undefined
}

const roleLabels = {
	admin: 'Admin',
	moderator: 'Ordstyrer',
	user: 'Bruger',
} as const

const actionLabels: Record<string, string> = {
	lockRoom: 'Låste rummet',
	unlockRoom: 'Låste rummet op',
	enableChat: 'Slog chat til',
	disableChat: 'Slog chat fra',
	muteAll: 'Mutede alle deltagere',
	kickUser: 'Fjernede en deltager',
	createUser: 'Oprettede bruger',
	deleteUser: 'Slettede bruger',
	deleteRoom: 'Slettede rum',
	resendInvite: 'Gensendte invitation',
	configureRoom: 'Gemte rum-indstillinger',
}

function formatLogDate(created: string): string {
	try {
		return new Date(created.replace(' ', 'T') + 'Z').toLocaleString('da-DK')
	} catch {
		return created
	}
}

export function AdminNav({
	activeTab,
	onTabChange,
}: {
	activeTab: AdminTabId
	onTabChange: (tab: AdminTabId) => void
}) {
	return (
		<nav className="w-48 shrink-0 space-y-6 overflow-y-auto bg-yellow-50 p-4 dark:bg-yellow-950/30">
			{ADMIN_TAB_GROUPS.map((group) => (
				<div key={group.label} className="space-y-1">
					<p className="px-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
						{group.label}
					</p>
					{group.items.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => onTabChange(item.id)}
							className={cn(
								'block w-full rounded-md px-2 py-1.5 text-left text-sm',
								item.id === activeTab
									? 'bg-[#0d6d72] font-medium text-white'
									: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
							)}
						>
							{item.label}
						</button>
					))}
				</div>
			))}
		</nav>
	)
}

interface AdminPanelProps {
	data: AdminData
	actionData: AdminActionData
	activeTab: AdminTabId
	FormComponent: AdminFormComponent
}

export function AdminPanelSections({
	data,
	actionData,
	activeTab,
	FormComponent: Form,
}: AdminPanelProps) {
	const { rooms, meetings, users, auditLog, hasDb } = data
	const setPasswordUrl =
		actionData && 'setPasswordUrl' in actionData
			? actionData.setPasswordUrl
			: undefined
	const actionError =
		actionData && 'error' in actionData ? actionData.error : undefined

	return (
		<div className="space-y-6">
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

			{activeTab === 'users' && (
				<div className="space-y-8">
					<section className="space-y-4">
						<h2 className="text-lg font-bold">Opret bruger</h2>
						<Form
							method="post"
							action="/admin"
							id="admin-users-form"
							className="grid gap-3 sm:grid-cols-2"
						>
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
											<Form method="post" action="/admin">
												<input
													type="hidden"
													name="intent"
													value="resendInvite"
												/>
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
										<Form method="post" action="/admin">
											<input type="hidden" name="intent" value="deleteUser" />
											<input
												type="hidden"
												name="username"
												value={user.username}
											/>
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
				</div>
			)}

			{activeTab === 'rooms' && (
				<div className="space-y-8">
					<section className="space-y-4">
						<h2 className="text-lg font-bold">Konfigurér rum</h2>
						<Form
							method="post"
							action="/admin"
							id="admin-rooms-form"
							className="grid gap-3 sm:grid-cols-2"
						>
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
											{room.lockedByDefault
												? 'Låst fra start'
												: 'Åbent fra start'}{' '}
											· {room.chatEnabledByDefault ? 'Chat til' : 'Chat fra'}
											{room.presetHostPasswordHash ? ' · adgangskode sat' : ''}
										</p>
									</div>
									<Form method="post" action="/admin">
										<input type="hidden" name="intent" value="deleteRoom" />
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
				</div>
			)}

			{activeTab === 'meetings' && (
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
			)}

			{activeTab === 'auditLog' && (
				<section className="space-y-3">
					<h2 className="text-lg font-bold">System log</h2>
					{auditLog.length === 0 && (
						<p className="text-sm text-zinc-500">
							Ingen hændelser er logget endnu.
						</p>
					)}
					<ul className="space-y-2">
						{auditLog.map((entry) => (
							<li
								key={entry.id}
								className="rounded-md border border-zinc-200 p-3 text-sm"
							>
								<p className="font-medium">
									{actionLabels[entry.action] ?? entry.action}
									{entry.targetName ? ` · ${entry.targetName}` : ''}
								</p>
								<p className="text-zinc-500">
									{entry.actorName} · {formatLogDate(entry.created)}
								</p>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}
