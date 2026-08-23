import { describe, expect, it } from 'vitest'
import { normalizeGuestDisplayName } from './validateDisplayName'

describe('normalizeGuestDisplayName', () => {
	it('capitalizes a lowercase first letter instead of rejecting it', () => {
		expect(normalizeGuestDisplayName('knud')).toEqual({
			ok: true,
			value: 'Knud',
		})
	})

	it('leaves an already-capitalized name unchanged', () => {
		expect(normalizeGuestDisplayName('Knud')).toEqual({
			ok: true,
			value: 'Knud',
		})
	})

	it('trims surrounding whitespace', () => {
		expect(normalizeGuestDisplayName('  knud  ')).toEqual({
			ok: true,
			value: 'Knud',
		})
	})

	it('allows trailing digits after the letters', () => {
		expect(normalizeGuestDisplayName('knud99')).toEqual({
			ok: true,
			value: 'Knud99',
		})
	})

	it('allows Danish letters', () => {
		expect(normalizeGuestDisplayName('ærø')).toEqual({
			ok: true,
			value: 'Ærø',
		})
	})

	it('accepts exactly 10 characters', () => {
		expect(normalizeGuestDisplayName('abcdefghij')).toEqual({
			ok: true,
			value: 'Abcdefghij',
		})
	})

	it('rejects an empty name', () => {
		expect(normalizeGuestDisplayName('   ')).toEqual({
			ok: false,
			error: expect.any(String),
		})
	})

	it('rejects more than 10 characters', () => {
		const result = normalizeGuestDisplayName('abcdefghijk')
		expect(result.ok).toBe(false)
	})

	it('rejects a name starting with a digit', () => {
		const result = normalizeGuestDisplayName('9knud')
		expect(result.ok).toBe(false)
	})

	it('rejects a letter after a digit', () => {
		const result = normalizeGuestDisplayName('kn9ud')
		expect(result.ok).toBe(false)
	})

	it('rejects disallowed characters', () => {
		const result = normalizeGuestDisplayName('knud!')
		expect(result.ok).toBe(false)
	})
})
