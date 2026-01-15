import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FLOOR_LAYOUT, FloorData } from '../config/floor-layout.config';

/**
 * SVG Shelf Map Component
 * Displays a visual floor map with shelf rectangles
 * Highlights the shelf matching the provided shelf code
 *
 * Phase 4: SVG Shelf Map Visualization
 */
@Component({
  selector: 'tau-shelf-map-svg',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './shelf-map-svg.component.html',
  styleUrls: ['./shelf-map-svg.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShelfMapSvgComponent implements OnChanges {
  /** The shelf code to highlight (e.g., 'SHELF-15') */
  @Input() highlightedShelfCode: string | null = null;

  /** Initial floor to display (auto-set based on highlighted shelf) */
  @Input() initialFloor: string = '1';

  /** Current language for labels */
  @Input() language: 'en' | 'he' = 'en';

  /** Currently selected floor */
  selectedFloor: string = '1';

  /** Floor layout data */
  floors: FloorData[] = FLOOR_LAYOUT;

  ngOnChanges(changes: SimpleChanges): void {
    // Auto-select floor when highlighted shelf changes
    if (changes['initialFloor'] || changes['highlightedShelfCode']) {
      this.selectedFloor = this.initialFloor || '1';
    }
  }

  /** Select a floor to display */
  selectFloor(floor: string): void {
    this.selectedFloor = floor;
  }

  /** Check if a shelf should be highlighted */
  isHighlighted(shelfId: string): boolean {
    return this.highlightedShelfCode === shelfId;
  }

  /** Get the current floor data */
  get currentFloorData(): FloorData | undefined {
    return this.floors.find((f) => f.floor === this.selectedFloor);
  }

  /** Get floor label based on language */
  getFloorLabel(floor: FloorData): string {
    return this.language === 'he' ? floor.labelHe : floor.label;
  }

  /** Check if a floor has the highlighted shelf */
  floorHasHighlight(floor: FloorData): boolean {
    if (!this.highlightedShelfCode) return false;
    return floor.shelves.some((s) => s.id === this.highlightedShelfCode);
  }

  /** Get shelf text X position (centered in rect) */
  getShelfTextX(shelfX: number): number {
    return shelfX + 30;
  }

  /** Get shelf text Y position (centered in rect) */
  getShelfTextY(shelfY: number): number {
    return shelfY + 30;
  }

  /** Get shelf display number (without SHELF- prefix) */
  getShelfNumber(shelfId: string): string {
    return shelfId.replace('SHELF-', '');
  }

  /** Get current floor label */
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
