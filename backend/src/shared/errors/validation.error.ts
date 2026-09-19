import { AppError } from './app-error.js'

export class ValidationError extends AppError {
	constructor(message = 'Dados inválidos', details?: unknown) {
		super(400, 'VALIDATION_ERROR', message, details)
	}
}
