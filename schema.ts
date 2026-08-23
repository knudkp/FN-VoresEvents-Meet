import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Env } from '~/types/Env'

const metadataColumns = {
	id: integer('id').primaryKey({ autoIncrement: true }),
	created: text('created')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	modified: text('modified')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	deleted: text('deleted'),
}

export const AnalyticsRefreshes = sqliteTable('AnalyticsRefreshes', {
	...metadataColumns,
	version: text('version').notNull(),
})

export const AnalyticsSimpleCallFeedback = sqliteTable(
	'AnalyticsSimpleCallFeedback',
	{
		...metadataColumns,
		version: text('version').notNull(),
		experiencedIssues: integer('experiencedIssues').notNull(),
		meetingId: text('meetingId').references(() => Meetings.id),
	}
)

export const Meetings = sqliteTable('Meetings', {
	...metadataColumns,
	id: text('id').primaryKey(),
	peakUserCount: integer('userCount').notNull(),
	ended: text('ended'),
	hostPasswordHash: text('hostPasswordHash'),
	roomName: text('roomName'),
})

export const ChatMessages = sqliteTable('ChatMessages', {
	...metadataColumns,
	meetingId: text('meetingId').references(() => Meetings.id),
	fromId: text('fromId').notNull(),
	fromName: text('fromName').notNull(),
	message: text('message').notNull(),
	sentAt: integer('sentAt').notNull(),
})

export const AdminAuditLog = sqliteTable('AdminAuditLog', {
	...metadataColumns,
	meetingId: text('meetingId').references(() => Meetings.id),
	action: text('action').notNull(),
	actorId: text('actorId').notNull(),
	actorName: text('actorName').notNull(),
	targetId: text('targetId'),
	targetName: text('targetName'),
})

export const Rooms = sqliteTable('Rooms', {
	...metadataColumns,
	id: text('id').primaryKey(),
	lockedByDefault: integer('lockedByDefault', { mode: 'boolean' })
		.notNull()
		.default(false),
	chatEnabledByDefault: integer('chatEnabledByDefault', { mode: 'boolean' })
		.notNull()
		.default(true),
	presetHostPasswordHash: text('presetHostPasswordHash'),
	reservedBy: text('reservedBy').notNull(),
})

export function getDb(context: { env: Env }) {
	if (!context.env.DB) {
		return null
	}
	return drizzle(context.env.DB)
}
