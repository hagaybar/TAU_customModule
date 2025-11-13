import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

/**
 * Customizes Research Assistant text using shadow DOM manipulation
 * and custom Alma labels (nde-ra-first-row, nde-ra-second-row)
 */
@Component({
  selector: 'custom-research-assistant-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './research-assistant-test.component.html',
  styleUrl: './research-assistant-test.component.scss'
})
export class ResearchAssistantTestComponent implements OnInit, OnDestroy {
  private langChangeSubscription?: Subscription;

  constructor(private translateService: TranslateService) {
  }

  async ngOnInit() {
    // Apply text modification
    await this.modifyResearchAssistantText();

    // Subscribe to language changes
    this.subscribeToLanguageChanges();
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
  }

  /** Re-applies text modification when language changes */
  private subscribeToLanguageChanges() {
    this.langChangeSubscription = this.translateService.onLangChange.subscribe(
      (event: LangChangeEvent) => {
        // Re-apply text modification for new language
        this.modifyResearchAssistantText();
      }
    );
  }

  /** Modifies Research Assistant text by splitting into two styled parts */
  private async modifyResearchAssistantText() {
    try {
      // 1. Find the cdi-research-assistant element
      const hostElement = document.querySelector('cdi-research-assistant');
      if (!hostElement) {
        console.warn('📝 cdi-research-assistant element not found');
        return;
      }

      // 2. Access shadow DOM
      const shadowRoot = (hostElement as any).shadowRoot as ShadowRoot;
      if (!shadowRoot) {
        console.warn('📝 Shadow DOM not accessible');
        return;
      }

      // 3. Find the target paragraph inside shadow DOM
      const internalSelector = '#landing > div > div.w-full.text-center > p';
      const paragraph = shadowRoot.querySelector(internalSelector);
      if (!paragraph) {
        console.warn('📝 Target paragraph not found');
        return;
      }

      // 4. Get translated text from custom Alma labels
      const firstRowText = await this.translateService.get('nde-ra-first-row').toPromise();
      const secondRowText = await this.translateService.get('nde-ra-second-row').toPromise();

      // 5. Remove old styles if they exist (for language changes)
      const existingStyles = shadowRoot.querySelector('#tau-ra-custom-styles');
      if (existingStyles) {
        existingStyles.remove();
      }

      // 6. Inject custom styles into shadow DOM
      const styleSheet = document.createElement('style');
      styleSheet.id = 'tau-ra-custom-styles';
      styleSheet.textContent = `
        .tau-ra-first-part {
          display: block;
          margin-bottom: 1rem;
          font-weight: bold;
        }
        .tau-ra-second-part {
          display: block;
          color: #666666;
        }
      `;
      shadowRoot.appendChild(styleSheet);

      // 7. Create new content structure with styled spans
      const wrapper = document.createElement('div');
      const firstSpan = document.createElement('span');
      const secondSpan = document.createElement('span');

      firstSpan.className = 'tau-ra-first-part';
      secondSpan.className = 'tau-ra-second-part';
      firstSpan.textContent = firstRowText;
      secondSpan.textContent = secondRowText;

      wrapper.appendChild(firstSpan);
      wrapper.appendChild(secondSpan);

      // 8. Replace paragraph content
      paragraph.innerHTML = '';
      paragraph.appendChild(wrapper);

      console.log('✅ Research Assistant text modified successfully');

    } catch (error) {
      console.error('❌ Error modifying Research Assistant text:', error);
    }
  }

}
