import type { AbstractControl, ValidationErrors } from '@angular/forms'

export const MIN_PASSWORD_LENGTH = 8
// bcrypt trunca em 72 bytes; backend valida maxLength 72
export const MAX_PASSWORD_LENGTH = 72

export function passwordLengthValidator(
	control: AbstractControl,
): ValidationErrors | null {
	const value: unknown = control.value
	if (value === null || value === undefined || value === '') return null
	if (typeof value !== 'string') return { passwordLength: true }
	if (value.length < MIN_PASSWORD_LENGTH) return { passwordLength: true }
	if (value.length > MAX_PASSWORD_LENGTH) return { passwordLength: true }
	return null
}
