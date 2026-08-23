#!/usr/bin/env node
// Break-glass admin recovery tool for fleksMeet.
//
// Requires `wrangler login` to already be authenticated against the
// Cloudflare account that owns this deployment — this script doesn't lower
// the security bar, it just automates the same wrangler operations an admin
// with dashboard access could already do by hand.
//
// Usage:
//   node scripts/reset-admin-access.mjs user <username>
//     Forces a password reset for a real D1 user account (any role), the
//     same way "Gensend invite" in /admin does — generates a fresh
//     /set-password link, valid 7 days, one-time use. Works even if the
//     account was already activated and its old password is unknown.
//
//   node scripts/reset-admin-access.mjs master
//     Rotates the shared ADMIN_USERNAME + HOST_PASSWORD master login by
//     running `wrangler secret put HOST_PASSWORD` interactively.

import { randomBytes, createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DB_NAME = 'fn-voresevents-meet-db'
const SITE_ORIGIN = 'https://tjekind.voresevents.com'
const INVITE_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

function generateInviteToken() {
	return randomBytes(32)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function sha256Hex(value) {
	return createHash('sha256').update(value).digest('hex')
}

function resetUser(username) {
	if (!username) {
		console.error('Brug: node scripts/reset-admin-access.mjs user <brugernavn>')
		process.exit(1)
	}

	const rawToken = generateInviteToken()
	const inviteTokenHash = sha256Hex(rawToken)
	const inviteTokenExpires = Date.now() + INVITE_TOKEN_LIFETIME_MS
	const escapedUsername = username.replace(/'/g, "''")

	const sql = `UPDATE Users SET inviteTokenHash = '${inviteTokenHash}', inviteTokenExpires = ${inviteTokenExpires} WHERE username = '${escapedUsername}';`

	console.log(`Nulstiller "${username}" i ${DB_NAME}...`)
	const sqlFile = join(tmpdir(), `reset-admin-access-${Date.now()}.sql`)
	writeFileSync(sqlFile, sql, 'utf8')

	let output
	try {
		output = execFileSync(
			'npx',
			['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--file', sqlFile, '--json'],
			{ encoding: 'utf8', shell: true }
		)
	} finally {
		unlinkSync(sqlFile)
	}

	// wrangler prints upload-progress spinner lines (with ANSI codes that
	// themselves contain '[') before the JSON array when using --file, so
	// find the line that is exactly the array's opening bracket.
	const lines = output.split('\n')
	const jsonStartLine = lines.findIndex((line) => line.trim() === '[')
	const [result] = JSON.parse(lines.slice(jsonStartLine).join('\n'))
	const changes = result?.results?.meta?.changes ?? result?.meta?.changes
	if (!changes) {
		console.error(
			`Ingen bruger med brugernavn "${username}" fundet — intet blev ændret.`
		)
		process.exit(1)
	}

	console.log('\nNyt set-password-link (udløber om 7 dage, kan kun bruges én gang):')
	console.log(`${SITE_ORIGIN}/set-password?token=${rawToken}`)
}

function resetMaster() {
	console.log(
		'Sætter en ny HOST_PASSWORD (master-adgangskode, parret med ADMIN_USERNAME).'
	)
	console.log('Wrangler beder om den nye værdi herunder:\n')
	const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'HOST_PASSWORD'], {
		stdio: 'inherit',
		shell: true,
	})
	process.exit(result.status ?? 0)
}

const [mode, arg] = process.argv.slice(2)

if (mode === 'user') {
	resetUser(arg)
} else if (mode === 'master') {
	resetMaster()
} else {
	console.error('Brug:')
	console.error('  node scripts/reset-admin-access.mjs user <brugernavn>')
	console.error('  node scripts/reset-admin-access.mjs master')
	process.exit(1)
}
