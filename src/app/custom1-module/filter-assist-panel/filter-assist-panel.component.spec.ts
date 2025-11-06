import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterAssistPanelComponent } from './filter-assist-panel.component';

describe('FilterAssistPanelComponent', () => {
  let component: FilterAssistPanelComponent;
  let fixture: ComponentFixture<FilterAssistPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterAssistPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterAssistPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
