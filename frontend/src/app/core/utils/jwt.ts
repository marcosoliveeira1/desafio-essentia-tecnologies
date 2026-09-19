export interface JwtPayload {
	sub?: unknown
	name?: unknown
	email?: unknown
	exp?: unknown
}

export function decodeJwtPayload(token: string): JwtPayload | null {
	try {
		const payload = token.split('.')[1]
		if (!payload) return null
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const binary = atob(base64)
		const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
		const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes))
		if (decoded === null || typeof decoded !== 'object') return null
		return decoded as JwtPayload
	} catch {
		return null
	}
}

export function isJwtExpired(payload: JwtPayload, now = Date.now()): boolean {
	return typeof payload.exp !== 'number' || payload.exp * 1000 <= now
}
