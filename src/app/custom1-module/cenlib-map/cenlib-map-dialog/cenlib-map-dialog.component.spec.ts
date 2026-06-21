import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { CenlibMapDialogComponent, CenlibMapDialogData } from './cenlib-map-dialog.component';
import { ShelfMapping } from '../config/shelf-mapping.config';

/** Build a minimal ShelfMapping for tests */
function mapping(svgCode: string, floor: string, rangeStart = '100', rangeEnd = '200'): ShelfMapping {
  return {
    libraryName: 'Central Library',
    collectionName: 'Main',
    rangeStart,
    rangeEnd,
    svgCode,
    description: `desc-${svgCode}`,
    floor,
  };
}

describe('CenlibMapDialogComponent', () => {
  let component: CenlibMapDialogComponent;

  const dialogData: CenlibMapDialogData = {
    callNumber: '150',
    rawCallNumber: '150 ABC',
    libraryName: 'Central Library',
    collectionName: 'Main',
    svgPath: 'https://cdn.example.com/maps/floor_1.svg',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CenlibMapDialogComponent, HttpClientTestingModule],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    });
    const fixture = TestBed.createComponent(CenlibMapDialogComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('scopeToPrimaryFloor (Issue #12)', () => {
    it('returns an empty array unchanged', () => {
      expect(component.scopeToPrimaryFloor([])).toEqual([]);
    });

    it('passes single-floor matches through unchanged (the valid case)', () => {
      const spy = spyOn(console, 'error');
      const input = [mapping('A1', '1'), mapping('A2', '1'), mapping('A3', '1')];
      const result = component.scopeToPrimaryFloor(input);
      expect(result.length).toBe(3);
      expect(result.map((m) => m.svgCode)).toEqual(['A1', 'A2', 'A3']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('passes matches with no floor data through unchanged', () => {
      const spy = spyOn(console, 'error');
      const input = [mapping('A1', ''), mapping('A2', '')];
      const result = component.scopeToPrimaryFloor(input);
      expect(result.length).toBe(2);
      expect(spy).not.toHaveBeenCalled();
    });

    it('scopes to the primary floor when matches span floors (data error)', () => {
      const spy = spyOn(console, 'error');
      const input = [
        mapping('A1', '1'),
        mapping('B1', '2'),
        mapping('A2', '1'),
        mapping('C1', '3'),
      ];
      const result = component.scopeToPrimaryFloor(input);
      // Primary floor is the first mapping's floor ('1')
      expect(result.map((m) => m.svgCode)).toEqual(['A1', 'A2']);
      expect(result.every((m) => m.floor === '1')).toBe(true);
      // Logged loudly so staff can fix the mapping data
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not pass off-floor codes downstream after scoping', () => {
      spyOn(console, 'error');
      component.mappings = component.scopeToPrimaryFloor([
        mapping('A1', '1'),
        mapping('B1', '2'),
      ]);
      component.svgCodes = component.mappings.map((m) => m.svgCode);
      expect(component.allSvgCodes).toEqual(['A1']);
    });
  });
});
