/**
 * Quick check: Can we access translation data programmatically?
 * Paste into browser console
 */

(function() {
  console.log('🔍 Searching for Translation Data...\n');

  // 1. Check if we can read the translated text from existing elements
  const translatedElement = document.querySelector('[translate="nui.noresults.suggestions"]');
  if (translatedElement) {
    console.log('✅ Found translated element:');
    console.log('   Key:', translatedElement.getAttribute('translate'));
    console.log('   Rendered text:', translatedElement.textContent);
  }

  // 2. Look for translation data in window
  const searchPatterns = [
    'i18n',
    'translations',
    'labels',
    'locale',
    'nui'
  ];

  console.log('\n🌐 Searching window object...\n');

  function searchObject(obj, path = 'window', depth = 0, maxDepth = 3) {
    if (depth > maxDepth || !obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();
      const matches = searchPatterns.some(pattern => lowerKey.includes(pattern));

      if (matches) {
        console.log(`✅ Found: ${path}.${key}`);
        console.log(`   Type: ${typeof obj[key]}`);

        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const keys = Object.keys(obj[key]).slice(0, 5);
          console.log(`   Sample keys:`, keys);

          // Check if it looks like translation data
          if (keys.some(k => k.includes('nui') || k.includes('.'))) {
            console.log(`   🎯 This might be translation data!`);
            console.log(`   Sample:`, JSON.stringify(obj[key], null, 2).substring(0, 200));
          }
        }
      }

      // Recurse
      if (depth < maxDepth && typeof obj[key] === 'object' && obj[key] !== null) {
        try {
          searchObject(obj[key], `${path}.${key}`, depth + 1, maxDepth);
        } catch (e) {
          // Skip circular references
        }
      }
    });
  }

  searchObject(window);

  // 3. Check for Angular injector (even if ng.getInjector doesn't work)
  console.log('\n📦 Checking for angular module...\n');

  if (window.angular) {
    console.log('✅ AngularJS (angular) is available!');
    console.log('   Version:', window.angular.version);

    // Try to get injector
    try {
      const appElement = document.querySelector('[ng-app], [data-ng-app]');
      if (appElement) {
        const injector = window.angular.element(appElement).injector();
        console.log('✅ Got AngularJS injector');

        // Try to get translation service
        const serviceNames = ['$translate', 'translateService', '$filter'];
        serviceNames.forEach(name => {
          try {
            const service = injector.get(name);
            console.log(`   ✅ Found service: ${name}`);
            if (name === '$translate' && service.instant) {
              console.log('   🎯 Can use $translate.instant(key) to get translations!');

              // Test it
              const testKey = 'nui.noresults.suggestions';
              const translation = service.instant(testKey);
              console.log(`   Test: "${testKey}" => "${translation}"`);
            }
          } catch (e) {
            // Service not found
          }
        });
      }
    } catch (e) {
      console.log('   ❌ Error:', e.message);
    }
  } else {
    console.log('❌ AngularJS not found in window.angular');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Investigation complete!');
})();
