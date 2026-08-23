export function validatePassword(password: string): string | null {
	if (password.length < 8) return 'Adgangskoden skal være mindst 8 tegn.'
	if (!/[A-Z]/.test(password))
		return 'Adgangskoden skal indeholde mindst ét stort bogstav.'
	if (!/[0-9]/.test(password))
		return 'Adgangskoden skal indeholde mindst ét tal.'
	return null
}
