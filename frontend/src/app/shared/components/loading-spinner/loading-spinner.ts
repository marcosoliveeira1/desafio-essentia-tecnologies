import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'app-loading-spinner',
	styleUrl: './loading-spinner.css',
	templateUrl: './loading-spinner.html',
})
export class LoadingSpinner {}
