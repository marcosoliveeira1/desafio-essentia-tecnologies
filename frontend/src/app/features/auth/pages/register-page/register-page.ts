import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	signal,
} from '@angular/core'
import {
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthStoreService } from '../../../../core/services/auth-store.service'
import { strictEmailValidator } from '../../../../core/validators/email.validator'
import { passwordLengthValidator } from '../../../../core/validators/password.validator'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink],
	selector: 'app-register-page',
	styleUrl: './register-page.css',
	templateUrl: './register-page.html',
})
export class RegisterPage {
	protected readonly store = inject(AuthStoreService)
	private readonly router = inject(Router)
	protected readonly showPassword = signal(false)

	readonly form = new FormGroup({
		email: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, strictEmailValidator],
		}),
		name: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required],
		}),
		password: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, passwordLengthValidator],
		}),
	})

	constructor() {
		effect(() => {
			if (this.store.authState() === 'authenticated') {
				void this.router.navigate(['/tasks'])
			}
		})
	}

	protected togglePasswordVisibility(): void {
		this.showPassword.update((visible) => !visible)
	}

	protected onSubmit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched()
			return
		}
		const { email, name, password } = this.form.getRawValue()
		this.store.register({
			email: email.trim().toLowerCase(),
			name: name.trim(),
			password,
		})
	}
}
