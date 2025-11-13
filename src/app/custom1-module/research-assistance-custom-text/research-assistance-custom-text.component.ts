import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

/**
 * Customizes Research Assistant text using shadow DOM manipulation
 * and custom Alma labels (nde-ra-first-row, nde-ra-second-row)
 */
@Component({
  selector: 'custom-research-assistance-custom-text',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './research-assistance-custom-text.component.html',
  styleUrl: './research-assistance-custom-text.component.scss'
})
export class ResearchAssistanceCustomTextComponent implements OnInit, OnDestroy {
  private langChangeSubscription?: Subscription;
  private observer?: MutationObserver;
  private retryCount = 0;
  private readonly MAX_RETRIES = 10;

  constructor(private translateService: TranslateService) {
  }

  async ngOnInit() {
    // Apply text modification with retry
    await this.modifyWithRetry();

    // Subscribe to language changes
    this.subscribeToLanguageChanges();

    // Watch for DOM changes (handles same-page navigation)
    this.setupMutationObserver();
  }

  ngOnDestroy() {
    // Clean up subscriptions and observers
    if (this.langChangeSubscription) {
      this.langChangeSubscription.unsubscribe();
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /** Re-applies text modification when language changes */
  private subscribeToLanguageChanges() {
    this.langChangeSubscription = this.translateService.onLangChange.subscribe(
      (event: LangChangeEvent) => {
        // Re-apply text modification for new language
        this.retryCount = 0;
        this.modifyWithRetry();
      }
    );
  }

  /** Watches for DOM changes and re-applies modification if needed */
  private setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      // Check if the paragraph was recreated or modified externally
      const hostElement = document.querySelector('cdi-research-assistant');
      if (!hostElement) return;

      const shadowRoot = (hostElement as any).shadowRoot as ShadowRoot;
      if (!shadowRoot) return;

      const paragraph = shadowRoot.querySelector('#landing > div > div.w-full.text-center > p');
      if (!paragraph) return;

      // Check if our modification is still present
      const hasOurStyles = shadowRoot.querySelector('#tau-ra-custom-styles');
      const hasOurWrapper = paragraph.querySelector('.tau-ra-first-part');

      if (!hasOurStyles || !hasOurWrapper) {
        console.log('📝 Content recreated, re-applying modification...');
        this.retryCount = 0;
        this.modifyWithRetry();
      }
    });

    // Start observing the entire document for changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /** Attempts to modify text with retry logic for timing issues */
  private async modifyWithRetry() {
    const success = await this.modifyResearchAssistantText();

    if (!success && this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      const delay = Math.min(500 * Math.pow(2, this.retryCount - 1), 3000);
      console.log(`📝 Retry ${this.retryCount}/${this.MAX_RETRIES} in ${delay}ms...`);

      setTimeout(() => {
        this.modifyWithRetry();
      }, delay);
    }
  }

  /** Modifies Research Assistant text by splitting into two styled parts */
  private async modifyResearchAssistantText(): Promise<boolean> {
    try {
      // 1. Find the cdi-research-assistant element
      const hostElement = document.querySelector('cdi-research-assistant');
      if (!hostElement) {
        return false;
      }

      // 2. Access shadow DOM
      const shadowRoot = (hostElement as any).shadowRoot as ShadowRoot;
      if (!shadowRoot) {
        return false;
      }

      // 3. Find the target paragraph inside shadow DOM
      const internalSelector = '#landing > div > div.w-full.text-center > p';
      const paragraph = shadowRoot.querySelector(internalSelector);
      if (!paragraph) {
        return false;
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
        /* Hide paragraph content until we modify it */
        #landing > div > div.w-full.text-center > p:not(.tau-ra-modified) {
          visibility: hidden;
        }

        /* Show modified paragraph with smooth transition */
        #landing > div > div.w-full.text-center > p.tau-ra-modified {
          visibility: visible;
          opacity: 1;
          transition: opacity 0.2s ease-in;
        }

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

      // 9. Mark paragraph as modified to make it visible
      (paragraph as HTMLElement).classList.add('tau-ra-modified');

      console.log('✅ Research Assistant text modified successfully');
      return true;

    } catch (error) {
      console.error('❌ Error modifying Research Assistant text:', error);
      return false;
    }
  }

}
