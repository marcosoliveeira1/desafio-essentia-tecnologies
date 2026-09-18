export interface User {
	id: number
	name: string
	email: string
}

export interface AuthResponse {
	token: string
}

export interface RegisterDto {
	name: string
	email: string
	password: string
}

export interface LoginDto {
	email: string
	password: string
}

export type AuthState = 'anonymous' | 'authenticated'
