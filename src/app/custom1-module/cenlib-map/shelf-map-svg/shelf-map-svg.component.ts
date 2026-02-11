import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FLOOR_LAYOUT, FloorData } from '../config/floor-layout.config';
import { assetBaseUrl } from '../../../state/asset-base.generated';

/**
 * SVG Shelf Map Component
 * Displays a visual floor map with shelf highlighting
 *
 * Supports two modes:
 * 1. External SVG mode: Loads SVG from svgPath and highlights elements by ID
 * 2. Fallback mode: Uses hardcoded FLOOR_LAYOUT for basic display
 */
@Component({
  selector: 'tau-shelf-map-svg',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatProgressSpinnerModule],
  templateUrl: './shelf-map-svg.component.html',
  styleUrls: ['./shelf-map-svg.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShelfMapSvgComponent implements OnChanges, OnDestroy {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  /** @deprecated Use highlightedShelfCodes instead */
  @Input() highlightedShelfCode: string | null = null;

  /** Multiple shelf codes to highlight (MDM supports overlapping ranges) */
  @Input() highlightedShelfCodes: string[] = [];

  /** Path to library-specific SVG file */
  @Input() svgPath: string | undefined = undefined;

  /** Initial floor to display (auto-set based on highlighted shelf) */
  @Input() initialFloor: string = '1';

  /** Current language for labels */
  @Input() language: 'en' | 'he' = 'en';

  /** Reference to SVG container for external SVG injection */
  @ViewChild('svgContainer', { static: false }) svgContainer!: ElementRef;

  /** Currently selected floor */
  selectedFloor: string = '1';

  /** Floor layout data (fallback mode) */
  floors: FloorData[] = FLOOR_LAYOUT;

  /** Whether using external SVG mode */
  useExternalSvg = false;

  /** External SVG content (sanitized) */
  externalSvgContent: SafeHtml | null = null;

  /** Loading state for external SVG */
  isLoading = false;

  /** Error state */
  hasError = false;

  /** Subscription cleanup */
  private svgSubscription: Subscription | null = null;

  /** Flag to track if highlighting has been applied (prevents redundant calls) */
  private highlightingApplied = false;

  /** Cached highlighted codes to detect real changes */
  private lastHighlightedCodes: string[] = [];

  /** Combined shelf codes (supports both old single input and new array input) */
  private get allHighlightedCodes(): string[] {
    const codes = [...this.highlightedShelfCodes];
    if (this.highlightedShelfCode && !codes.includes(this.highlightedShelfCode)) {
      codes.push(this.highlightedShelfCode);
    }
    return codes;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle svgPath changes - load external SVG
    if (changes['svgPath'] && this.svgPath) {
      this.loadExternalSvg();
    }

    // Auto-select floor when highlighted shelf changes
    if (changes['initialFloor'] || changes['highlightedShelfCode']) {
      this.selectedFloor = this.initialFloor || '1';
    }

    // Re-apply highlighting when codes actually change (for external SVG mode)
    if (
      (changes['highlightedShelfCodes'] || changes['highlightedShelfCode']) &&
      this.useExternalSvg
    ) {
      const newCodes = this.allHighlightedCodes;
      const codesChanged = !this.arraysEqual(newCodes, this.lastHighlightedCodes);
      if (codesChanged) {
        this.lastHighlightedCodes = [...newCodes];
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => this.applyHighlighting(), 0);
      }
    }
  }

  ngOnDestroy(): void {
    this.svgSubscription?.unsubscribe();
  }

  /**
   * Load external SVG file and inject into DOM
   */
  private loadExternalSvg(): void {
    if (!this.svgPath) return;

    this.isLoading = true;
    this.hasError = false;
    this.useExternalSvg = true;
    this.highlightingApplied = false;  // Reset for new SVG

    // Construct full URL using asset base URL
    const fullPath = `${assetBaseUrl}/${this.svgPath}`;
    console.log(`[ShelfMapSvg] Loading SVG from: ${fullPath}`);

    this.svgSubscription?.unsubscribe();
    this.svgSubscription = this.http
      .get(fullPath, { responseType: 'text' })
      .subscribe({
        next: (svgContent) => {
          // Fix SVG for proper scaling: add viewBox if missing
          const fixedSvgContent = this.fixSvgForScaling(svgContent);

          // Sanitize and store SVG content
          console.log(`[ShelfMapSvg] SVG loaded successfully (${svgContent.length} bytes)`);
          this.externalSvgContent = this.sanitizer.bypassSecurityTrustHtml(fixedSvgContent);
          this.isLoading = false;
          this.cdr.detectChanges();

          // Apply highlighting after DOM update
          setTimeout(() => this.applyHighlighting(), 50);
        },
        error: (error) => {
          console.error('[ShelfMapSvg] Failed to load SVG:', error);
          this.hasError = true;
          this.isLoading = false;
          this.useExternalSvg = false; // Fall back to hardcoded layout
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Fix SVG content for proper scaling by adding viewBox if missing
   * and removing overflow="hidden" that prevents proper scaling
   */
  private fixSvgForScaling(svgContent: string): string {
    // Extract width and height from SVG
    const widthMatch = svgContent.match(/width="(\d+)"/);
    const heightMatch = svgContent.match(/height="(\d+)"/);

    if (widthMatch && heightMatch) {
      const width = widthMatch[1];
      const height = heightMatch[1];

      // Check if viewBox already exists
      if (!svgContent.includes('viewBox')) {
        // Add viewBox attribute after the opening <svg tag
        svgContent = svgContent.replace(
          /<svg([^>]*)>/i,
          `<svg$1 viewBox="0 0 ${width} ${height}">`
        );
        console.log(`[ShelfMapSvg] Added viewBox="0 0 ${width} ${height}" to SVG`);
      }
    }

    // Remove overflow="hidden" which clips the SVG instead of scaling
    svgContent = svgContent.replace(/\s*overflow="hidden"/gi, '');

    return svgContent;
  }

  /**
   * Generate alternative ID formats for a given code
   * Handles known mismatches like cl1_106_a → cl_106_a
   */
  private getAlternativeIds(code: string): string[] {
    const alternatives: string[] = [];

    // Pattern: prefix + number + underscore + rest (e.g., cl1_106_a → cl_106_a)
    // Remove number after 2-letter prefix: cl1_ → cl_, ka1_ → ka_, kb1_ → kb_
    const prefixNumberMatch = code.match(/^([a-z]{2})(\d+)_(.+)$/i);
    if (prefixNumberMatch) {
      const [, prefix, , rest] = prefixNumberMatch;
      alternatives.push(`${prefix}_${rest}`);
    }

    // Also try adding a number if missing: cl_ → cl1_
    const noPrefixNumberMatch = code.match(/^([a-z]{2})_(\d+.*)$/i);
    if (noPrefixNumberMatch) {
      const [, prefix, rest] = noPrefixNumberMatch;
      alternatives.push(`${prefix}1_${rest}`);
      alternatives.push(`${prefix}2_${rest}`);
    }

    return alternatives;
  }

  /**
   * Find shelf element by code, trying alternatives if exact match not found
   */
  private findShelfElement(container: HTMLElement, code: string): SVGElement | null {
    // Try exact match first
    let shelf = container.querySelector(`#${CSS.escape(code)}`) as SVGElement;
    if (shelf) return shelf;

    // Try alternative ID formats
    const alternatives = this.getAlternativeIds(code);
    for (const altCode of alternatives) {
      shelf = container.querySelector(`#${CSS.escape(altCode)}`) as SVGElement;
      if (shelf) {
        console.log(`[ShelfMapSvg] Found shelf using alternative ID: ${code} → ${altCode}`);
        return shelf;
      }
    }

    return null;
  }

  /**
   * Apply highlighting to shelf elements in external SVG
   */
  private applyHighlighting(): void {
    if (!this.svgContainer?.nativeElement) return;
    if (this.highlightingApplied) return;  // Prevent redundant calls

    const container = this.svgContainer.nativeElement as HTMLElement;
    const codes = this.allHighlightedCodes;

    // Log available shelf IDs once for debugging (only IDs that look like shelf codes)
    const allElements = container.querySelectorAll('[id]');
    const shelfIds = Array.from(allElements)
      .map(el => el.id)
      .filter(id => /^[a-z]{2,3}[0-9]?_/i.test(id) || id.startsWith('shelf_'))
      .slice(0, 20); // Limit to first 20 for brevity
    if (shelfIds.length > 0) {
      console.log(`[ShelfMapSvg] Sample shelf-like IDs in SVG:`, shelfIds);
    }

    // Reset all previously highlighted elements (broader selector)
    const allHighlighted = container.querySelectorAll('.highlighted');
    allHighlighted.forEach((el) => {
      (el as SVGElement).style.fill = '';
      (el as SVGElement).style.stroke = '';
      (el as SVGElement).style.strokeWidth = '';
      el.classList.remove('highlighted');
    });

    // Apply highlighting to matching shelves
    const highlightedShelves: string[] = [];
    const missingShelves: string[] = [];

    codes.forEach((code) => {
      const shelf = this.findShelfElement(container, code);
      if (shelf) {
        shelf.style.fill = '#f44336'; // Red highlight
        shelf.style.stroke = '#b71c1c';
        shelf.style.strokeWidth = '3';
        shelf.classList.add('highlighted');
        highlightedShelves.push(code);
      } else {
        missingShelves.push(code);
      }
    });

    // Log once with summary
    if (highlightedShelves.length > 0) {
      console.log(`[ShelfMapSvg] Highlighted ${highlightedShelves.length} shelf(s):`, highlightedShelves);
    }
    if (missingShelves.length > 0) {
      console.warn(`[ShelfMapSvg] Shelf(s) not found (no matching ID in SVG):`, missingShelves);
    }

    this.highlightingApplied = true;
  }

  /** Helper to compare two string arrays */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => val === sortedB[i]);
  }

  /** Select a floor to display (fallback mode) */
  selectFloor(floor: string): void {
    this.selectedFloor = floor;
  }

  /** Check if a shelf should be highlighted (fallback mode) */
  isHighlighted(shelfId: string): boolean {
    return this.allHighlightedCodes.includes(shelfId);
  }

  /** Get the current floor data (fallback mode) */
  get currentFloorData(): FloorData | undefined {
    return this.floors.find((f) => f.floor === this.selectedFloor);
  }

  /** Get floor label based on language (fallback mode) */
  getFloorLabel(floor: FloorData): string {
    return this.language === 'he' ? floor.labelHe : floor.label;
  }

  /** Check if a floor has any of the highlighted shelves (fallback mode) */
  floorHasHighlight(floor: FloorData): boolean {
    const codes = this.allHighlightedCodes;
    if (codes.length === 0) return false;
    return floor.shelves.some((s) => codes.includes(s.id));
  }

  /** Get shelf text X position (fallback mode) */
  getShelfTextX(shelfX: number): number {
    return shelfX + 30;
  }

  /** Get shelf text Y position (fallback mode) */
  getShelfTextY(shelfY: number): number {
    return shelfY + 30;
  }

  /** Get shelf display number (fallback mode) */
  getShelfNumber(shelfId: string): string {
    return shelfId.replace('SHELF-', '');
  }

  /** Get current floor label (fallback mode) */
  get currentFloorLabel(): string {
    return this.currentFloorData ? this.getFloorLabel(this.currentFloorData) : '';
  }

  /** Get shelves label based on language */
  get shelvesLabel(): string {
    return this.language === 'he' ? 'מדפים' : 'Shelves';
  }

  /** Get your book label based on language */
  get yourBookLabel(): string {
    return this.language === 'he' ? 'מיקום הספר' : 'Your book';
  }
}
