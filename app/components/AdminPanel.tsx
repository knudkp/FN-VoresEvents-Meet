import { Link } from '@remix-run/react'
import type { ElementType } from 'react'
import { useMemo, useState } from 'react'
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
	created: string
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

export type BannedIpRow = {
	ip: string
	created: string
	reason: string | null
	bannedBy: string
}

export type BannedUsernameRow = {
	username: string
	created: string
	reason: string | null
	bannedBy: string
}

export type AdminData = {
	rooms: RoomRow[]
	meetings: MeetingRow[]
	users: UserRow[]
	auditLog: AuditLogRow[]
	bannedIps: BannedIpRow[]
	bannedUsernames: BannedUsernameRow[]
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
			{ id: 'banned', label: 'Bannede', formId: undefined },
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
	banIp: 'Bandt en IP-adresse',
	banUsername: 'Bandt en deltager',
	createUser: 'Oprettede bruger',
	updateUser: 'Redigerede bruger',
	deleteUser: 'Slettede bruger',
	deleteRoom: 'Slettede rum',
	deleteMeeting: 'Slettede møde',
	resendInvite: 'Gensendte invitation',
	configureRoom: 'Gemte rum-indstillinger',
	unbanIp: 'Ophævede IP-ban',
	unbanUsername: 'Ophævede brugerban',
}

function parseSqliteDate(value: string): Date {
	return new Date(value.replace(' ', 'T') + 'Z')
}

function formatLogDate(created: string): string {
	try {
		return parseSqliteDate(created).toLocaleString('da-DK')
	} catch {
		return created
	}
}

const cardClassName =
	'rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50'
const cardRowClassName = cn(
	cardClassName,
	'flex items-center justify-between gap-3'
)
const formPanelClassName =
	'grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:grid-cols-2'

