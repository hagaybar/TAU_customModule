import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    declarations: [AppComponent]
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'custom-module'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('custom-module');
  });

  it('should render the title into the template', () => {
    // Asserts against app.component.html as it actually is:
    //   <p> Custom module test {{getTitle()}}</p>
    // The original assertion here was left over from `ng new` scaffolding — it
    // looked for '.content span' and 'custom-module app is running!', neither of
    // which has existed since the starter template was replaced. It could never
    // pass, so it told us nothing about this component.
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')?.textContent).toContain('Custom module test custom-module');
  });
});
