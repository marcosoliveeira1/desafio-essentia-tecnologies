import { describe, expect, it } from 'vitest'
import { decodeJwtPayload, isJwtExpired } from './jwt'

function encodePayload(payload: unknown): string {
	return btoa(JSON.stringify(payload))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function fakeJwt(payload: unknown): string {
	return `${encodePayload({ alg: 'HS256', typ: 'JWT' })}.${encodePayload(payload)}.assinatura`
}

describe('decodeJwtPayload', () => {
	it('decodifica payload base64url com sub/name/email/exp', () => {
		const token = fakeJwt({
			sub: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
			exp: 1893456000,
		})

		expect(decodeJwtPayload(token)).toEqual({
			sub: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
			exp: 1893456000,
		})
	})

	it('decodifica payload com padding e base64 padrão', () => {
		const raw = btoa(JSON.stringify({ sub: 7, exp: 123 }))
		const token = `hdr.${raw}.sig`

		expect(decodeJwtPayload(token)).toEqual({ sub: 7, exp: 123 })
	})

	it('retorna null para token sem payload', () => {
		expect(decodeJwtPayload('apenas-uma-secao')).toBeNull()
		expect(decodeJwtPayload('')).toBeNull()
	})

	it('retorna null para base64 inválido', () => {
		expect(decodeJwtPayload('hdr.@@@nao-base64@@@.sig')).toBeNull()
	})

	it('retorna null para JSON inválido', () => {
		const broken = btoa('{nao é json').replace(/=/g, '')
		expect(decodeJwtPayload(`hdr.${broken}.sig`)).toBeNull()
	})

	it('retorna null quando payload não é objeto', () => {
		expect(decodeJwtPayload(fakeJwt(42))).toBeNull()
		expect(decodeJwtPayload(fakeJwt(null))).toBeNull()
	})
})

describe('isJwtExpired', () => {
	const now = 1_700_000_000_000

	it('false quando exp é no futuro', () => {
		const payload = { exp: now / 1000 + 60 }
		expect(isJwtExpired(payload, now)).toBe(false)
	})

	it('true quando exp passou', () => {
		const payload = { exp: now / 1000 - 1 }
		expect(isJwtExpired(payload, now)).toBe(true)
	})

	it('true no instante exato do exp (now >= exp)', () => {
		const payload = { exp: now / 1000 }
		expect(isJwtExpired(payload, now)).toBe(true)
	})

	it('true sem exp ou com exp de tipo errado (sessão inválida)', () => {
		expect(isJwtExpired({}, now)).toBe(true)
		expect(isJwtExpired({ exp: 'amanha' }, now)).toBe(true)
	})
})
