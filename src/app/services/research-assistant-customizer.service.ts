import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Research Assistant Customizer Service
 *
 * This service runs on app initialization and modifies the research assistant
 * description text by accessing its shadow DOM and splitting the text into
 * two styled parts (bold first line + gray second line).
 *
 * Based on the original AngularJS implementation (ra_2_parts.js)
 * This approach doesn't use component hooks - it just runs JavaScript to find
 * and modify the existing NDE element.
 */
@Injectable({
  providedIn: 'root'
})
export class ResearchAssistantCustomizerService {
  /** Current UI language */
  private currentLanguage: 'en' | 'he' = 'en';

  /** Flag to track if TranslateService worked */
  private usingTranslateService: boolean = false;

  /** Retry timeout reference for cleanup */
  private retryTimeout?: number;

  /** Maximum number of retry attempts */
  private readonly MAX_RETRIES = 10;

  /** Current retry count */
  private retryCount = 0;

  /** Alma label keys (from original AngularJS code) */
  private readonly LABEL_KEYS = {
    firstLine: 'nui.aria.primo_research_assistant.desc.first_line',
    secondLine: 'nui.aria.primo_research_assistant.desc.second_line'
  };

  /** Fallback translations if TranslateService doesn't work */
  private readonly fallbackTranslations = {
    firstLine: {
      en: 'Ask research questions. Explore new topics. Discover credible sources.',
      he: 'שאל שאלות מחקר. חקור נושאים חדשים. גלה מקורות אמינים.'
    },
    secondLine: {
      en: 'Please note: This AI Research Assistant tool is in beta version. It is based on a limited selection of information available through DaTA, and may not provide accurate results, especially for queries in Hebrew.',
      he: 'לתשומת ליבך: כלי עוזר המחקר בינה מלאכותית זה הוא בגרסת בטא. הוא מבוסס על מבחר מוגבל של מידע הזמין דרך DaTA, ועשוי שלא לספק תוצאות מדויקות, במיוחד עבור שאילתות בעברית.'
    }
  };

  constructor(private translateService: TranslateService) {
    console.log('🟣 ResearchAssistantCustomizer: Service created');
  }

  /**
   * Initialize the customizer
   * Call this from app initialization
   */
  public initialize(): void {
    console.log('🟣 ResearchAssistantCustomizer: Initialize called');
    console.log('🟣 ResearchAssistantCustomizer: Current URL:', window.location.href);

    // Detect language
    this.detectLanguage();

    // TEST: Try to fetch custom label from Alma code table
    this.testCustomLabel();

    // Load translations, then start modification process
    this.loadTranslations().then(() => {
      // Start looking for the research assistant element
      this.startModification();
    });
  }

  /**
   * TEST METHOD: Try to fetch a custom label from Alma's NDE code table
   * This tests if we can use custom labels defined in the Alma back office
   */
  private async testCustomLabel(): Promise<void> {
    console.log('🧪 ResearchAssistantCustomizer: TESTING custom label access...');

    const customLabelKey = 'nde-custom-label-test';

    try {
      // Wait a bit for TranslateService to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await this.translateService.get(customLabelKey).toPromise();

      console.log('🧪 TEST RESULT - Custom label key:', customLabelKey);
      console.log('🧪 TEST RESULT - Returned value:', result);

      if (result && result !== customLabelKey) {
        console.log('✅ SUCCESS! Custom labels work! Value:', result);
        console.log('✅ You can now use custom Alma code table labels for translations');
      } else {
        console.warn('⚠️ Custom label returned the key itself (not translated)');
        console.warn('⚠️ Either: (1) Label not found in Alma, (2) TranslateService not ready, or (3) Need different key format');
      }
    } catch (error) {
      console.error('🧪 TEST ERROR:', error);
    }
  }

  /**
   * Detect current language from URL parameters
   */
  private detectLanguage(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');
    this.currentLanguage = lang === 'he' || lang === 'he_IL' ? 'he' : 'en';

    console.log('🟣 ResearchAssistantCustomizer: Detected language:', this.currentLanguage);
  }

  /**
   * Attempt to load translations from TranslateService (Alma labels)
   */
  private async loadTranslations(): Promise<void> {
    console.log('🟣 ResearchAssistantCustomizer: Attempting to use TranslateService');

    if (!this.translateService) {
      console.warn('🟣 ResearchAssistantCustomizer: TranslateService not available');
      return;
    }

    try {
      const [firstLine, secondLine] = await Promise.all([
        this.translateService.get(this.LABEL_KEYS.firstLine).toPromise(),
        this.translateService.get(this.LABEL_KEYS.secondLine).toPromise()
      ]);

      console.log('🟣 ResearchAssistantCustomizer: Translation results:', {
        firstLine: firstLine?.substring(0, 50),
        secondLine: secondLine?.substring(0, 50)
      });

      // Check if we got actual translations (not just the keys back)
      if (firstLine && firstLine !== this.LABEL_KEYS.firstLine &&
          secondLine && secondLine !== this.LABEL_KEYS.secondLine) {
        console.log('✅ ResearchAssistantCustomizer: TranslateService WORKS! Using Alma labels');
        this.usingTranslateService = true;
      } else {
        console.warn('⚠️ ResearchAssistantCustomizer: TranslateService returned keys, using fallback');
      }
    } catch (error) {
      console.error('🟣 ResearchAssistantCustomizer: Error using TranslateService:', error);
    }
  }

