import { AppError } from './app-error.js'

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado', code = 'NOT_FOUND') {
    super(404, code, message)
  }
}
