import { AppError } from './app-error.js'

export class ConflictError extends AppError {
  constructor(message = 'Conflito', code = 'CONFLICT') {
    super(409, code, message)
  }
}