  /**
   * Get the translated text for first line
   */
  private getFirstLine(): string {
    if (this.usingTranslateService) {
      return this.translateService.instant(this.LABEL_KEYS.firstLine);
    }
    return this.fallbackTranslations.firstLine[this.currentLanguage];
  }

  /**
   * Get the translated text for second line
   */
  private getSecondLine(): string {
    if (this.usingTranslateService) {
      return this.translateService.instant(this.LABEL_KEYS.secondLine);
    }
    return this.fallbackTranslations.secondLine[this.currentLanguage];
  }

  /**
   * Start the modification process
   * This runs repeatedly until the element is found and modified
   */
  private startModification(): void {
    console.log('🟣 ResearchAssistantCustomizer: Starting modification process');
    this.modifyText();
  }

  /**
   * Main function to modify the text in the research assistant
   * Finds the shadow DOM and modifies the description paragraph
   * Includes retry logic for timing issues
   */
  private modifyText(): void {
    console.log('🟣 ResearchAssistantCustomizer: Attempt', this.retryCount + 1, 'of', this.MAX_RETRIES);

    // DEBUG: List all custom elements that might be the research assistant
    if (this.retryCount === 0) {
      console.log('🔍 DEBUG: Searching for research assistant element...');
      const allElements = document.querySelectorAll('*');
      const candidates = Array.from(allElements)
        .filter(el => el.tagName.toLowerCase().includes('research') ||
                      el.tagName.toLowerCase().includes('assistant') ||
                      el.tagName.toLowerCase().includes('cdi') ||
                      el.tagName.toLowerCase().includes('nde'))
        .map(el => el.tagName.toLowerCase());
      console.log('🔍 DEBUG: Found elements containing research/assistant/cdi/nde:', [...new Set(candidates)]);
    }

    // Try multiple possible selectors
    const assistant = document.querySelector('nde-research-assistant') ||
                      document.querySelector('cdi-research-assistant') ||
                      document.querySelector('prm-research-assistant') ||
                      document.querySelector('[class*="research-assistant"]');

    console.log('🟣 ResearchAssistantCustomizer: Found research assistant element:', !!assistant);
    if (assistant) {
      console.log('🟣 ResearchAssistantCustomizer: Element tag name:', (assistant as HTMLElement).tagName);
    }

    if (!assistant) {
      console.log('🟣 ResearchAssistantCustomizer: Research assistant not found, will retry...');
      this.scheduleRetry();
      return;
    }

    // Access shadow DOM
    const shadow = (assistant as any).shadowRoot as ShadowRoot | null;
    console.log('🟣 ResearchAssistantCustomizer: Found shadow DOM:', !!shadow);

    if (!shadow) {
      console.log('🟣 ResearchAssistantCustomizer: Shadow DOM not found, will retry...');
      this.scheduleRetry();
      return;
    }

    // Find the description paragraph
    // Try multiple selectors to be resilient
    const paragraph = shadow.querySelector('p.text-xl.mt-3.prose') ||
                      shadow.querySelector('p.text-xl.mt-3') ||
                      shadow.querySelector('p.text-xl');
    console.log('🟣 ResearchAssistantCustomizer: Found paragraph:', !!paragraph);

    if (!paragraph) {
      console.log('🟣 ResearchAssistantCustomizer: Target paragraph not found, will retry...');
      this.scheduleRetry();
      return;
    }

    console.log('🟣 ResearchAssistantCustomizer: Found target paragraph! Modifying...');

    // Get the translated text
    const firstLineText = this.getFirstLine();
    const secondLineText = this.getSecondLine();

    console.log('🟣 ResearchAssistantCustomizer: Using translations:', {
      firstLine: firstLineText.substring(0, 50) + '...',
      secondLine: secondLineText.substring(0, 50) + '...',
      usingTranslateService: this.usingTranslateService
    });

    // Check if we already modified this (to avoid modifying multiple times)
    const existingStyle = shadow.querySelector('#tau-ra-custom-styles');
    if (existingStyle) {
      console.log('🟣 ResearchAssistantCustomizer: Already modified, skipping');
      return;
    }

    // Create and inject styles
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
    shadow.appendChild(styleSheet);

    // Create the new content structure
    const wrapper = document.createElement('div');
    const firstSpan = document.createElement('span');
    const secondSpan = document.createElement('span');

    firstSpan.className = 'tau-ra-first-part';
    secondSpan.className = 'tau-ra-second-part';

    firstSpan.textContent = firstLineText;
    secondSpan.textContent = secondLineText;

    wrapper.appendChild(firstSpan);
    wrapper.appendChild(secondSpan);

    // Replace paragraph content
    paragraph.innerHTML = '';
    paragraph.appendChild(wrapper);

    console.log('✅ ResearchAssistantCustomizer: Modification completed successfully!');
  }

  /**
   * Schedule a retry attempt with exponential backoff
   */
  private scheduleRetry(): void {
    this.retryCount++;

    if (this.retryCount >= this.MAX_RETRIES) {
      console.error('🟣 ResearchAssistantCustomizer: Max retries reached, giving up');
      return;
    }

    // Exponential backoff: 500ms, 1s, 2s, 4s, etc.
    const delay = Math.min(500 * Math.pow(2, this.retryCount - 1), 5000);
    console.log(`🟣 ResearchAssistantCustomizer: Scheduling retry in ${delay}ms`);

    this.retryTimeout = window.setTimeout(() => {
      this.modifyText();
    }, delay);
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }
}
