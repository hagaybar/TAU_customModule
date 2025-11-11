/**
 * NDE Translation Infrastructure Inspector
 *
 * Usage:
 * 1. Open your NDE instance in the browser (preferably on a no-results page)
 * 2. Open browser DevTools Console (F12)
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter to run
 * 5. Copy the results and share them
 */

(function() {
  console.log('🔍 NDE Translation Infrastructure Inspector\n');
  console.log('='.repeat(60));

  const results = {
    translationServices: [],
    globalObjects: [],
    translatedElements: [],
    networkFiles: [],
    angularComponents: [],
    recommendations: []
  };

  // ========================================
  // 1. Check for Translation Services in Angular Injector
  // ========================================
  console.log('\n📦 1. Checking Angular Injector for Translation Services...\n');

  const serviceNames = [
    'TranslateService',
    'TranslationService',
    'PrimoTranslateService',
    'NdeTranslateService',
    'I18nService',
    'LocalizationService'
  ];

  // Find any Angular element to get injector
  const ndeElements = [
    document.querySelector('nde-search-no-results'),
    document.querySelector('nde-search-results'),
    document.querySelector('nde-header'),
    document.querySelector('[data-qa]'),
    document.querySelector('tau-filter-assist-panel')
  ].filter(Boolean);

  if (ndeElements.length > 0 && typeof ng !== 'undefined') {
    try {
      const injector = ng.getInjector(ndeElements[0]);

      serviceNames.forEach(serviceName => {
        try {
          const service = injector.get(serviceName);
          if (service) {
            results.translationServices.push({
              name: serviceName,
              methods: Object.getOwnPropertyNames(Object.getPrototypeOf(service)),
              found: true
            });
            console.log(`✅ Found: ${serviceName}`);
            console.log(`   Methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(service)).slice(0, 10));
          }
        } catch (e) {
          // Service not found, skip
        }
      });

      if (results.translationServices.length === 0) {
        console.log('❌ No translation services found in injector');
      }
    } catch (e) {
      console.log('❌ Could not access Angular injector:', e.message);
    }
  } else {
    console.log('❌ No Angular elements found or ng global not available');
  }

  // ========================================
  // 2. Check Global Objects
  // ========================================
  console.log('\n🌐 2. Checking Global Objects...\n');

  const globalChecks = [
    'primo',
    'appConfig',
    'nde',
    '__PRIMO__',
    'primoTranslations',
    'translations'
  ];

  globalChecks.forEach(name => {
    if (window[name]) {
      results.globalObjects.push({
        name: name,
        type: typeof window[name],
        keys: Object.keys(window[name]).slice(0, 20)
      });
      console.log(`✅ Found: window.${name}`);
      console.log(`   Type: ${typeof window[name]}`);
      console.log(`   Keys:`, Object.keys(window[name]).slice(0, 10));
    }
  });

  // Check for translate-related globals
  const translateGlobals = Object.keys(window).filter(k =>
    k.toLowerCase().includes('translate') ||
    k.toLowerCase().includes('i18n') ||
    k.toLowerCase().includes('locale')
  );

  if (translateGlobals.length > 0) {
    console.log(`\n📝 Found translate-related globals:`, translateGlobals);
    results.globalObjects.push({
      name: 'translate-related-globals',
      keys: translateGlobals
    });
  }

  // ========================================
  // 3. Inspect Translated Elements
  // ========================================
  console.log('\n🏷️  3. Inspecting Translated Elements...\n');

  // Look for elements with translate attributes or translation keys
  const selectors = [
    '[translate]',
    '[data-translate]',
    '[translate-attr]',
    '.no-record-found',
    '[data-qa="no-search-results"]',
    'nde-search-no-results'
  ];

  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach((el, index) => {
        const info = {
          selector: selector,
          index: index,
          textContent: el.textContent?.trim().substring(0, 100),
          attributes: {}
        };

        // Get all attributes
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.includes('translate') || attr.name.includes('aria') || attr.name.startsWith('data-')) {
            info.attributes[attr.name] = attr.value;
          }
        });

        if (Object.keys(info.attributes).length > 0 || info.textContent) {
          results.translatedElements.push(info);
          console.log(`✅ Element: ${selector} [${index}]`);
          console.log(`   Text: ${info.textContent}`);
          console.log(`   Attributes:`, info.attributes);
        }
      });
    }
  });

  // ========================================
  // 4. Check for Translation Files in Network
  // ========================================
  console.log('\n🌐 4. Checking Network Resources...\n');
  console.log('⚠️  Check Network tab manually for:');
  console.log('   - Files containing: i18n, translate, labels, en.json, he.json');
  console.log('   - Look in XHR/Fetch filters');

  // We can't directly access network tab from console, but we can check what's loaded
  const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean);
  const stylesheets = Array.from(document.styleSheets).map(s => s.href).filter(Boolean);

  const relevantResources = [...scripts, ...stylesheets].filter(url =>
    url.includes('i18n') ||
    url.includes('translate') ||
    url.includes('locale') ||
    url.includes('labels')
  );

  if (relevantResources.length > 0) {
    console.log('📄 Found relevant resources:');
    relevantResources.forEach(url => console.log(`   - ${url}`));
    results.networkFiles = relevantResources;
  }

  // ========================================
  // 5. Inspect Custom Components
  // ========================================
  console.log('\n🧩 5. Inspecting Custom Angular Components...\n');

  const customSelectors = [
    'tau-filter-assist-panel',
    'nde-search-no-results',
    'nde-search-results'
  ];

  customSelectors.forEach(selector => {
    const el = document.querySelector(selector);
    if (el && typeof ng !== 'undefined') {
      try {
        const component = ng.getComponent(el);
        const injector = ng.getInjector(el);

        results.angularComponents.push({
          selector: selector,
          componentExists: !!component,
          injectorExists: !!injector
        });

        console.log(`✅ Component: ${selector}`);
        if (component) {
          console.log(`   Properties:`, Object.keys(component).slice(0, 10));
        }
      } catch (e) {
        console.log(`❌ Could not inspect ${selector}:`, e.message);
      }
    }
  });

  // ========================================
  // 6. Generate Recommendations
  // ========================================
  console.log('\n💡 6. Analysis & Recommendations\n');

  if (results.translationServices.length > 0) {
    results.recommendations.push('✅ Translation service found! You can inject and use it in components.');
    console.log('✅ Translation service found! You can inject and use it in components.');
  } else {
    results.recommendations.push('❌ No translation service detected. May need to use alternative method.');
    console.log('❌ No translation service detected. May need to use alternative method.');
  }

  if (results.translatedElements.length > 0) {
    const hasTranslateAttr = results.translatedElements.some(el =>
      Object.keys(el.attributes).some(attr => attr.includes('translate'))
    );
    if (hasTranslateAttr) {
      results.recommendations.push('✅ Found translate attributes in use. Check what directive/pipe handles them.');
      console.log('✅ Found translate attributes in use. Check what directive/pipe handles them.');
    }
  }

  if (results.globalObjects.length > 0) {
    results.recommendations.push('✅ Global translation objects found. Inspect them for translation data.');
    console.log('✅ Global translation objects found. Inspect them for translation data.');
  }

  // ========================================
  // 7. Output Summary
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log('Translation Services Found:', results.translationServices.length);
  console.log('Global Objects Found:', results.globalObjects.length);
  console.log('Translated Elements Found:', results.translatedElements.length);
  console.log('Network Resources Found:', results.networkFiles.length);
  console.log('Angular Components Inspected:', results.angularComponents.length);

  console.log('\n' + '='.repeat(60));
  console.log('\n💾 Full results object available as: window.ndeTranslationInspectorResults');
  console.log('📋 To export: copy(JSON.stringify(window.ndeTranslationInspectorResults, null, 2))');

  // Store results globally for easy access
  window.ndeTranslationInspectorResults = results;

  return results;
})();
