import { Link } from '@remix-run/react'
import type { ElementType } from 'react'
import { useMemo, useState } from 'react'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Label } from './Label'
import { Tooltip } from './Tooltip'
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
			{ id: 'users', label: 'Brugere' },
			{ id: 'rooms', label: 'Rum' },
			{ id: 'banned', label: 'Bannede' },
		],
	},
	{
		label: 'Overblik',
		items: [
			{ id: 'meetings', label: 'Møder' },
			{ id: 'auditLog', label: 'System log' },
		],
	},
] as const

export type AdminTabId =
	(typeof ADMIN_TAB_GROUPS)[number]['items'][number]['id']

const roleLabels = {
	admin: 'Admin',
	moderator: 'Ordstyrer',
	user: 'Bruger',
} as const

const roleBadgeClassName: Record<UserRow['role'], string> = {
	admin: 'bg-[#0d6d72]/10 text-[#0b565b] dark:bg-[#0d6d72]/20 dark:text-teal-300',
	moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
	user: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

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
	hostClaimed: 'Blev vært for mødet',
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

// Row-level actions (Rediger, Slet, Ban IP, Ophæv, ...) reuse the shared
// Button for its color semantics (secondary/danger), but override its
// bold/uppercase CTA look — right for a handful of hero buttons, too
// heavy repeated a dozen times per screen in a dense admin table.
const rowButtonClassName =
	'rounded-md border px-3 py-1.5 text-xs font-medium normal-case tracking-normal'

const formPanelClassName =
	'grid max-w-2xl gap-x-6 gap-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50 sm:grid-cols-2'
const formSubmitButtonClassName =
	'w-full border-2 normal-case tracking-normal sm:w-auto'

const sectionHeadingClassName = 'text-base font-semibold text-zinc-900 dark:text-zinc-50'
const sectionSubtextClassName = 'text-sm text-zinc-500 dark:text-zinc-400'
const emptyStateClassName =
	'rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'

const tableWrapperClassName =
	'overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700'
const tableClassName = 'w-full min-w-[36rem] text-left text-sm'
const theadClassName =
	'bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
const thClassName = 'border-b border-zinc-300 px-4 py-2.5 dark:border-zinc-700'
const tdClassName = 'px-4 py-3 align-top'
const trClassName =
	'divide-y divide-zinc-300 bg-white dark:divide-zinc-700 dark:bg-zinc-900/40 [&>tr]:transition-colors hover:[&>tr]:bg-zinc-50 dark:hover:[&>tr]:bg-zinc-800/40'

function SectionHeader({
	title,
	subtitle,
}: {
	title: string
	subtitle?: string
}) {
	return (
		<div className="space-y-1">
			<h2 className={sectionHeadingClassName}>{title}</h2>
			{subtitle && <p className={sectionSubtextClassName}>{subtitle}</p>}
		</div>
	)
}

export function AdminNav({
	activeTab,
	onTabChange,
}: {
	activeTab: AdminTabId
	onTabChange: (tab: AdminTabId) => void
}) {
	return (
		<nav className="h-full w-52 shrink-0 space-y-7 overflow-y-auto border-r border-black/20 bg-[#0b1d3a] p-5">
			{ADMIN_TAB_GROUPS.map((group) => (
				<div key={group.label}>
					<p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-blue-300/80">
						{group.label}
					</p>
					<div className="space-y-0.5">
						{group.items.map((item) => (
							<Tooltip key={item.id} content={`Gå til ${item.label}`}>
								<button
									type="button"
									onClick={() => onTabChange(item.id)}
									aria-label={`Gå til ${item.label}`}
									className={cn(
										'block w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
										item.id === activeTab
											? 'bg-[#0d6d72] font-medium text-white shadow-sm'
											: 'text-blue-100/90 hover:bg-white/10 hover:text-white'
									)}
								>
									{item.label}
								</button>
							</Tooltip>
						))}
					</div>
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

function UserTableRow({
	user,
	FormComponent: Form,
}: {
	user: UserRow
	FormComponent: AdminFormComponent
}) {
	const [isEditing, setIsEditing] = useState(false)

	if (isEditing) {
		return (
			<tr>
				<td className={tdClassName} colSpan={4}>
					<Form
						method="post"
						action="/admin"
						className="grid gap-4 sm:grid-cols-2"
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
								className="w-full rounded border-2 border-zinc-400 bg-zinc-100 px-2.5 py-1.5 outline-none transition-colors focus:border-[#0d6d72] focus:ring-2 focus:ring-[#0d6d72]/20 dark:border-zinc-600 dark:bg-zinc-700"
							>
								<option value="user">Bruger</option>
								<option value="moderator">Ordstyrer</option>
								<option value="admin">Admin</option>
							</select>
						</div>
						<div className="flex gap-2 sm:col-span-2">
							<Tooltip content="Gem ændringer">
								<Button
									type="submit"
									className={rowButtonClassName}
									aria-label="Gem ændringer"
								>
									Gem
								</Button>
							</Tooltip>
							<Tooltip content="Annullér redigering">
								<Button
									type="button"
									displayType="secondary"
									className={rowButtonClassName}
									onClick={() => setIsEditing(false)}
									aria-label="Annullér redigering"
								>
									Annullér
								</Button>
							</Tooltip>
						</div>
					</Form>
				</td>
			</tr>
		)
	}

	return (
		<tr>
			<td className={tdClassName}>
				<p className="font-medium text-zinc-900 dark:text-zinc-50">
					{user.username}
				</p>
				<p className="text-zinc-500 dark:text-zinc-400">{user.email}</p>
			</td>
			<td className={tdClassName}>
				<span
					className={cn(
						'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
						roleBadgeClassName[user.role]
					)}
				>
					{roleLabels[user.role]}
				</span>
			</td>
			<td className={tdClassName}>
				<span
					className={cn(
						'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
						user.passwordHash
							? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
							: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
					)}
				>
					{user.passwordHash ? 'Aktiv' : 'Afventer aktivering'}
				</span>
			</td>
			<td className={cn(tdClassName, 'text-right')}>
				<div className="flex justify-end gap-2">
					<Tooltip content={`Rediger ${user.username}`}>
						<Button
							type="button"
							displayType="secondary"
							className={rowButtonClassName}
							onClick={() => setIsEditing(true)}
							aria-label={`Rediger ${user.username}`}
						>
							Rediger
						</Button>
					</Tooltip>
					{!user.passwordHash && (
						<Form method="post" action="/admin">
							<input type="hidden" name="intent" value="resendInvite" />
							<input type="hidden" name="username" value={user.username} />
							<Tooltip content="Send invitationen igen">
								<Button
									type="submit"
									displayType="secondary"
									className={rowButtonClassName}
									aria-label="Send invitationen igen"
								>
									Send igen
								</Button>
							</Tooltip>
						</Form>
					)}
					<Form method="post" action="/admin">
						<input type="hidden" name="intent" value="deleteUser" />
						<input type="hidden" name="username" value={user.username} />
						<Tooltip content={`Slet ${user.username} permanent`}>
							<Button
								type="submit"
								displayType="danger"
								className={rowButtonClassName}
								aria-label={`Slet ${user.username}`}
							>
								Slet
							</Button>
						</Tooltip>
					</Form>
				</div>
			</td>
		</tr>
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

function isToday(date: Date): boolean {
	return isSameDay(date, new Date())
}

function dayKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function groupMeetingsByDay(
	meetings: MeetingRow[]
): Map<string, MeetingRow[]> {
	const map = new Map<string, MeetingRow[]>()
	for (const meeting of meetings) {
		const key = dayKey(parseSqliteDate(meeting.created))
		const list = map.get(key)
		if (list) list.push(meeting)
		else map.set(key, [meeting])
	}
	return map
}

function getMonthGridDays(refDate: Date): Date[] {
	const firstOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
	const lastOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
	const gridStart = startOfWorkWeek(firstOfMonth)
	const gridEnd = addDays(startOfWorkWeek(lastOfMonth), 6)
	const days: Date[] = []
	for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)
	return days
}

function capitalizeFirst(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1)
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

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function MeetingStatusBadge({ ended }: { ended: string | null }) {
	return (
		<span
			className={cn(
				'inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
				ended
					? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
					: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
			)}
		>
			{ended ? 'Afsluttet' : 'Aktivt'}
		</span>
	)
}

function MeetingCompactRow({
	meeting,
	FormComponent: Form,
}: {
	meeting: MeetingRow
	FormComponent: AdminFormComponent
}) {
	return (
		<li className="space-y-1 border-b border-zinc-200 p-2 text-xs last:border-b-0 dark:border-zinc-700">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
					{meeting.roomName ?? meeting.id}
				</span>
				<MeetingStatusBadge ended={meeting.ended} />
			</div>
			<div className="flex items-center justify-between gap-2 text-zinc-500 dark:text-zinc-400">
				<span>{formatLogDate(meeting.created)}</span>
				<div className="flex shrink-0 items-center gap-2">
					{!meeting.ended && meeting.roomName && (
						<Tooltip content="Åbn live-styring for dette møde">
							<Link
								to={`/admin/rooms/${meeting.roomName}`}
								className="text-[#0d6d72] underline hover:text-[#0a565b]"
								aria-label="Styr live"
							>
								Styr live
							</Link>
						</Tooltip>
					)}
					<Form method="post" action="/admin" className="inline">
						<input type="hidden" name="intent" value="deleteMeeting" />
						<input type="hidden" name="meetingId" value={meeting.id} />
						<Tooltip content="Slet dette møde">
							<button
								type="submit"
								className="text-red-600 underline hover:text-red-800 dark:text-red-400"
								aria-label="Slet dette møde"
							>
								Slet
							</button>
						</Tooltip>
					</Form>
				</div>
			</div>
		</li>
	)
}

function MonthGrid({
	refDate,
	meetingsByDay,
	onSelectDay,
}: {
	refDate: Date
	meetingsByDay: Map<string, MeetingRow[]>
	onSelectDay: (day: Date) => void
}) {
	const days = useMemo(() => getMonthGridDays(refDate), [refDate])
	return (
		<div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-zinc-300 bg-zinc-300 dark:border-zinc-700 dark:bg-zinc-700">
			{WEEKDAY_LABELS.map((label) => (
				<div
					key={label}
					className="bg-zinc-100 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
				>
					{label}
				</div>
			))}
			{days.map((day) => {
				const inMonth = day.getMonth() === refDate.getMonth()
				const dayMeetings = meetingsByDay.get(dayKey(day)) ?? []
				return (
					<button
						key={day.toISOString()}
						type="button"
						onClick={() => onSelectDay(day)}
						aria-label={`Vis møder for ${day.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}`}
						className={cn(
							'flex min-h-[5.5rem] flex-col items-stretch gap-1 bg-white p-1.5 text-left transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60',
							!inMonth && 'bg-zinc-50 dark:bg-zinc-900/40'
						)}
					>
						<span
							className={cn(
								'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium',
								isToday(day)
									? 'bg-[#0d6d72] text-white'
									: inMonth
										? 'text-zinc-700 dark:text-zinc-300'
										: 'text-zinc-400 dark:text-zinc-600'
							)}
						>
							{day.getDate()}
						</span>
						<div className="space-y-0.5">
							{dayMeetings.slice(0, 3).map((m) => (
								<span
									key={m.id}
									className="block truncate rounded bg-[#0d6d72]/10 px-1 py-0.5 text-[10px] font-medium text-[#0b565b] dark:bg-[#0d6d72]/20 dark:text-teal-300"
								>
									{m.roomName ?? m.id}
								</span>
							))}
							{dayMeetings.length > 3 && (
								<span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
									+{dayMeetings.length - 3} mere
								</span>
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}

function YearGrid({
	refDate,
	meetings,
	onSelectMonth,
}: {
	refDate: Date
	meetings: MeetingRow[]
	onSelectMonth: (month: Date) => void
}) {
	const year = refDate.getFullYear()
	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-300 bg-zinc-300 sm:grid-cols-3 md:grid-cols-4 dark:border-zinc-700 dark:bg-zinc-700">
			{Array.from({ length: 12 }, (_, monthIndex) => {
				const monthDate = new Date(year, monthIndex, 1)
				const count = meetings.filter((m) => {
					const created = parseSqliteDate(m.created)
					return (
						created.getFullYear() === year && created.getMonth() === monthIndex
					)
				}).length
				const monthLabel = monthDate.toLocaleDateString('da-DK', {
					month: 'long',
				})
				return (
					<Tooltip key={monthIndex} content={`Vis møder for ${monthLabel}`}>
						<button
							type="button"
							onClick={() => onSelectMonth(monthDate)}
							aria-label={`Vis møder for ${monthLabel}`}
							className="flex flex-col items-start gap-1 bg-white p-3 text-left transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
						>
							<span className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
								{monthLabel}
							</span>
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								{count === 0
									? 'Ingen møder'
									: `${count} møde${count === 1 ? '' : 'r'}`}
							</span>
						</button>
					</Tooltip>
				)
			})}
		</div>
	)
}

function WorkWeekGrid({
	refDate,
	meetingsByDay,
	FormComponent,
}: {
	refDate: Date
	meetingsByDay: Map<string, MeetingRow[]>
	FormComponent: AdminFormComponent
}) {
	const start = startOfWorkWeek(refDate)
	const days = [0, 1, 2, 3, 4].map((i) => addDays(start, i))
	return (
		<div className="grid grid-cols-1 divide-y divide-zinc-300 overflow-hidden rounded-lg border border-zinc-300 sm:grid-cols-5 sm:divide-x sm:divide-y-0 dark:divide-zinc-700 dark:border-zinc-700">
			{days.map((day) => {
				const dayMeetings = meetingsByDay.get(dayKey(day)) ?? []
				return (
					<div
						key={day.toISOString()}
						className="flex flex-col bg-white dark:bg-zinc-900"
					>
						<div
							className={cn(
								'border-b border-zinc-300 px-2 py-2 text-center text-xs font-semibold dark:border-zinc-700',
								isToday(day)
									? 'bg-[#0d6d72] text-white'
									: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
							)}
						>
							{day.toLocaleDateString('da-DK', { weekday: 'short' })}{' '}
							{day.getDate()}.
						</div>
						{dayMeetings.length === 0 ? (
							<p className="p-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
								Ingen møder
							</p>
						) : (
							<ul>
								{dayMeetings.map((m) => (
									<MeetingCompactRow
										key={m.id}
										meeting={m}
										FormComponent={FormComponent}
									/>
								))}
							</ul>
						)}
					</div>
				)
			})}
		</div>
	)
}

function DayList({
	refDate,
	meetingsByDay,
	FormComponent,
}: {
	refDate: Date
	meetingsByDay: Map<string, MeetingRow[]>
	FormComponent: AdminFormComponent
}) {
	const dayMeetings = meetingsByDay.get(dayKey(refDate)) ?? []
	if (dayMeetings.length === 0) {
		return <p className={emptyStateClassName}>Ingen møder denne dag.</p>
	}
	return (
		<ul className="divide-y divide-zinc-300 overflow-hidden rounded-lg border border-zinc-300 dark:divide-zinc-700 dark:border-zinc-700">
			{dayMeetings.map((m) => (
				<MeetingCompactRow key={m.id} meeting={m} FormComponent={FormComponent} />
			))}
		</ul>
	)
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

	const meetingsByDay = useMemo(() => groupMeetingsByDay(meetings), [meetings])

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<SectionHeader
					title="Møder"
					subtitle="Historik over møder, grupperet efter starttidspunkt."
				/>
				<div className="inline-flex divide-x divide-zinc-300 overflow-hidden rounded-md border border-zinc-300 dark:divide-zinc-600 dark:border-zinc-600">
					{MEETING_VIEW_MODES.map((mode) => (
						<Tooltip key={mode.id} content={`Vis som ${mode.label.toLowerCase()}`}>
							<button
								type="button"
								onClick={() => setViewMode(mode.id)}
								aria-label={`Vis som ${mode.label.toLowerCase()}`}
								className={cn(
									'px-3 py-1.5 text-xs font-medium transition-colors',
									mode.id === viewMode
										? 'bg-[#0d6d72] text-white'
										: 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
								)}
							>
								{mode.label}
							</button>
						</Tooltip>
					))}
				</div>
			</div>

			{viewMode !== 'agenda' && (
				<div className="flex items-center justify-center gap-4">
					<Tooltip content="Forrige periode">
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
					</Tooltip>
					<p className="min-w-[14rem] text-center text-sm font-medium">
						{capitalizeFirst(meetingPeriodLabel(viewMode, refDate))}
					</p>
					<Tooltip content="Næste periode">
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
					</Tooltip>
				</div>
			)}

			{viewMode === 'month' && (
				<MonthGrid
					refDate={refDate}
					meetingsByDay={meetingsByDay}
					onSelectDay={(day) => {
						setRefDate(day)
						setViewMode('day')
					}}
				/>
			)}

			{viewMode === 'year' && (
				<YearGrid
					refDate={refDate}
					meetings={meetings}
					onSelectMonth={(month) => {
						setRefDate(month)
						setViewMode('month')
					}}
				/>
			)}

			{viewMode === 'workweek' && (
				<WorkWeekGrid
					refDate={refDate}
					meetingsByDay={meetingsByDay}
					FormComponent={Form}
				/>
			)}

			{viewMode === 'day' && (
				<DayList
					refDate={refDate}
					meetingsByDay={meetingsByDay}
					FormComponent={Form}
				/>
			)}

			{viewMode === 'agenda' &&
				(meetings.length === 0 ? (
					<p className={emptyStateClassName}>Ingen møder endnu.</p>
				) : (
					<div className={tableWrapperClassName}>
						<table className={tableClassName}>
							<thead className={theadClassName}>
								<tr>
									<th className={thClassName}>Møde</th>
									<th className={thClassName}>Status</th>
									<th className={thClassName}>Oprettet</th>
									<th className={cn(thClassName, 'text-right')}>Handlinger</th>
								</tr>
							</thead>
							<tbody className={trClassName}>
								{meetings.map((meeting) => (
									<tr key={meeting.id}>
										<td className={tdClassName}>
											<p className="font-medium text-zinc-900 dark:text-zinc-50">
												{meeting.roomName ?? meeting.id}
											</p>
											<p className="text-zinc-500 dark:text-zinc-400">
												{meeting.peakUserCount} deltagere på det højeste
											</p>
										</td>
										<td className={tdClassName}>
											<MeetingStatusBadge ended={meeting.ended} />
										</td>
										<td className={cn(tdClassName, 'text-zinc-500 dark:text-zinc-400')}>
											{formatLogDate(meeting.created)}
										</td>
										<td className={cn(tdClassName, 'text-right')}>
											<div className="flex justify-end items-center gap-3">
												{!meeting.ended && meeting.roomName && (
													<Tooltip content="Åbn live-styring for dette møde">
														<Link
															to={`/admin/rooms/${meeting.roomName}`}
															className="text-sm text-[#0d6d72] underline hover:text-[#0a565b]"
															aria-label="Styr live"
														>
															Styr live
														</Link>
													</Tooltip>
												)}
												<Form method="post" action="/admin">
													<input
														type="hidden"
														name="intent"
														value="deleteMeeting"
													/>
													<input
														type="hidden"
														name="meetingId"
														value={meeting.id}
													/>
													<Tooltip content="Slet dette møde">
														<Button
															type="submit"
															displayType="danger"
															className={rowButtonClassName}
															aria-label="Slet dette møde"
														>
															Slet
														</Button>
													</Tooltip>
												</Form>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				))}
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
				<SectionHeader
					title="Bannede IP-adresser"
					subtitle="Blokerer permanent for at joine noget møde fra denne IP."
				/>
				{bannedIps.length === 0 ? (
					<p className={emptyStateClassName}>
						Ingen IP-adresser er bandlyst. Ban en deltager fra "Styr live" på
						et aktivt møde.
					</p>
				) : (
					<div className={tableWrapperClassName}>
						<table className={tableClassName}>
							<thead className={theadClassName}>
								<tr>
									<th className={thClassName}>IP-adresse</th>
									<th className={thClassName}>Bandt af</th>
									<th className={cn(thClassName, 'text-right')}>Handling</th>
								</tr>
							</thead>
							<tbody className={trClassName}>
								{bannedIps.map((ban) => (
									<tr key={ban.ip}>
										<td className={cn(tdClassName, 'font-mono')}>{ban.ip}</td>
										<td className={cn(tdClassName, 'text-zinc-500 dark:text-zinc-400')}>
											{ban.bannedBy} · {formatLogDate(ban.created)}
										</td>
										<td className={cn(tdClassName, 'text-right')}>
											<Form method="post" action="/admin" className="inline">
												<input type="hidden" name="intent" value="unbanIp" />
												<input type="hidden" name="ip" value={ban.ip} />
												<Tooltip content={`Ophæv ban for ${ban.ip}`}>
													<Button
														type="submit"
														displayType="secondary"
														className={rowButtonClassName}
														aria-label={`Ophæv ban for ${ban.ip}`}
													>
														Ophæv
													</Button>
												</Tooltip>
											</Form>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="space-y-3">
				<SectionHeader
					title="Bandlyste deltagernavne"
					subtitle="Blokerer permanent for at joine noget møde med dette navn."
				/>
				{bannedUsernames.length === 0 ? (
					<p className={emptyStateClassName}>
						Ingen deltagernavne er bandlyst.
					</p>
				) : (
					<div className={tableWrapperClassName}>
						<table className={tableClassName}>
							<thead className={theadClassName}>
								<tr>
									<th className={thClassName}>Navn</th>
									<th className={thClassName}>Bandt af</th>
									<th className={cn(thClassName, 'text-right')}>Handling</th>
								</tr>
							</thead>
							<tbody className={trClassName}>
								{bannedUsernames.map((ban) => (
									<tr key={ban.username}>
										<td className={cn(tdClassName, 'font-medium')}>
											{ban.username}
										</td>
										<td className={cn(tdClassName, 'text-zinc-500 dark:text-zinc-400')}>
											{ban.bannedBy} · {formatLogDate(ban.created)}
										</td>
										<td className={cn(tdClassName, 'text-right')}>
											<Form method="post" action="/admin" className="inline">
												<input
													type="hidden"
													name="intent"
													value="unbanUsername"
												/>
												<input
													type="hidden"
													name="username"
													value={ban.username}
												/>
												<Tooltip content={`Ophæv ban for ${ban.username}`}>
													<Button
														type="submit"
														displayType="secondary"
														className={rowButtonClassName}
														aria-label={`Ophæv ban for ${ban.username}`}
													>
														Ophæv
													</Button>
												</Tooltip>
											</Form>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
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
		<div className="space-y-8">
			{!hasDb && (
				<div className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
					Ingen database er konfigureret — rum-konfiguration og mødelister er
					tomme, indtil en D1-database er koblet på.
				</div>
			)}
			{actionError && (
				<div className="rounded-md bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
					{actionError}
				</div>
			)}
			{setPasswordUrl && (
				<div className="space-y-1 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
					<p>Kunne ikke sende e-mail — send dette link manuelt:</p>
					<p className="break-all font-mono text-xs">{setPasswordUrl}</p>
				</div>
			)}

			{activeTab === 'users' && (
				<div className="space-y-10">
					<section className="space-y-4">
						<SectionHeader
							title="Opret bruger"
							subtitle="Sender en invitation med et link til at sætte adgangskode."
						/>
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
							<div className="space-y-2 sm:col-span-2 sm:max-w-xs">
								<Label htmlFor="role">Rolle</Label>
								<select
									id="role"
									name="role"
									aria-label="Rolle"
									defaultValue="user"
									className="w-full rounded border-2 border-zinc-400 bg-zinc-100 px-2.5 py-1.5 outline-none transition-colors focus:border-[#0d6d72] focus:ring-2 focus:ring-[#0d6d72]/20 dark:border-zinc-600 dark:bg-zinc-700"
								>
									<option value="user">Bruger</option>
									<option value="moderator">Ordstyrer</option>
									<option value="admin">Admin</option>
								</select>
							</div>
							<div className="sm:col-span-2">
								<Tooltip content="Opret brugeren og send en invitation på e-mail">
									<Button
										type="submit"
										className={formSubmitButtonClassName}
										aria-label="Opret og send invitation"
									>
										Opret og send invitation
									</Button>
								</Tooltip>
							</div>
						</Form>
					</section>

					<section className="space-y-3">
						<SectionHeader title="Brugere" />
						{users.length === 0 ? (
							<p className={emptyStateClassName}>
								Ingen brugere er oprettet endnu.
							</p>
						) : (
							<div className={tableWrapperClassName}>
								<table className={tableClassName}>
									<thead className={theadClassName}>
										<tr>
											<th className={thClassName}>Bruger</th>
											<th className={thClassName}>Rolle</th>
											<th className={thClassName}>Status</th>
											<th className={cn(thClassName, 'text-right')}>
												Handlinger
											</th>
										</tr>
									</thead>
									<tbody className={trClassName}>
										{users.map((user) => (
											<UserTableRow
												key={user.username}
												user={user}
												FormComponent={Form}
											/>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				</div>
			)}

			{activeTab === 'rooms' && (
				<div className="space-y-10">
					<section className="space-y-4">
						<SectionHeader
							title="Konfigurér rum"
							subtitle="Forudindstil et rums lås/chat-status og evt. værts-adgangskode."
						/>
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
							<div className="sm:col-span-2">
								<Tooltip content="Gem rummets indstillinger">
									<Button
										type="submit"
										className={formSubmitButtonClassName}
										aria-label="Gem rum"
									>
										Gem rum
									</Button>
								</Tooltip>
							</div>
						</Form>
					</section>

					<section className="space-y-3">
						<SectionHeader title="Konfigurerede rum" />
						{rooms.length === 0 ? (
							<p className={emptyStateClassName}>
								Ingen rum er konfigureret endnu.
							</p>
						) : (
							<div className={tableWrapperClassName}>
								<table className={tableClassName}>
									<thead className={theadClassName}>
										<tr>
											<th className={thClassName}>Rum</th>
											<th className={thClassName}>Indstillinger</th>
											<th className={cn(thClassName, 'text-right')}>
												Handling
											</th>
										</tr>
									</thead>
									<tbody className={trClassName}>
										{rooms.map((room) => (
											<tr key={room.id}>
												<td className={cn(tdClassName, 'font-medium')}>
													{room.id}
												</td>
												<td
													className={cn(
														tdClassName,
														'text-zinc-500 dark:text-zinc-400'
													)}
												>
													{room.lockedByDefault
														? 'Låst fra start'
														: 'Åbent fra start'}{' '}
													·{' '}
													{room.chatEnabledByDefault ? 'Chat til' : 'Chat fra'}
													{room.presetHostPasswordHash
														? ' · adgangskode sat'
														: ''}
												</td>
												<td className={cn(tdClassName, 'text-right')}>
													<Form method="post" action="/admin" className="inline">
														<input
															type="hidden"
															name="intent"
															value="deleteRoom"
														/>
														<input
															type="hidden"
															name="roomId"
															value={room.id}
														/>
														<Tooltip content={`Slet rummet ${room.id}`}>
															<Button
																type="submit"
																displayType="danger"
																className={rowButtonClassName}
																aria-label={`Slet rummet ${room.id}`}
															>
																Slet
															</Button>
														</Tooltip>
													</Form>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
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
					<SectionHeader
						title="System log"
						subtitle="De seneste 100 administrative handlinger."
					/>
					{auditLog.length === 0 ? (
						<p className={emptyStateClassName}>
							Ingen hændelser er logget endnu.
						</p>
					) : (
						<ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
							{auditLog.map((entry) => (
								<li
									key={entry.id}
									className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
								>
									<p className="font-medium text-zinc-900 dark:text-zinc-50">
										{actionLabels[entry.action] ?? entry.action}
										{entry.targetName ? ` · ${entry.targetName}` : ''}
									</p>
									<p className="shrink-0 text-zinc-500 dark:text-zinc-400">
										{entry.actorName} · {formatLogDate(entry.created)}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			)}
		</div>
	)
}
