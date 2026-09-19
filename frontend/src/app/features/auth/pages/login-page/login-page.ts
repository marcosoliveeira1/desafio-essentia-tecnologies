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

const DEMO_EMAIL = 'demo@essentia.com'
const DEMO_PASSWORD = 'demo1234'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink],
	selector: 'app-login-page',
	styleUrl: './login-page.css',
	templateUrl: './login-page.html',
})
export class LoginPage {
	protected readonly store = inject(AuthStoreService)
	private readonly router = inject(Router)
	protected readonly showPassword = signal(false)

	readonly form = new FormGroup({
		email: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, strictEmailValidator],
		}),
		password: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, Validators.minLength(8)],
		}),
	})

	constructor() {
		effect(() => {
			if (this.store.authState() === 'authenticated') {
				void this.router.navigate(['/tasks'])
			}
		})
	}

	protected useDemo(): void {
		this.form.setValue({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
		this.form.markAsUntouched()
	}

	protected togglePasswordVisibility(): void {
		this.showPassword.update((visible) => !visible)
	}

	protected onSubmit(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched()
			return
		}
		const { email, password } = this.form.getRawValue()
		this.store.login({ email: email.trim().toLowerCase(), password })
	}
}
