// Run this script in the browser console on the Research Assistant page
// to investigate the DOM structure and find the paragraph element

console.log('=== RESEARCH ASSISTANT ELEMENT INVESTIGATION ===');

// 1. Find the main research assistant element
const raElement = document.querySelector('nde-research-assistant');
console.log('1. Found nde-research-assistant:', !!raElement);

if (!raElement) {
  console.error('❌ nde-research-assistant not found!');
} else {
  console.log('✅ nde-research-assistant element:', raElement);

  // 2. Check for Shadow DOM
  const shadowRoot = raElement.shadowRoot;
  console.log('2. Has shadowRoot:', !!shadowRoot);

  if (!shadowRoot) {
    console.error('❌ No shadow DOM found!');
    console.log('Trying direct children...');
    console.log('Direct children:', raElement.children);
  } else {
    console.log('✅ Shadow DOM found!');
    console.log('Shadow root mode:', shadowRoot.mode); // 'open' or 'closed'

    // 3. Find app-landing inside shadow DOM
    const appLanding = shadowRoot.querySelector('app-landing');
    console.log('3. Found app-landing:', !!appLanding);

    if (appLanding) {
      console.log('✅ app-landing element:', appLanding);
    }

    // 4. Find the paragraph with our target classes
    const targetParagraph = shadowRoot.querySelector('p.text-xl.mt-3.prose');
    console.log('4. Found target paragraph (p.text-xl.mt-3.prose):', !!targetParagraph);

    if (targetParagraph) {
      console.log('✅ Target paragraph found!');
      console.log('Current text content:', targetParagraph.textContent);
      console.log('Current HTML:', targetParagraph.innerHTML);
      console.log('Parent element:', targetParagraph.parentElement);
      console.log('Parent classes:', targetParagraph.parentElement?.className);
    } else {
      console.warn('⚠️ Target paragraph not found with exact selector');

      // Try broader searches
      console.log('Trying broader searches...');
      const allParagraphs = shadowRoot.querySelectorAll('p');
      console.log('All <p> elements in shadow DOM:', allParagraphs.length);
      allParagraphs.forEach((p, index) => {
        console.log(`  P[${index}]:`, {
          classes: p.className,
          text: p.textContent.substring(0, 50) + '...'
        });
      });

      const textXl = shadowRoot.querySelectorAll('.text-xl');
      console.log('All .text-xl elements:', textXl.length);
      textXl.forEach((el, index) => {
        console.log(`  .text-xl[${index}]:`, {
          tag: el.tagName,
          classes: el.className,
          text: el.textContent.substring(0, 50) + '...'
        });
      });
    }

    // 5. Show full structure path
    console.log('5. Full structure inside shadow DOM:');
    console.log('Shadow root HTML (first 500 chars):', shadowRoot.innerHTML.substring(0, 500));
  }
}

console.log('=== END INVESTIGATION ===');
console.log('Copy all the output above and paste it into the log file!');
