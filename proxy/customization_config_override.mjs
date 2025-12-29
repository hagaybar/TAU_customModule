<<<<<<< HEAD
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load build-settings.env
config({ path: path.resolve(__dirname, '../build-settings.env') });

// Extract institution and view IDs from environment
const INST_ID = process.env.INST_ID || '972TAU_INST';
const VIEW_ID = process.env.VIEW_ID || 'NDE_TEST';
const CUSTOM_PATH = `custom/${INST_ID}-${VIEW_ID}`;

console.log(`[Proxy Config] Using custom path: ${CUSTOM_PATH}`);

export const customizationConfigOverride = {
  "favIcon": `${CUSTOM_PATH}/assets/images/favicon.ico`,
  "libraryLogo": `${CUSTOM_PATH}/assets/images/library-logo.png`,
  "viewSvg": `${CUSTOM_PATH}/assets/icons/custom_icons.svg`,
  "homepage": {
    // "homepageBGImage": `${CUSTOM_PATH}/assets/homepage/homepage_background.svg`,
    "html": {
      "en": `${CUSTOM_PATH}/assets/homepage/homepage_en.html`,
      "he": `${CUSTOM_PATH}/assets/homepage/homepage_he.html`,
      "ar": `${CUSTOM_PATH}/assets/homepage/homepage_ar.html`,
      "fr": `${CUSTOM_PATH}/assets/homepage/homepage_fr.html`,
      "de": `${CUSTOM_PATH}/assets/homepage/homepage_de.html`,
      "es": `${CUSTOM_PATH}/assets/homepage/homepage_es.html`,
      "it": `${CUSTOM_PATH}/assets/homepage/homepage_it.html`,
      "pl": `${CUSTOM_PATH}/assets/homepage/homepage_pl.html`,
      "ja": `${CUSTOM_PATH}/assets/homepage/homepage_ja.html`,
      "zh": `${CUSTOM_PATH}/assets/homepage/homepage_zh.html`
=======
export const customizationConfigOverride = {
  "favIcon": "custom/MOCKINST-MOCKVID/assets/images/favicon.ico",
  "libraryLogo": "custom/MOCKINST-MOCKVID/assets/images/library-logo.png",
  "viewSvg": "custom/MOCKINST-MOCKVID/assets/icons/custom_icons.svg",
  "homepage": {
    "homepageBGImage": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_background.svg",
    "html": {
      "en": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_en.html",
      "he": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_he.html",
      "ar": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_ar.html",
      "fr": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_fr.html",
      "de": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_de.html",
      "es": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_es.html",
      "it": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_it.html",
      "pl": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_pl.html",
      "ja": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_ja.html",
      "zh": "custom/MOCKINST-MOCKVID/assets/homepage/homepage_zh.html"
>>>>>>> upstream/main

    }
  }
}
