import { Component, Input, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subscription, interval } from 'rxjs';

/**
 * Sorts the "Pickup Library" (owner) field in the ILL Request form.
 * Hooks into 'nde-ill-request'.
 */
@Component({
    selector: 'tau-ill-pickup-library-sorter',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        TranslateModule
    ],
    template: `<!-- Invisible -->`,
    styles: []
})
export class IllPickupLibrarySorterComponent implements OnInit, OnDestroy {
    @Input() private hostComponent!: any;

    private pollSubscription?: Subscription;
    private attempts = 0;
    private maxAttempts = 20; // Try for ~10 seconds

    constructor(
        private translate: TranslateService,
        private el: ElementRef // Inject ElementRef
    ) { }

    ngOnInit() {
        // We need to poll briefly because the form might not be fully initialized
        // when this component loads.
        this.pollSubscription = interval(500).subscribe(() => this.attemptSort());
    }

    ngOnDestroy() {
        this.pollSubscription?.unsubscribe();
    }

    private attemptSort() {
        this.attempts++;
        console.log(`IllPickupLibrarySorter: Attempt ${this.attempts}`);

        // Stop checking if we've tried too many times
        if (this.attempts > this.maxAttempts) {
            console.warn('IllPickupLibrarySorter: Max attempts reached without success');
            this.pollSubscription?.unsubscribe();
            return;
        }

        const win = window as any;

        // 1. Check if window.ng is available (Angular Debug Tools)
        if (this.attempts === 1 && win.ng) {
            console.log('IllPickupLibrarySorter: window.ng is available!');
        }

        // 2. Try to find parent via DOM
        if (this.attempts === 1) {
            // Traverse up to find 'nde-ill-request'
            let parent = this.el.nativeElement.parentElement;
            while (parent) {
                if (parent.tagName.toLowerCase().includes('ill-request')) {
                    console.log('IllPickupLibrarySorter: Found parent DOM element:', parent);
                    if (win.ng && win.ng.getComponent) {
                        const comp = win.ng.getComponent(parent);
                        console.log('IllPickupLibrarySorter: Angular Component from DOM:', comp);
                        if (comp) this.hostComponent = comp; // SWITCH TO FOUND COMPONENT
                    } else {
                        // Try accessing the __ngContext__ directly if possible (internal Angular)
                        console.log('IllPickupLibrarySorter: ng.getComponent not available. element properties:', Object.keys(parent));
                    }
                    break;
                }
                parent = parent.parentElement;
            }
        }

        // 3. Fallback to existing logic if hostComponent is now set
        if (!this.hostComponent) {
            console.warn('IllPickupLibrarySorter: hostComponent still missing');
            // Stop early if we can't find anything
            if (this.attempts > 5) {
                console.warn('IllPickupLibrarySorter: Giving up finding hostComponent');
                this.pollSubscription?.unsubscribe();
            }
            return;
        }

        // Standard check for requestService...
        const requestService = this.hostComponent.requestService ||
            (this.hostComponent.model && this.hostComponent.model.requestService) ||
            this.hostComponent.parentCtrl;

        if (!requestService) {
            console.log('IllPickupLibrarySorter: requestService not found yet');
            return; // Not ready yet
        }

        // Check for form fields definition
        const formFields = requestService._formFields || requestService.formFields;

        if (!formFields || !Array.isArray(formFields)) {
            console.log('IllPickupLibrarySorter: formFields not found or not array');
            return; // Not ready yet
        }

        // Find the owner field
        const ownerField = formFields.find((f: any) => f.key === 'owner');

        if (ownerField) {
            console.log('IllPickupLibrarySorter: Found owner field, checking options...');
            if (ownerField.options && ownerField.options.length > 1) {
                // We found the target! Sort it.
                this.sortOwnerOptions(ownerField);
                // Success - stop polling
                this.pollSubscription?.unsubscribe();
            } else {
                console.log('IllPickupLibrarySorter: Owner options empty or single, skipping sort');
            }
        } else {
            console.log('IllPickupLibrarySorter: Owner field not found in formFields');
        }
    }

    private sortOwnerOptions(ownerField: any) {
        const options = ownerField.options;

        // Determine placeholder text
        const lang = this.translate.currentLang || this.translate.defaultLang;
        const placeholder = lang === 'he' ? 'יש לבחור ספרייה' : 'Please choose your library';

        // 1. Ensure/Add Placeholder
        if (options.length > 0 && options[0].value !== '') {
            // No empty option at top -> add one
            options.unshift({ label: placeholder, value: '' });
        } else if (options.length > 0 && options[0].value === '') {
            // Empty option exists -> update label
            options[0].label = placeholder;
        }

        // NDE might have form control attached, so we might need to reset value if needed
        // But modifying the 'options' array reference is usually enough for Angular tracking

        // 2. Sort
        options.sort((a: any, b: any) => {
            // Always keep placeholder at top
            if (a.value === '') return -1;
            if (b.value === '') return 1;

            const aLabel = (a.label || '').toUpperCase();
            const bLabel = (b.label || '').toUpperCase();

            if (aLabel < bLabel) return -1;
            if (aLabel > bLabel) return 1;
            return 0;
        });

        console.log('IllPickupLibrarySorter: Options sorted successfully');
    }
}
