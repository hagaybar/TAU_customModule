/**
 * @process fix-svg-cors-fallback
 * @description Fix CloudFront SVG CORS issue by adding fallback to bundled local SVGs
 * @inputs { testUrl: string, awsCdnBaseUrl: string }
 * @outputs { success: boolean, summary: string }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

/**
 * Fix SVG CORS Fallback Process
 *
 * CloudFront SVG maps fail with CORS on localhost:4201.
 * Solution: Add fallback to bundled local SVG files.
 *
 * Steps:
 * 1. Verify the CORS issue using Playwright
 * 2. Implement fallback logic in shelf-map-svg.component.ts
 * 3. Rebuild and verify the fix works
 */
export async function process(inputs, ctx) {
  const {
    testUrl = 'http://localhost:4201/nde/fulldisplay?query=history&tab=TAU&search_scope=TAU&mfacet=library,include,4146%E2%80%93190886640004146&offset=0&vid=972TAU_INST:NDE_TEST&lang=en&docid=alma990013418890204146',
    awsCdnBaseUrl = 'https://d3h8i7y9p8lyw7.cloudfront.net'
  } = inputs;

  // ============================================================================
  // STEP 1: VERIFY CORS ISSUE
  // ============================================================================

  const corsVerification = await ctx.task(verifyCorsIssueTask, {
    testUrl,
    awsCdnBaseUrl
  });

  // ============================================================================
  // STEP 2: IMPLEMENT FALLBACK LOGIC
  // ============================================================================

  const implementation = await ctx.task(implementFallbackTask, {
    svgCorsError: corsVerification.svgCorsError,
    csvCorsError: corsVerification.csvCorsError,
    awsCdnBaseUrl
  });

  // ============================================================================
  // STEP 3: VERIFY FIX WORKS
  // ============================================================================

  const verification = await ctx.task(verifyFixTask, {
    testUrl,
    implementationChanges: implementation.changes
  });

  // Return results
  return {
    success: verification.verified,
    corsIssueFound: corsVerification.svgCorsError,
    fallbackImplemented: implementation.success,
    verified: verification.verified,
    summary: verification.summary,
    awsCorsInstructions: corsVerification.svgCorsError ? getAwsCorsInstructions() : null
  };
}

