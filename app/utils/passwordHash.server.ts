const ITERATIONS = 100_000

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2)
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
	}
	return bytes
}

async function deriveBits(
	password: string,
	salt: Uint8Array
): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	)
	return crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations: ITERATIONS,
			hash: 'SHA-256',
		},
		keyMaterial,
		256
	)
}

export async function hashUserPassword(
	password: string
): Promise<{ hash: string; salt: string }> {
	const saltBytes = crypto.getRandomValues(new Uint8Array(16))
	const derived = await deriveBits(password, saltBytes)
	return { hash: toHex(derived), salt: toHex(saltBytes) }
}

export async function verifyUserPassword(
	password: string,
	hash: string,
	salt: string
): Promise<boolean> {
	const derived = await deriveBits(password, fromHex(salt))
	return toHex(derived) === hash
}