export function AdminNav({
	activeTab,
	onTabChange,
}: {
	activeTab: AdminTabId
	onTabChange: (tab: AdminTabId) => void
}) {
	return (
		<nav className="h-full w-48 shrink-0 space-y-6 overflow-y-auto border-r border-black/20 bg-[#0b1d3a] p-4">
			{ADMIN_TAB_GROUPS.map((group) => (
				<div key={group.label} className="space-y-1">
					<p className="px-2 text-xs font-bold uppercase tracking-wide text-blue-300/70">
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
									: 'text-blue-100 hover:bg-white/10'
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

function UserListItem({
	user,
	FormComponent: Form,
}: {
	user: UserRow
	FormComponent: AdminFormComponent
}) {
	const [isEditing, setIsEditing] = useState(false)

	if (isEditing) {
		return (
			<li className={cardClassName}>
				<Form
					method="post"
					action="/admin"
					className="grid gap-3 sm:grid-cols-2"
					onSubmit={() => setIsEditing(false)}
				>
					<input type="hidden" name="intent" value="updateUser" />
					<input type="hidden" name="username" value={user.username} />
					<p className="font-medium sm:col-span-2">{user.username}</p>
					<div className="space-y-2">
						<Label htmlFor={`email-${user.username}`}>E-mail</Label>
						<Input
							id={`email-${user.username}`}
							name="email"
							type="email"
							defaultValue={user.email}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`role-${user.username}`}>Rolle</Label>
						<select
							id={`role-${user.username}`}
							name="role"
							aria-label="Rolle"
							defaultValue={user.role}
							className="w-full rounded border-2 border-zinc-500 bg-zinc-100 px-2 py-1 dark:bg-zinc-700"
						>
							<option value="user">Bruger</option>
							<option value="moderator">Ordstyrer</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<div className="flex gap-2 sm:col-span-2">
						<Button type="submit" className="text-xs">
							Gem
						</Button>
						<Button
							type="button"
							displayType="secondary"
							className="text-xs"
							onClick={() => setIsEditing(false)}
						>
							Annullér
						</Button>
					</div>
				</Form>
			</li>
		)
	}

	return (
		<li className={cardRowClassName}>
			<div>
				<p className="font-medium">
					{user.username} · {roleLabels[user.role]}
				</p>
				<p className="text-zinc-500">
					{user.email} · {user.passwordHash ? 'Aktiv' : 'Afventer aktivering'}
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					type="button"
					displayType="secondary"
					className="text-xs"
					onClick={() => setIsEditing(true)}
				>
					Rediger
				</Button>
				{!user.passwordHash && (
					<Form method="post" action="/admin">
						<input type="hidden" name="intent" value="resendInvite" />
						<input type="hidden" name="username" value={user.username} />
						<Button type="submit" displayType="secondary" className="text-xs">
							Send igen
						</Button>
					</Form>
				)}
				<Form method="post" action="/admin">
					<input type="hidden" name="intent" value="deleteUser" />
					<input type="hidden" name="username" value={user.username} />
					<Button type="submit" displayType="danger" className="text-xs">
						Slet
					</Button>
				</Form>
			</div>
		</li>
	)
}

type MeetingViewMode = 'agenda' | 'day' | 'workweek' | 'month' | 'year'

const MEETING_VIEW_MODES: { id: MeetingViewMode; label: string }[] = [
	{ id: 'agenda', label: 'Agenda' },
	{ id: 'day', label: 'Dag' },
	{ id: 'workweek', label: 'Arbejdsuge' },
	{ id: 'month', label: 'Måned' },
	{ id: 'year', label: 'År' },
]

function startOfDay(date: Date): Date {
	const copy = new Date(date)
	copy.setHours(0, 0, 0, 0)
	return copy
}

function addDays(date: Date, days: number): Date {
	const copy = new Date(date)
	copy.setDate(copy.getDate() + days)
	return copy
}

function startOfWorkWeek(date: Date): Date {
	const day = date.getDay()
	const diffToMonday = day === 0 ? -6 : 1 - day
	return startOfDay(addDays(date, diffToMonday))
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	)
}

function meetingMatchesPeriod(
	meeting: MeetingRow,
	mode: MeetingViewMode,
	refDate: Date
): boolean {
	if (mode === 'agenda') return true
	const created = parseSqliteDate(meeting.created)
	if (mode === 'day') return isSameDay(created, refDate)
	if (mode === 'workweek') {
		const start = startOfWorkWeek(refDate)
		const end = addDays(start, 5)
		return created >= start && created < end
	}
	if (mode === 'month') {
		return (
			created.getFullYear() === refDate.getFullYear() &&
			created.getMonth() === refDate.getMonth()
		)
	}
	return created.getFullYear() === refDate.getFullYear()
}

function meetingPeriodLabel(mode: MeetingViewMode, refDate: Date): string {
	if (mode === 'day') {
		return refDate.toLocaleDateString('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		})
	}
	if (mode === 'workweek') {
		const start = startOfWorkWeek(refDate)
		const end = addDays(start, 4)
		const startLabel = start.toLocaleDateString('da-DK', {
			day: 'numeric',
			month: 'short',
		})
		const endLabel = end.toLocaleDateString('da-DK', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		})
		return `${startLabel} – ${endLabel}`
	}
	if (mode === 'month') {
		return refDate.toLocaleDateString('da-DK', {
			month: 'long',
			year: 'numeric',
		})
	}
	if (mode === 'year') return String(refDate.getFullYear())
	return 'Alle møder'
}

function shiftMeetingRefDate(
	mode: MeetingViewMode,
	refDate: Date,
	direction: 1 | -1
): Date {
	if (mode === 'day') return addDays(refDate, direction)
	if (mode === 'workweek') return addDays(refDate, direction * 7)
	if (mode === 'month') {
		const copy = new Date(refDate)
		copy.setMonth(copy.getMonth() + direction)
		return copy
	}
	if (mode === 'year') {
		const copy = new Date(refDate)
		copy.setFullYear(copy.getFullYear() + direction)
		return copy
	}
	return refDate
}

function MeetingsSection({
	meetings,
	FormComponent: Form,
}: {
	meetings: MeetingRow[]
	FormComponent: AdminFormComponent
}) {
	const [viewMode, setViewMode] = useState<MeetingViewMode>('agenda')
	const [refDate, setRefDate] = useState(() => new Date())

	const visibleMeetings = useMemo(
		() => meetings.filter((m) => meetingMatchesPeriod(m, viewMode, refDate)),
		[meetings, viewMode, refDate]
	)

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-bold">Møder</h2>
				<div className="flex gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
					{MEETING_VIEW_MODES.map((mode) => (
						<button
							key={mode.id}
							type="button"
							onClick={() => setViewMode(mode.id)}
							className={cn(
								'rounded px-2.5 py-1 text-xs font-medium',
								mode.id === viewMode
									? 'bg-white text-[#0b565b] shadow-sm dark:bg-zinc-700 dark:text-white'
									: 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
							)}
						>
							{mode.label}
						</button>
					))}
				</div>
			</div>

			{viewMode !== 'agenda' && (
				<div className="flex items-center justify-center gap-4">
					<button
						type="button"
						onClick={() =>
							setRefDate((d) => shiftMeetingRefDate(viewMode, d, -1))
						}
						className="rounded-full px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
						aria-label="Forrige periode"
					>
						‹
					</button>
					<p className="min-w-[14rem] text-center text-sm font-medium capitalize">
						{meetingPeriodLabel(viewMode, refDate)}
					</p>
					<button
						type="button"
						onClick={() =>
							setRefDate((d) => shiftMeetingRefDate(viewMode, d, 1))
						}
						className="rounded-full px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
						aria-label="Næste periode"
					>
						›
					</button>
				</div>
			)}

			{visibleMeetings.length === 0 && (
				<p className="text-sm text-zinc-500">
					{meetings.length === 0
						? 'Ingen møder endnu.'
						: 'Ingen møder i denne periode.'}
				</p>
			)}
			<ul className="space-y-2">
				{visibleMeetings.map((meeting) => (
					<li key={meeting.id} className={cardRowClassName}>
						<div>
							<p className="font-medium">{meeting.roomName ?? meeting.id}</p>
							<p className="flex items-center gap-2 text-zinc-500">
								<span
									className={cn(
										'inline-block rounded-full px-1.5 py-0.5 text-xs font-medium',
										meeting.ended
											? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
											: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
									)}
								>
									{meeting.ended ? 'Afsluttet' : 'Aktivt'}
								</span>
								{formatLogDate(meeting.created)} ·{' '}
								{meeting.peakUserCount} deltagere på det højeste
							</p>
						</div>
						<div className="flex items-center gap-3">
							{!meeting.ended && meeting.roomName && (
								<Link
									to={`/admin/rooms/${meeting.roomName}`}
									className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
								>
									Styr live
								</Link>
							)}
							<Form method="post" action="/admin">
								<input type="hidden" name="intent" value="deleteMeeting" />
								<input type="hidden" name="meetingId" value={meeting.id} />
								<Button type="submit" displayType="danger" className="text-xs">
									Slet
								</Button>
							</Form>
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}

function BannedSection({
	bannedIps,
	bannedUsernames,
	FormComponent: Form,
}: {
	bannedIps: BannedIpRow[]
	bannedUsernames: BannedUsernameRow[]
	FormComponent: AdminFormComponent
}) {
	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<h2 className="text-lg font-bold">Bannede IP-adresser</h2>
				{bannedIps.length === 0 && (
					<p className="text-sm text-zinc-500">
						Ingen IP-adresser er bandlyst. Ban en deltager fra "Styr live" på
						et aktivt møde.
					</p>
				)}
				<ul className="space-y-2">
					{bannedIps.map((ban) => (
						<li key={ban.ip} className={cardRowClassName}>
							<div>
								<p className="font-mono font-medium">{ban.ip}</p>
								<p className="text-zinc-500">
									Bandt af {ban.bannedBy} · {formatLogDate(ban.created)}
								</p>
							</div>
							<Form method="post" action="/admin">
								<input type="hidden" name="intent" value="unbanIp" />
								<input type="hidden" name="ip" value={ban.ip} />
								<Button
									type="submit"
									displayType="secondary"
									className="text-xs"
								>
									Ophæv
								</Button>
							</Form>
						</li>
					))}
				</ul>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-bold">Bandlyste deltagernavne</h2>
				{bannedUsernames.length === 0 && (
					<p className="text-sm text-zinc-500">
						Ingen deltagernavne er bandlyst.
					</p>
				)}
				<ul className="space-y-2">
					{bannedUsernames.map((ban) => (
						<li key={ban.username} className={cardRowClassName}>
							<div>
								<p className="font-medium">{ban.username}</p>
								<p className="text-zinc-500">
									Bandt af {ban.bannedBy} · {formatLogDate(ban.created)}
								</p>
							</div>
							<Form method="post" action="/admin">
								<input type="hidden" name="intent" value="unbanUsername" />
								<input type="hidden" name="username" value={ban.username} />
								<Button
									type="submit"
									displayType="secondary"
									className="text-xs"
								>
									Ophæv
								</Button>
							</Form>
						</li>
					))}
				</ul>
			</section>
		</div>
	)
}

export function AdminPanelSections({
	data,
	actionData,
	activeTab,
	FormComponent: Form,
}: AdminPanelProps) {
	const { rooms, meetings, users, auditLog, bannedIps, bannedUsernames, hasDb } =
		data
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
							className={formPanelClassName}
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
									className="w-full rounded border-2 border-zinc-500 bg-zinc-100 px-2 py-1 dark:bg-zinc-700"
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
								<UserListItem
									key={user.username}
									user={user}
									FormComponent={Form}
								/>
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
							className={formPanelClassName}
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
								<li key={room.id} className={cardRowClassName}>
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

			{activeTab === 'banned' && (
				<BannedSection
					bannedIps={bannedIps}
					bannedUsernames={bannedUsernames}
					FormComponent={Form}
				/>
			)}

			{activeTab === 'meetings' && (
				<MeetingsSection meetings={meetings} FormComponent={Form} />
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
							<li key={entry.id} className={cardClassName}>
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
