import type { AbstractControl, ValidationErrors } from '@angular/forms'

export const STRICT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_EMAIL_LENGTH = 255

export function strictEmailValidator(
	control: AbstractControl,
): ValidationErrors | null {
	const value: unknown = control.value
	if (value === null || value === undefined || value === '') return null
	if (typeof value !== 'string') return { strictEmail: true }
	const email = value.trim()
	if (email.length > MAX_EMAIL_LENGTH) return { strictEmail: true }
	return STRICT_EMAIL_PATTERN.test(email) ? null : { strictEmail: true }
}