function getAwsCorsInstructions() {
  return `
## AWS CloudFront CORS Fix Instructions

Your CloudFront distribution needs CORS headers for localhost:4201.

### Option 1: Update CloudFront Response Headers Policy

1. Go to AWS CloudFront Console
2. Find distribution: d3h8i7y9p8lyw7.cloudfront.net
3. Go to Behaviors tab
4. Edit the behavior for /maps/*
5. Under "Response headers policy", create or edit a policy to add:
   - Access-Control-Allow-Origin: http://localhost:4201
   - Access-Control-Allow-Methods: GET, HEAD, OPTIONS
   - Access-Control-Allow-Headers: *

### Option 2: S3 CORS Configuration

If your S3 bucket serves the SVGs directly, add this CORS config:

\`\`\`json
[
  {
    "AllowedOrigins": [
      "http://localhost:4200",
      "http://localhost:4201",
      "https://tau.primo.exlibrisgroup.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
\`\`\`

### Verify CORS is working:

\`\`\`bash
curl -I -X OPTIONS \\
  -H "Origin: http://localhost:4201" \\
  -H "Access-Control-Request-Method: GET" \\
  https://d3h8i7y9p8lyw7.cloudfront.net/maps/floor_1.svg
\`\`\`

You should see: Access-Control-Allow-Origin: http://localhost:4201
`;
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

/**
 * Verify CORS issue exists using Playwright
 */
export const verifyCorsIssueTask = defineTask('verify-cors-issue', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Verify CORS error in browser',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA tester using Playwright browser tools',
      task: `Navigate to the Primo page and verify CORS errors for CloudFront SVG maps.

Test URL: ${args.testUrl}

Steps:
1. Use browser_navigate to go to the test URL
2. Wait for page to load (use browser_wait_for if needed)
3. Use browser_snapshot to see the page state
4. Look for an "Available" section and click on it to expand
5. Look for "Shelf Map" or "מפת מדף" button and click it
6. Use browser_console_messages to check for CORS errors related to ${args.awsCdnBaseUrl}

IMPORTANT:
- Use browser_snapshot to see what elements are available
- Look for buttons with refs like [ref="XX"] in the snapshot
- Check console messages with level "error" for CORS-related errors

Return JSON with findings.`,
      context: args,
      instructions: [
        'Navigate to test URL using browser_navigate',
        'Use browser_snapshot to see page structure',
        'Click appropriate elements to open shelf map dialog',
        'Use browser_console_messages with level="error" to find CORS errors',
        'Report findings as structured JSON'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['svgCorsError', 'csvCorsError', 'summary'],
      properties: {
        svgCorsError: { type: 'boolean' },
        csvCorsError: { type: 'boolean' },
        consoleErrors: { type: 'array', items: { type: 'string' } },
        mapButtonFound: { type: 'boolean' },
        dialogOpened: { type: 'boolean' },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

/**
 * Implement fallback logic in shelf-map-svg.component.ts
 */
export const implementFallbackTask = defineTask('implement-fallback', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Add local SVG fallback logic',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Angular developer implementing error handling with fallback',
      task: `Modify shelf-map-svg.component.ts to add fallback to bundled local SVG files when CloudFront fails.

CORS Status:
- SVG CORS error: ${args.svgCorsError}
- CSV CORS error: ${args.csvCorsError}
- CloudFront base URL: ${args.awsCdnBaseUrl}

Required changes to src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.ts:

1. Add import for AWS_CDN_BASE_URL:
   import { AWS_CDN_BASE_URL } from '../config/google-sheets.config';

2. Add a mapping object for local fallback SVGs (after the class properties):
   private readonly LOCAL_SVG_MAP: Record<string, string> = {
     '0': 'Floor_0.svg',
     '1': 'Floor_1.SVG',
     '2': 'Floor_2.SVG'
   };

3. Add a method to extract floor number and get fallback path:
   private getFallbackSvgPath(originalUrl: string): string | null {
     // Check if URL is from CloudFront
     if (!originalUrl.includes(AWS_CDN_BASE_URL)) {
       return null;
     }
     // Extract floor number from URL (e.g., floor_1.svg -> 1)
     const floorMatch = originalUrl.match(/floor_(\\d+)\\.svg/i);
     if (!floorMatch) {
       return null;
     }
     const floorNum = floorMatch[1];
     const localFile = this.LOCAL_SVG_MAP[floorNum];
     if (!localFile) {
       return null;
     }
     // Return path relative to component's directory
     return \`assets/cenlib-map/\${localFile}\`;
   }

4. Modify the error handler in loadExternalSvg() to try fallback:
   In the error callback (around line 177-184), change it to:

   error: (error) => {
     console.error('[ShelfMapSvg] Failed to load SVG:', error);

     // Try fallback for CloudFront URLs
     const fallbackPath = this.getFallbackSvgPath(fullPath);
     if (fallbackPath) {
       console.log('[ShelfMapSvg] Trying fallback local SVG:', fallbackPath);
       const fallbackUrl = \`\${assetBaseUrl}/\${fallbackPath}\`;
       this.loadSvgFromUrl(fallbackUrl, true);
       return;
     }

     this.hasError = true;
     this.isLoading = false;
     this.useExternalSvg = false;
     this.cdr.detectChanges();
   }

5. Extract the HTTP loading logic to a separate method for reuse:
   private loadSvgFromUrl(url: string, isFallback: boolean = false): void {
     this.svgSubscription?.unsubscribe();
     this.svgSubscription = this.http
       .get(url, { responseType: 'text' })
       .subscribe({
         next: (svgContent) => {
           const fixedSvgContent = this.fixSvgForScaling(svgContent);
           console.log(\`[ShelfMapSvg] SVG loaded successfully\${isFallback ? ' (fallback)' : ''} (\${svgContent.length} bytes)\`);
           this.externalSvgContent = this.sanitizer.bypassSecurityTrustHtml(fixedSvgContent);
           this.isLoading = false;
           this.cdr.detectChanges();
           setTimeout(() => this.applyHighlighting(), 50);
         },
         error: (error) => {
           console.error(\`[ShelfMapSvg] Failed to load SVG\${isFallback ? ' (fallback)' : ''}:\`, error);
           this.hasError = true;
           this.isLoading = false;
           this.useExternalSvg = false;
           this.cdr.detectChanges();
         }
       });
   }

IMPORTANT:
- Read the file first using Read tool
- Use Edit tool to make precise, targeted changes
- The bundled SVGs are: Floor_0.svg, Floor_1.SVG, Floor_2.SVG (note mixed case)
- Assets are served from: \${assetBaseUrl}/assets/cenlib-map/

Return JSON summary of changes made.`,
      context: args,
      instructions: [
        'Read shelf-map-svg.component.ts first',
        'Add import for AWS_CDN_BASE_URL',
        'Add LOCAL_SVG_MAP property',
        'Add getFallbackSvgPath method',
        'Refactor loadExternalSvg to use loadSvgFromUrl helper',
        'Update error handling to try fallback',
        'Use Edit tool for precise changes',
        'Verify the component compiles'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['success', 'changes'],
      properties: {
        success: { type: 'boolean' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

/**
 * Rebuild and verify the fix
 */
export const verifyFixTask = defineTask('verify-fix', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Rebuild and verify SVG fallback works',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA tester verifying the fix',
      task: `Rebuild the Angular project and verify the SVG fallback works.

Test URL: ${args.testUrl}

Steps:
1. Run: npm run build (using Bash tool, with nvm use 18.20.8 first)
2. Navigate to test URL using browser_navigate
3. Open the shelf map dialog (find and click "Shelf Map" or "מפת מדף" button)
4. Verify with browser_console_messages:
   - Look for "[ShelfMapSvg] Trying fallback local SVG:" message
   - Verify no uncaught CORS errors
   - Look for "[ShelfMapSvg] SVG loaded successfully (fallback)"
5. Use browser_snapshot to verify the map SVG is displayed

If the dev server auto-reloaded, skip the build step.

Return verification results.`,
      context: args,
      instructions: [
        'Run npm build to verify compilation',
        'Navigate to test URL',
        'Open shelf map dialog',
        'Check console for fallback messages',
        'Verify map displays correctly in snapshot'
      ],
      outputFormat: 'JSON'
    },
    outputSchema: {
      type: 'object',
      required: ['verified', 'summary'],
      properties: {
        verified: { type: 'boolean' },
        buildSuccess: { type: 'boolean' },
        mapDisplayed: { type: 'boolean' },
        fallbackUsed: { type: 'boolean' },
        consoleMessages: { type: 'array', items: { type: 'string' } },
        issues: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));

export default process;
