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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FLOOR_LAYOUT, FloorData } from '../config/floor-layout.config';
import { assetBaseUrl } from '../../../state/asset-base.generated';
import { AWS_CDN_BASE_URL } from '../config/data-source.config';

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
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
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

  /** Zoom state properties */
  zoomLevel: number = 1;
  readonly minZoom: number = 0.5;
  readonly maxZoom: number = 3;
  readonly zoomStep: number = 0.25;

  /** Pan state properties */
  isPanning: boolean = false;
  panStartX: number = 0;
  panStartY: number = 0;
  panOffsetX: number = 0;
  panOffsetY: number = 0;
  private lastPanOffsetX: number = 0;
  private lastPanOffsetY: number = 0;

  /** Subscription cleanup */
  private svgSubscription: Subscription | null = null;

  /** Mapping from floor number to local SVG filename for fallback */
  private readonly LOCAL_SVG_MAP: Record<string, string> = {
    '0': 'Floor_0.svg',
    '1': 'Floor_1.SVG',
    '2': 'Floor_2.SVG'
  };

  /**
   * Code set currently painted onto the live SVG, or null when none has been
   * applied yet (fresh SVG). Used to skip redundant re-paints of the *same*
   * codes while still re-applying when the code set genuinely changes.
   */
  private appliedHighlightCodes: string[] | null = null;

  /** Cached highlighted codes to detect real changes (gates ngOnChanges scheduling) */
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
    this.appliedHighlightCodes = null;  // Reset for new SVG: force a re-paint even if codes are unchanged

    // Use absolute URL directly if provided, otherwise construct from asset base URL
    const isAbsoluteUrl = this.svgPath.startsWith('http://') || this.svgPath.startsWith('https://');
    const fullPath = isAbsoluteUrl ? this.svgPath : `${assetBaseUrl}/${this.svgPath}`;
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

          // Try fallback for CloudFront URLs
          const fallbackPath = this.getFallbackSvgPath(fullPath);
          if (fallbackPath) {
            console.log('[ShelfMapSvg] Trying fallback local SVG:', fallbackPath);
            const fallbackUrl = `${assetBaseUrl}/${fallbackPath}`;
            this.loadSvgFromUrl(fallbackUrl, true);
            return;
          }

          this.hasError = true;
          this.isLoading = false;
          this.useExternalSvg = false;
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Load SVG from a specific URL (used for both primary and fallback loading)
   */
  private loadSvgFromUrl(url: string, isFallback: boolean = false): void {
    this.svgSubscription?.unsubscribe();
    this.svgSubscription = this.http
      .get(url, { responseType: 'text' })
      .subscribe({
        next: (svgContent) => {
          const fixedSvgContent = this.fixSvgForScaling(svgContent);
          console.log(`[ShelfMapSvg] SVG loaded successfully${isFallback ? ' (fallback)' : ''} (${svgContent.length} bytes)`);
          this.externalSvgContent = this.sanitizer.bypassSecurityTrustHtml(fixedSvgContent);
          this.isLoading = false;
          this.cdr.detectChanges();
          setTimeout(() => this.applyHighlighting(), 50);
        },
        error: (error) => {
          console.error(`[ShelfMapSvg] Failed to load SVG${isFallback ? ' (fallback)' : ''}:`, error);
          this.hasError = true;
          this.isLoading = false;
          this.useExternalSvg = false;
          this.cdr.detectChanges();
        }
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
   * Find shelf element by exact id match only.
   *
   * Exact match mirrors the Primo Maps producer's bundle invariant
   * (validateBundle.mjs: `set.has(svgCode)`). A fuzzy cl1_↔cl_ fallback used to
   * live here, but empirically no committed mapping row needs it, and rescuing a
   * near-miss onto a *different* shelf would silently mask producer↔consumer
   * drift the invariant exists to surface. A genuine miss is reported via the
   * "Shelf(s) not found" warning in applyHighlighting(). See issue #13.
   */
  private findShelfElement(container: HTMLElement, code: string): SVGElement | null {
    return container.querySelector(`#${CSS.escape(code)}`) as SVGElement | null;
  }

  /**
   * Apply highlighting to shelf elements in external SVG
   */
  private applyHighlighting(): void {
    if (!this.svgContainer?.nativeElement) return;

    const container = this.svgContainer.nativeElement as HTMLElement;
    const codes = this.allHighlightedCodes;

    // Skip only a redundant re-paint of the *same* code set on the same SVG;
    // a genuine code change (or a fresh SVG, where appliedHighlightCodes is null)
    // still falls through and re-highlights.
    if (this.appliedHighlightCodes && this.arraysEqual(codes, this.appliedHighlightCodes)) {
      return;
    }

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

    this.appliedHighlightCodes = [...codes];
  }

  /** Helper to compare two string arrays */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => val === sortedB[i]);
  }

  /**
   * Extract floor number from CloudFront URL and return fallback local SVG path
   */
  private getFallbackSvgPath(originalUrl: string): string | null {
    if (!originalUrl.includes(AWS_CDN_BASE_URL)) {
      return null;
    }
    const floorMatch = originalUrl.match(/floor_(\d+)\.svg/i);
    if (!floorMatch) {
      return null;
    }
    const floorNum = floorMatch[1];
    const localFile = this.LOCAL_SVG_MAP[floorNum];
    if (!localFile) {
      return null;
    }
    return `assets/cenlib-map/${localFile}`;
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

  // ===== Zoom Control Methods =====

  /** Zoom in by one step */
  zoomIn(): void {
    if (this.zoomLevel < this.maxZoom) {
      this.zoomLevel = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
    }
  }

  /** Zoom out by one step */
  zoomOut(): void {
    if (this.zoomLevel > this.minZoom) {
      this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
    }
  }

  /** Reset zoom to default level */
  resetZoom(): void {
    this.zoomLevel = 1;
    this.resetPan();
  }

  // ===== Pan Control Methods =====

  /** Reset pan offset to center */
  private resetPan(): void {
    this.panOffsetX = 0;
    this.panOffsetY = 0;
    this.lastPanOffsetX = 0;
    this.lastPanOffsetY = 0;
  }

  /** Handle pan start (mouse down or touch start) */
  onPanStart(event: MouseEvent | TouchEvent): void {
    // Only allow panning when zoomed in
    if (this.zoomLevel <= 1) return;

    this.isPanning = true;

    if (event instanceof MouseEvent) {
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
    } else if (event.touches && event.touches.length === 1) {
      this.panStartX = event.touches[0].clientX;
      this.panStartY = event.touches[0].clientY;
    }

    // Store the current offset as the base for this drag
    this.lastPanOffsetX = this.panOffsetX;
    this.lastPanOffsetY = this.panOffsetY;
  }

  /** Handle pan move (mouse move or touch move) */
  onPanMove(event: MouseEvent | TouchEvent): void {
    if (!this.isPanning) return;

    let currentX: number;
    let currentY: number;

    if (event instanceof MouseEvent) {
      currentX = event.clientX;
      currentY = event.clientY;
    } else if (event.touches && event.touches.length === 1) {
      currentX = event.touches[0].clientX;
      currentY = event.touches[0].clientY;
      // Prevent scrolling on touch devices while panning
      event.preventDefault();
    } else {
      return;
    }

    // Calculate the delta from the start position
    const deltaX = currentX - this.panStartX;
    const deltaY = currentY - this.panStartY;

    // Apply the delta to the last stored offset
    this.panOffsetX = this.lastPanOffsetX + deltaX;
    this.panOffsetY = this.lastPanOffsetY + deltaY;
  }

  /** Handle pan end (mouse up or touch end) */
  onPanEnd(): void {
    this.isPanning = false;
  }

  /** Get the transform style string for the map content */
  get mapTransform(): string {
    return `translate(${this.panOffsetX}px, ${this.panOffsetY}px) scale(${this.zoomLevel})`;
  }

  // ===== Zoom Control Labels (Bilingual) =====

  /** Get "Zoom in" label based on language */
  get zoomInLabel(): string {
    return this.language === 'he' ? 'הגדלה' : 'Zoom in';
  }

  /** Get "Zoom out" label based on language */
  get zoomOutLabel(): string {
    return this.language === 'he' ? 'הקטנה' : 'Zoom out';
  }

  /** Get "Full map" label based on language */
  get fullMapLabel(): string {
    return this.language === 'he' ? 'כל המפה' : 'Full map';
  }
}
