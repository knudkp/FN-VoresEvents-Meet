const MAX_LENGTH = 10
const PATTERN = /^[A-Za-zÆØÅæøå]+[0-9]*$/

/**
 * Guest display names: letters only, optionally followed by trailing
 * digits (e.g. "Knud99"), max 10 characters. The first letter is
 * auto-capitalized rather than rejected.
 */
export function normalizeGuestDisplayName(
	raw: string
): { ok: true; value: string } | { ok: false; error: string } {
	const value = raw.trim()

	if (!value) {
		return { ok: false, error: 'Skriv et visningsnavn.' }
	}
	if (value.length > MAX_LENGTH) {
		return {
			ok: false,
			error: `Visningsnavn må højst være ${MAX_LENGTH} tegn.`,
		}
	}
	if (!PATTERN.test(value)) {
		return {
			ok: false,
			error:
				'Visningsnavn må kun bestå af bogstaver, med eventuelle tal til sidst (fx "Knud99").',
		}
	}

	return { ok: true, value: value[0].toUpperCase() + value.slice(1) }
}
