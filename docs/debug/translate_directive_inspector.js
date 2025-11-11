/**
 * NDE Translate Directive Inspector
 *
 * This script investigates how the [translate] directive works
 * and whether we can use it in custom components
 *
 * Usage: Paste into browser console on NDE page
 */

(function() {
  console.log('🔍 Translate Directive Deep Dive\n');
  console.log('='.repeat(60));

  const results = {
    directiveInfo: null,
    moduleInfo: null,
    pipeInfo: null,
    usageExamples: []
  };

  // ========================================
  // 1. Find an element with translate attribute
  // ========================================
  console.log('\n📍 1. Inspecting Translate Directive Usage...\n');

  const translateEl = document.querySelector('[translate]');
  if (translateEl) {
    console.log('✅ Found element with [translate] attribute:');
    console.log('   Element:', translateEl.tagName);
    console.log('   Translate key:', translateEl.getAttribute('translate'));
    console.log('   Text content:', translateEl.textContent.trim());

    results.usageExamples.push({
      element: translateEl.tagName,
      translateKey: translateEl.getAttribute('translate'),
      textContent: translateEl.textContent.trim()
    });

    // Check for other translate-related attributes
    const attrs = Array.from(translateEl.attributes)
      .filter(attr => attr.name.includes('translate') || attr.name.includes('aria'))
      .map(attr => ({ name: attr.name, value: attr.value }));

    console.log('   Related attributes:', attrs);

    // Get Angular component info if available
    if (typeof ng !== 'undefined') {
      try {
        const component = ng.getComponent(translateEl);
        const injector = ng.getInjector(translateEl);

        console.log('\n📦 Angular Context:');
        console.log('   Component:', component ? 'Found' : 'Not found');
        console.log('   Injector:', injector ? 'Found' : 'Not found');

        // Try to get directives on the element
        try {
          const directives = ng.getDirectives(translateEl);
          if (directives && directives.length > 0) {
            console.log('   Directives on element:', directives.length);
            directives.forEach((dir, idx) => {
              console.log(`     [${idx}]:`, dir.constructor.name);
            });
            results.directiveInfo = directives.map(d => d.constructor.name);
          }
        } catch (e) {
          console.log('   Could not get directives:', e.message);
        }
      } catch (e) {
        console.log('   Error inspecting Angular context:', e.message);
      }
    }
  } else {
    console.log('❌ No elements with [translate] attribute found');
  }

  // ========================================
  // 2. Check for translate pipe
  // ========================================
  console.log('\n🔧 2. Checking for Translate Pipe...\n');

  // Search for elements that might use translate pipe
  const allElements = document.querySelectorAll('*');
  let foundPipeUsage = false;

  Array.from(allElements).slice(0, 100).forEach(el => {
    const innerHTML = el.innerHTML;
    if (innerHTML && (innerHTML.includes('| translate') || innerHTML.includes('|translate'))) {
      console.log('✅ Found pipe usage:', el.tagName, innerHTML.substring(0, 100));
      foundPipeUsage = true;
      results.pipeInfo = {
        found: true,
        element: el.tagName,
        sample: innerHTML.substring(0, 100)
      };
    }
  });

  if (!foundPipeUsage) {
    console.log('❌ No translate pipe usage found in rendered DOM');
    console.log('   (This doesn\'t mean it doesn\'t exist - it might be compiled out)');
  }

  // ========================================
  // 3. Check parent element's module context
  // ========================================
  console.log('\n🏗️  3. Checking Parent Component Module...\n');

  const parentElements = [
    'nde-search-no-results',
    'nde-app',
    'nde-root',
    'app-root'
  ];

  parentElements.forEach(selector => {
    const el = document.querySelector(selector);
    if (el && typeof ng !== 'undefined') {
      try {
        const injector = ng.getInjector(el);
        console.log(`✅ Found ${selector}`);

        // Try to get common translation-related tokens
        const tokensToCheck = [
          'LOCALE_ID',
          'TRANSLATIONS',
          'TRANSLATIONS_FORMAT'
        ];

        tokensToCheck.forEach(token => {
          try {
            const value = injector.get(token);
            console.log(`   ${token}:`, value);
            results.moduleInfo = results.moduleInfo || {};
            results.moduleInfo[token] = value;
          } catch (e) {
            // Token not available
          }
        });
      } catch (e) {
        console.log(`❌ Could not inspect ${selector}:`, e.message);
      }
    }
  });

  // ========================================
  // 4. Test translate attribute on custom element
  // ========================================
  console.log('\n🧪 4. Testing Translate Directive on Custom Element...\n');

  // Try to create a test element with translate attribute
  const testDiv = document.createElement('div');
  testDiv.setAttribute('translate', 'nui.noresults.suggestions');
  testDiv.textContent = 'Test Translation';

  // Insert it next to an existing translated element
  if (translateEl && translateEl.parentNode) {
    translateEl.parentNode.insertBefore(testDiv, translateEl.nextSibling);

    console.log('✅ Created test element with translate attribute');
    console.log('   Check the DOM to see if it gets translated');
    console.log('   Look for the element near:', translateEl.tagName);

    setTimeout(() => {
      console.log('\n⏱️  After 1 second:');
      console.log('   Test element text:', testDiv.textContent);
      console.log('   Was it translated?', testDiv.textContent !== 'Test Translation');
    }, 1000);
  }

  // ========================================
  // 5. Search for translation configuration
  // ========================================
  console.log('\n⚙️  5. Searching for Translation Configuration...\n');

  // Check common config locations
  const configChecks = {
    'window.appConfig': window.appConfig,
    'window.primo': window.primo,
    'window.APP_CONFIG': window.APP_CONFIG,
    'window.__PRIMO_CONF__': window.__PRIMO_CONF__
  };

  Object.entries(configChecks).forEach(([path, value]) => {
    if (value) {
      console.log(`✅ Found ${path}`);

      // Look for translation-related keys
      if (typeof value === 'object') {
        const translationKeys = Object.keys(value).filter(k =>
          k.toLowerCase().includes('translate') ||
          k.toLowerCase().includes('i18n') ||
          k.toLowerCase().includes('locale') ||
          k.toLowerCase().includes('lang')
        );

        if (translationKeys.length > 0) {
          console.log('   Translation-related keys:', translationKeys);
          translationKeys.forEach(key => {
            console.log(`     ${key}:`, typeof value[key], value[key]);
          });
        }
      }
    }
  });

  // ========================================
  // 6. Summary and Recommendations
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANALYSIS SUMMARY\n');

  console.log('Translate Directive:', results.directiveInfo ? '✅ Found' : '❓ Not accessible');
  console.log('Translate Pipe:', results.pipeInfo ? '✅ Found' : '❓ Not found');
  console.log('Usage Examples:', results.usageExamples.length);

  console.log('\n💡 RECOMMENDATIONS:\n');

  if (results.usageExamples.length > 0) {
    console.log('✅ Use the [translate] attribute in your templates:');
    console.log('   <span translate="nui.aria.noresults.externalsearch.title"></span>');
    console.log('   <span translate="your.custom.key">Fallback Text</span>');
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Check if test element was translated (look in DOM)');
  console.log('2. Try adding translate attribute to your custom component template');
  console.log('3. Configure translation keys in Primo BO under:');
  console.log('   Code Table: Web Labels (or similar)');

  console.log('\n💾 Results saved to: window.translateDirectiveResults');
  console.log('📋 To export: copy(JSON.stringify(window.translateDirectiveResults, null, 2))');

  window.translateDirectiveResults = results;

  return results;
})();
