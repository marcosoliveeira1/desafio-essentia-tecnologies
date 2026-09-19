import { FormControl } from '@angular/forms'
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
	passwordLengthValidator,
} from './password.validator'

describe('passwordLengthValidator', () => {
	const validate = (value: unknown) =>
		passwordLengthValidator(new FormControl(value))

	it('aceita senha no limite mínimo de 8 chars', () => {
		expect(validate('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
	})

	it('aceita senha no limite máximo de 72 chars (boundary bcrypt)', () => {
		expect(validate('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull()
	})

	it('rejeita senha com 7 chars', () => {
		expect(validate('a'.repeat(7))).toEqual({ passwordLength: true })
	})

	it('rejeita senha com 73 chars (boundary exata do AC)', () => {
		expect(validate('a'.repeat(73))).toEqual({ passwordLength: true })
	})

	it('vazio passa (required é responsabilidade do form)', () => {
		expect(validate('')).toBeNull()
		expect(validate(null)).toBeNull()
		expect(validate(undefined)).toBeNull()
	})

	it('rejeita valor não-string', () => {
		expect(validate(123)).toEqual({ passwordLength: true })
		expect(validate({})).toEqual({ passwordLength: true })
	})
})
