import { FormControl } from '@angular/forms'
import { MAX_EMAIL_LENGTH, strictEmailValidator } from './email.validator'

describe('strictEmailValidator', () => {
	const validate = (value: unknown) =>
		strictEmailValidator(new FormControl(value))

	it('aceita e-mails válidos (inclusive com espaços nas bordas)', () => {
		for (const email of [
			'ada@techx.com',
			'  ada@techx.com  ',
			'a.b+tag@sub.x.io',
		]) {
			expect(validate(email)).toBeNull()
		}
	})

	it('rejeita e-mails inválidos com erro strictEmail', () => {
		for (const email of [
			'sem-arroba',
			'a@',
			'@x.com',
			'a@x',
			'a b@x.com',
			'a@x .com',
		]) {
			expect(validate(email)).toEqual({ strictEmail: true })
		}
	})

	it('rejeita e-mail acima do limite de 255 chars', () => {
		const tooLong = `${'a'.repeat(MAX_EMAIL_LENGTH)}@x.com`
		expect(validate(tooLong)).toEqual({ strictEmail: true })
	})

	it('rejeita valor não-string', () => {
		expect(validate(123)).toEqual({ strictEmail: true })
		expect(validate({})).toEqual({ strictEmail: true })
	})

	it('vazio passa (required é responsabilidade do form)', () => {
		expect(validate('')).toBeNull()
		expect(validate(null)).toBeNull()
		expect(validate(undefined)).toBeNull()
	})
})
