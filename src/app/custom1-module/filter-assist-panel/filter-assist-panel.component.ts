import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tau-filter-assist-panel',
  standalone: true,
  templateUrl: './filter-assist-panel.component.html',
  styleUrls: ['./filter-assist-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterAssistPanelComponent {}
