import {ApplicationRef, DoBootstrap, Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http';
import {AppComponent} from './app.component';
import {createCustomElement, NgElementConstructor} from "@angular/elements";
import {Router} from "@angular/router";
import {selectorComponentMap} from "./custom1-module/customComponentMappings";
import {TranslateModule} from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { AutoAssetSrcDirective } from './services/auto-asset-src.directive';
import {SHELL_ROUTER} from "./injection-tokens";



export const AppModule = ({providers, shellRouter}: {providers:any, shellRouter: Router}) => {
   @NgModule({
    declarations: [
      AppComponent
    ],
    imports: [
      BrowserModule,
      CommonModule,
      HttpClientModule,
      AutoAssetSrcDirective,
      TranslateModule.forRoot({})
    ],
    exports: [AutoAssetSrcDirective],
    providers: [...providers, {provide: SHELL_ROUTER, useValue: shellRouter}],
    bootstrap: []
  })
  class AppModule implements DoBootstrap{
    private webComponentSelectorMap = new Map<string,  NgElementConstructor<unknown>>();

    constructor(
      private injector: Injector,
      private router: Router
    ) {
      router.dispose(); //this prevents the router from being initialized and interfering with the shell app router
    }

    ngDoBootstrap(appRef: ApplicationRef) {
      console.log('🟢 TAU Custom Module: ngDoBootstrap started - Registering components...');
      console.log('🟢 TAU Custom Module: Total components to register:', selectorComponentMap.size);

      for (const [key, value] of selectorComponentMap) {
        console.log(`🟢 TAU Custom Module: Registering component: ${key} -> ${value.name}`);
        const customElement = createCustomElement(value, {injector: this.injector});
        this.webComponentSelectorMap.set(key, customElement);
        console.log(`✅ TAU Custom Module: Successfully registered: ${key}`);
        // NDE framework handles customElements.define() - we just create and store the constructor
      }

      console.log('🟢 TAU Custom Module: ngDoBootstrap completed!');
      console.log('🟢 TAU Custom Module: Registered selectors:', Array.from(this.webComponentSelectorMap.keys()));
    }

    /**
     * Use componentMapping, selectorComponentMap
     * @param componentName
     */
    public getComponentRef(componentName:string) {
      return this.webComponentSelectorMap.get(componentName);
    }
  }
  return AppModule
}
