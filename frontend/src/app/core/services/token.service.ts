import { Injectable } from '@angular/core'

export const TOKEN_STORAGE_KEY = 'essentia_token'

@Injectable({ providedIn: 'root' })
export class TokenService {
	private readonly storageKey = TOKEN_STORAGE_KEY

	getToken(): string | null {
		return localStorage.getItem(this.storageKey)
	}

	setToken(token: string): void {
		localStorage.setItem(this.storageKey, token)
	}

	clear(): void {
		localStorage.removeItem(this.storageKey)
	}
}
