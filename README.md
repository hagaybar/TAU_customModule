# TAU CustomModule for Primo NDE

### Overview
This is Tel Aviv University's customization package for Primo's New Discovery Experience (NDE). It extends the base ExLibris customModule with TAU-specific features and enhancements.

---

## 📋 Summary of TAU Customizations

This package includes the following Tel Aviv University-specific customizations:

| Feature | Type | Status | Description |
|---------|------|--------|-------------|
| **External Search Integration** | Component | ✅ Production | Search links panel + No results external links |
| **CenLib Map** | Component | 🧪 Development | Shelf location map button in get-it section |
| **Call Number Directionality** | CSS | ✅ Production | LTR display + bold styling for mixed-language call numbers |
| **Location Availability Color** | CSS | ✅ Production | Green text for availability status |
| **Card Title Styling** | CSS | ✅ Production | Bold card titles |
| **Main Page Image Overlay** | CSS | ✅ Production | Disable background overlay on main page top image |
| **Hide Update Login Credentials** | CSS | ✅ Production | Hide card actions in MyAccount area |

**Key Technologies:**
- Angular 18 standalone components
- Shadow DOM manipulation
- Custom Alma labels (i18n)
- RTL/LTR bidirectional support
- Custom CSS styling

---

## 🎯 TAU-Specific Features

### 1. External Search Integration
Two complementary components that provide external search options throughout the search experience:

#### a) External Search Sources Panel (FilterAssistPanel)
Displays external search links in the filter side navigation, allowing users to search their current query in external sources.

**Implemented Features:**
- ✅ **External Search Links**: ULI, WorldCat, Google Scholar
- ✅ **Automatic Query Transfer**: Current search automatically transferred to external sites
- ✅ **Bilingual Support**: English and Hebrew with RTL layout
- ✅ **Smart Query Parsing**: Extracts search terms from Primo query format
- ✅ **Conditional Display**: Only shows when an active search exists

**Location in NDE:** Top of the filter side navigation (appears when clicking "All Filters")

**Technical Details:**
- Component: `FilterAssistPanelComponent`
- Selector mapping: `nde-filters-group-before`
- Files: `src/app/custom1-module/filter-assist-panel/`

#### b) No Results External Links
Displays external search options when a search returns zero results, helping users continue their research.

**Implemented Features:**
- ✅ **Alternative Search Options**: Same external sources (ULI, WorldCat, Google Scholar)
- ✅ **Card Design**: Styled card with external link indicators
- ✅ **Bilingual Support**: English and Hebrew with RTL layout
- ✅ **Accessibility**: Keyboard navigation, ARIA labels, secure link attributes
- ✅ **Query Preservation**: Search term automatically included in external links

**Location in NDE:** Displayed after the no-results message

**Technical Details:**
- Component: `NoResultsExternalLinksComponent`
- Selector mapping: `nde-search-no-results-after`
- Files: `src/app/custom1-module/no-results-external-links/`

#### Shared Configuration
Both components use the same configuration file for consistency:
```
src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts
```

Each source includes:
- Name (English and Hebrew)
- URL template
- Icon (16×16 PNG)
- Query mapping function to transform Primo queries

**Benefits:**
- **Single source of truth**: Changes to external sources apply to both components
- **Easy maintenance**: Add/remove sources in one place
- **Consistent UX**: Same sources and behavior across different contexts

**Migration Note:** This feature was migrated from AngularJS to Angular 18. See [Migration Summary](docs/features/external-search/MIGRATION_SUMMARY.md) for technical details.

---

### 2. CenLib Map (Shelf Location Map)

A feature that displays a "Shelf Map" button in the get-it section for physical items. When clicked, it opens a modal dialog showing the item's call number and mapped shelf location information.

**Status:** 🧪 Development (Testing in NDE_TEST view)

#### Implemented Features:

- ✅ **Map Button**: Appears at the bottom of each location item in the get-it section
- ✅ **Modal Dialog**: Opens when button is clicked, displays shelf location information
- ✅ **Call Number Extraction**: Automatically extracts call number from parent location item
- ✅ **Bilingual Support**: English and Hebrew labels with RTL layout support
- ✅ **Range-Based Mapping**: Maps call numbers to shelf codes using numeric ranges (Dewey Decimal)
- ✅ **Mapping Display**: Shows SVG code, section description, and floor number
- ✅ **Google Sheets Integration**: Shelf mappings loaded from external Google Sheets CSV
- ✅ **Caching**: 5-minute cache to minimize network requests
- ✅ **Fallback Support**: Automatic fallback to hard-coded data if fetch fails
- ✅ **Loading State**: Spinner displayed while fetching data

#### How It Works:

1. **Button Component** (`CenlibMapButtonComponent`):
   - Registered at `nde-location-item-bottom` insertion point
   - Extracts call number from DOM using `[data-qa="location-call-number"]` selector
   - Opens Material dialog with call number data

2. **Dialog Component** (`CenlibMapDialogComponent`):
   - Displays call number with LTR direction for proper rendering
   - Uses `ShelfMappingService` to find matching shelf location
   - Shows loading spinner while fetching data
   - Shows SVG code, section description (bilingual), and floor number

3. **Shelf Mapping Service**:
   - Fetches shelf mappings from Google Sheets (published as CSV)
   - Caches data for 5 minutes to reduce network requests
   - Falls back to hard-coded `SHELF_MAPPINGS` if fetch fails
   - Extracts numeric portion from call numbers
   - Matches against configured range-based mappings

#### Google Sheets Integration

Shelf mappings are loaded at runtime from a Google Sheets spreadsheet, allowing librarians to update mappings without code changes.

**Google Sheet Structure:**
| Column | Description |
|--------|-------------|
| `rangeStart` | Start of call number range (inclusive) |
| `rangeEnd` | End of call number range (inclusive) |
| `svgCode` | SVG element identifier (e.g., `SHELF-01`) |
| `description` | English description |
| `descriptionHe` | Hebrew description |
| `floor` | Floor number |

**Setup:**
1. Create a Google Sheet with the columns above
2. Go to **File → Share → Publish to web**
3. Select the sheet tab and change format to **CSV**
4. Copy the published URL to `config/google-sheets.config.ts`

**Data Flow:**
```
Dialog Opens → Check Cache → [Valid?] → Use cached data
                    ↓ No
              Fetch from Google Sheets CSV
                    ↓
              [Success?] → Parse CSV → Cache → Display
                    ↓ No
              Use fallback SHELF_MAPPINGS
```

**Update Latency:** Changes in Google Sheets are reflected within ~15-20 minutes (Google's publishing delay + app cache expiry).

#### Technical Details:

| Component | File Location |
|-----------|---------------|
| Button Component | `src/app/custom1-module/cenlib-map/cenlib-map-button.component.ts` |
| Dialog Component | `src/app/custom1-module/cenlib-map/cenlib-map-dialog/` |
| Google Sheets Config | `src/app/custom1-module/cenlib-map/config/google-sheets.config.ts` |
| Fallback Mappings | `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts` |
| Mapping Service | `src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts` |

**Dependencies:** `papaparse` (CSV parsing)

**Selector Mapping:** `nde-location-item-bottom` → `CenlibMapButtonComponent`

#### Future Phases (Planned):

- **Phase 5**: Production polish - accessibility improvements, analytics

---

### 3. CSS Customizations
Custom styling fixes and enhancements applied via `src/assets/css/custom.css`.

#### Call Number Directionality Fix
**Date Implemented:** 13.11.25

Ensures call numbers display left-to-right (LTR) regardless of UI language or page directionality settings.

**Problem Solved:** Mixed content call numbers like "892.413 מאו" were displaying with incorrect directionality in Hebrew/RTL contexts.

**Implementation:**
- **Location 1**: `nde-locations-container [data-qa="location-call-number"]`
  - Uses semantic `data-qa` attribute for reliable targeting
  - Applies to main locations display

- **Location 2**: `nde-location-item .getit-items-brief-property:nth-child(3)`
  - Targets third column in brief properties table (call number column)
  - Brief properties structure: Availability | Loan Policy | Call Number

**CSS Properties:**
```css
direction: ltr;           /* Forces left-to-right text direction */
unicode-bidi: embed;      /* Isolates bidirectional context */
display: inline-block;    /* Ensures proper containment */
font-weight: bold;        /* Makes call numbers bold for better visibility */
```

#### Location Availability Text Color
Changes the color of location availability text to green for better visibility.

**Target:** `.view-it-title.mat-title-small.ng-star-inserted span`

#### Card Title Styling
Makes card titles bold for improved visual hierarchy.

**Target:** `mat-card-title.mat-mdc-card-title.margin-bottom-medium`

#### Main Page Image Overlay
Disables the background overlay on the main page top image to prevent color tinting from the theme.

**Target:** `.custom-search-bar-container .background-overlay`

#### Hide Update Login Credentials
**Date Implemented:** 21.12.25

Hides the "Update Login Credentials" card actions section in the MyAccount area for a cleaner user interface.

**Target:** `.mat-mdc-card-actions`

**CSS Properties:**
```css
display: none !important;  /* Completely hides the card actions element */
```

**Documentation:** See [Call Number Directionality Fix](docs/reference/call_number_directionality_fix.md) for detailed technical information including selectors, strategies, and Primo VE implementation.

---

## 📚 Documentation

Comprehensive documentation is organized in the [`docs/`](docs/) folder:

### Feature Documentation

#### External Search Integration
- **[External Search Implementation](docs/features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)** - Complete technical guide
- **[Migration Summary](docs/features/external-search/MIGRATION_SUMMARY.md)** - AngularJS to Angular 18 migration
- **[Icon Setup Notes](docs/features/external-search/ICON_SETUP_NOTES.md)** - Icon installation guide

### Reference Documentation
- **[Call Number Directionality Fix](docs/reference/call_number_directionality_fix.md)** - CSS fixes for call number display (VE & NDE)

### Troubleshooting
- **[Bug Fix History](docs/troubleshooting/BUGFIX_HISTORY.md)** - Bug fixes and resolutions
- **[Asset Path Fix](docs/troubleshooting/ASSET_PATH_FIX.md)** - Asset path resolution in NDE context

### Research & Development
- **[NDE Integration Research](docs/research/NDE_INTEGRATION_RESEARCH.md)** - NDE integration research
- **[Development Guidelines](docs/development/AGENTS.md)** - Repository development guidelines

### Technical Specifications
- **[SPECS.md](SPECS.md)** - Detailed technical specifications

**See the [Documentation Index](docs/README.md) for the complete documentation map.**

---

## 🚀 Quick Start (TAU Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Build Settings
Edit `build-settings.env`:
```bash
INST_ID=972TAU_INST
VIEW_ID=NDE_TEST  # or NDE for production
ASSET_BASE_URL=/nde/custom/972TAU_INST-NDE_TEST
```

### 3. Development Server
```bash
npm run start
```
Access at: `http://localhost:4201`

Or with proxy:
```bash
npm run start:proxy
```

### 4. Build for Production
```bash
npm run build
```
Output: `dist/972TAU_INST-NDE_TEST.zip`

### 5. Deploy to Alma
1. Upload ZIP to Alma Back Office
2. Navigate to: **Discovery > View List > Edit**
3. Go to: **Manage Customization Package** tab
4. Upload and save

---

## Prerequisites

### Node.js and npm (Node Package Manager)
1. **Verify Node.js and npm Installation:**
    - Open a terminal.
    - Run the following commands to check if Node.js and npm are installed:
        ```bash
        node -v
        npm -v
        ```
    - If installed, you will see version numbers. If not, you will see an error.

2. **Install Node.js and npm (if not installed):**
    - Visit the [Node.js download page](https://nodejs.org/en/download/).
    - Download the appropriate version for your operating system (npm is included with Node.js).
    - Follow the installation instructions.

### Angular CLI

1. **Verify Angular CLI Installation:**
    - Open a terminal.
    - Run the following command:
        ```bash
        ng version
        ```
    - If Angular CLI is installed, you will see the version and installed Angular packages.

2. **Install Angular CLI (if not installed):**
    - After installing Node.js and npm, install Angular CLI globally by running:
        ```bash
        npm install -g @angular/cli
        ```

---

## Development server setup and startup

### Step 1: Download the Project
1. Navigate to the GitHub repository: [https://github.com/ExLibrisGroup/customModule](https://github.com/ExLibrisGroup/customModule).
2. Download the ZIP file of the project.
3. Extract the ZIP file to your desired development folder (e.g., `c:\env\custom-module\`).

### Step 2: Install Dependencies
1. Inside the `customModule` directory, install the necessary npm packages:
    ```bash
    npm install
    ```

### Step 3: Configuring proxy for and starting local development server

There are two options for setting up your local development environment: configuring a proxy or using parameter on your NDE URL.

- **Option 1: Update `proxy.conf.mjs` Configuration**:
  - Set the URL of the server you want to test your code with by modifying the `proxy.conf.mjs` file in the `./proxy` directory:
    ```javascript
    // Configuration for the development proxy
    const environments = {
      'example': 'https://myPrimoVE.com',
    }

    export const PROXY_TARGET = environments['example'];
    ```
  - Start the development server with the configured proxy by running:
    ```bash
    npm run start:proxy
    ```
  - Open your browser on port 4201 to see your changes.
    
    **URL Templates:**
    - **Production View:** `http://localhost:4201/nde/home?vid=972TAU_INST:NDE&lang=en`
    - **Test View:** `http://localhost:4201/nde/home?vid=972TAU_INST:NDE_TEST&lang=en`
    - **Generic Template:** `http://localhost:4201/nde/home?vid=YOUR_VIEW_CODE&lang=en`

  
- **Option 2: Parameter on NDE URL**:
    - Start your development server by running
      ```bash
      npm run start
      ```
    -  Add the following query parameter to your NDE URL:
      ```
      useLocalCustomPackage=true
      ```
      For example: `https://sqa-na02.alma.exlibrisgroup.com/nde/home?vid=EXLDEV1_INST:NDE&useLocalCustomPackage=true`
    - This setting assumes that your local development environment is running on the default port `4201`.
 
### Troubleshooting

#### Missing Background Image in Local Proxy
If you do not see the top background image when running `npm run start:proxy`:
1. **Cause:** The proxy configuration (`proxy/customization_config_override.mjs`) attempts to load a local image (`src/assets/homepage/homepage_background.svg`) which may not exist.
2. **Fix:** 
   - **Option A (Use Default):** Comment out the `homepageBGImage` line in `proxy/customization_config_override.mjs` to use the default production image.
   - **Option B (Use Custom):** Add your custom image file to `src/assets/homepage/` and ensure the filename matches the configuration.
   - **Note:** You must restart the proxy server (`npm run start:proxy`) for configuration changes to take effect.

  
---

## Step 4: Code Scaffolding and Customization

### Add Custom Components
1. Create custom components by running:
    ```bash
    ng generate component <ComponentName>
    ```
    Example:
    ```bash
    ng generate component RecommendationsComponent
    ``` 

2. Update `selectorComponentMap` in `customComponentMappings.ts` to connect the newly created components:
    ```typescript
    export const selectorComponentMap = new Map<string, any>([
      ['nde-recommendations-before', RecommendationsComponentBefore],
      ['nde-recommendations-after', RecommendationsComponentAfter],
      ['nde-recommendations-top', RecommendationsComponentTop],
      ['nde-recommendations-bottom', RecommendationsComponentBottom], 	  
      ['nde-recommendations', RecommendationsComponent],
      // Add more pairs as needed
    ]);
    ```

3. Customize the component’s `.html`, `.ts`, and `.scss` files as needed:
    - `src/app/recommendations-component/recommendations-component.component.html`
    - `src/app/recommendations-component/recommendations-component.component.ts`
    - `src/app/recommendations-component/recommendations-component.component.scss`



- All components in the NDE are intended to be customizable. However, if you encounter a component that does not support customization, please open a support case with us. This helps ensure that we can address the issue and potentially add customization support for that component in future updates.

### Accessing host component instance

You can get the instance of the component your custom component is hooked to by adding this property to your component class:

```angular2html
@Input() private hostComponent!: any;
```

### Accessing app state

- You can gain access to the app state which is stored on an NGRX store by injecting the Store service to your component:

```angular2html
private store = inject(Store);
```

- Create selectors. For example: 

```angular2html
const selectUserFeature = createFeatureSelector<{isLoggedIn: boolean}>('user');
const selectIsLoggedIn = createSelector(selectUserFeature, state => state.isLoggedIn);
```

- Apply selector to the store to get state as Signal:

```angular2html
isLoggedIn = this.store.selectSignal(selectIsLoggedIn);
```

Or as Observable:

```angular2html
isLoggedIn$ = this.store.select(selectIsLoggedIn);
```

### Translating from code tables 

You can translate codes in your custom component by using ngx-translate (https://github.com/ngx-translate/core).

- If you are using a stand alone component you will need to add the TranslateModule to your component imports list.
- In your components HTML you can translate a label like so:
```angular2html
<span>This is some translated code: {{'delivery.code.ext_not_restricted' | translate}}</span>
```


---

## Creating your own color theme

The NDE theming is based on Angular Material. 
We allow via the view configuration to choose between a number of pre built themes.

![prebuilt theme image](./readme-files/prebuilt-themes.png "prebuilt themes configuration")


If you want to create your own theme instead of using one of our options follow these steps:

1. Create a material 3 theme by running:
    ```bash
    ng generate @angular/material:m3-theme
    ``` 
   You will be prompted to answer a number of questions like so:
  ```
? What HEX color should be used to generate the M3 theme? It will represent your primary color palette. (ex. #ffffff) #1eba18
? What HEX color should be used represent the secondary color palette? (Leave blank to use generated colors from Material)
? What HEX color should be used represent the tertiary color palette? (Leave blank to use generated colors from Material)
? What HEX color should be used represent the neutral color palette? (Leave blank to use generated colors from Material)
? What is the directory you want to place the generated theme file in? (Enter the relative path such as 'src/app/styles/' or leave blank to generate at your project root) src/app/styles/
? Do you want to use system-level variables in the theme? System-level variables make dynamic theming easier through CSS custom properties, but increase the bundle size. yes
? Choose light, dark, or both to generate the corresponding themes light

```
- Note that it is imporant to answer yes when asked if you want to use system-level variables.

- Also note that I'm only entering the primary color and not secondary or tertiary. They will be selected automatically based on my primary color.

Once this script completes successfully you will recieve this message: 

`CREATE src/app/styles/m3-theme.scss (2710 bytes)`

To apply the theme go to `_customized-theme.scss` and uncomment the following lines:
```
.custom-nde-theme{
  @include mat.all-component-colors(m3-theme.$light-theme);
  @include mat.system-level-colors(m3-theme.$light-theme);
}
```
---



## Developing an Add-On for the NDE UI

The NDE UI supports loading of custom modules at runtime and also provides infrastructure to dynamically load add-ons developed by vendors, consortia, or community members. This enables seamless integration, allowing institutions to configure and deploy external add-ons through **Add-On Configuration in Alma**.

The NDE UI add-on framework allows various stakeholders to develop and integrate custom functionality:

- **Vendors** can create and host services that institutions can seamlessly incorporate into their environment.
- **Institutions and consortia** can develop and share custom components, enabling consistency and collaboration across multiple libraries.

Library staff can easily add, configure, and manage these add-ons through Alma, following guidelines provided by the stakeholders. These typically include:

- **Add-on Name** – The identifier used in Alma’s configuration.
- **Add-on URL** – The location where the add-on is hosted (static folder to load the add-on at runtime).
- **Configuration Parameters** – JSON-based config parameters to be referenced at runtime by the add-on.

![Add-on Overview](./readme-files/addon-overview.png)

---

## Guidelines for Developing an Add-On

You can download the custom module and modify it to function as an add-on.

### Set Add-on Name

This section below should remain the same.

![Set Addon Name](./readme-files/set-addon-name.png)

![Example Configuration JSON](./readme-files/example-config-json.png)

---

The add-on infrastructure provides a way to access institution-specific configuration parameters. Institutions can upload their configuration settings in JSON format, which your add-on can reference dynamically within its components.

### 🔧 Accessing Add-On Configuration Parameters

Use Angular DI to inject the parameters directly into your component via the `MODULE_PARAMETERS` token:

```ts
import { Component, Inject } from '@angular/core';

@Component({
  selector: 'custom-test-bottom',
  host: { 'data-component-id': 'custom-test-bottom-unique' },
  templateUrl: './test-bottom.component.html',
  styleUrls: ['./test-bottom.component.scss']
})
export class TestBottomComponent {
  constructor(@Inject('MODULE_PARAMETERS') public moduleParameters: any) {
    console.log('Module parameters TestBottomComponent:', this.moduleParameters);
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }
}

```

> 📘 `yourParamKey` should match the keys defined in your Alma Add-on JSON configuration.

---

If your add-on includes assets such as images, you can ensure a complete separation between the frontend code and asset deployment. To achieve this, set `ASSET_BASE_URL` to point to your designated static folder, allowing your add-on to reference assets independently of the core application.

![Access Assets via ASSET_BASE_URL](./readme-files/access-assets.png)


The `autoAssetSrc` directive automatically prepends `ASSET_BASE_URL` to your `[src]` attribute.

### Example:
```html
<img autoAssetSrc [src]="'assets/images/logo.png'" />
```

With:
```env
ASSET_BASE_URL=http://il-urm08.corp.exlibrisgroup.com:4202/
```

Results in:
```html
<img src="http://il-urm08.corp.exlibrisgroup.com:4202/assets/images/logo.png" />
```

### Supported Elements:
- `<img>`
- `<source>`
- `<video>`
- `<audio>`

> ✅ Always use `[src]="'relative/path'"` to ensure proper asset URL injection.

---




---

## Recommended Development Environment

To ensure smooth development, debugging, and code management, we recommend setting up your environment with the following tools:

### 🖥️ IDEs and Editors

- **Visual Studio Code (VSCode)** – Highly recommended  
  [Download VSCode](https://code.visualstudio.com/)
  - Recommended Extensions:
    - `Angular Language Service`
    - `ESLint` or `TSLint`
    - `Prettier - Code formatter`
    - `Path Intellisense`
    - `Material Icon Theme` (optional for better visuals)

- **WebStorm**  
  A powerful alternative with built-in Angular and TypeScript support.  
  [Download WebStorm](https://www.jetbrains.com/webstorm/)

- **IntelliJ IDEA**  
  A full-featured IDE by JetBrains. Ideal if you’re also working with Java backend.  
  [Download IntelliJ IDEA](https://www.jetbrains.com/idea/)

- **Eclipse IDE**  
  Suitable for full-stack development including Angular with the right plugins.  
  [Download Eclipse](https://www.eclipse.org/downloads/)

---

### 🔧 Tools & Utilities

- **Node Version Manager (nvm)**  
  Manage multiple versions of Node.js easily:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```

- **Angular CLI**
  ```bash
  npm install -g @angular/cli
  ```

- **Git GUI Clients**
  - GitHub Desktop
  - Sourcetree
  - GitKraken

---

### 🔍 Debugging & Testing

- Use **Chrome Developer Tools** for runtime inspection.
- Install **Augury Extension** (Angular DevTools) for inspecting Angular components.

---

### 🧪 Optional Tools

- **Postman** – For testing API requests.
- **Docker** – For isolated build environments.
- **Nx** – Monorepo tool (if planning multiple apps/libraries).

---
## Build the Project

### Step 5: Build the Project
1. Compile the project:
    ```bash
    npm run build
    ```

2. After a successful build, the compiled code will be in the `dist/` directory.


- **Automatic Packaging**:
  - The build process automatically compiles and packages the project into a ZIP file named according to the `INST_ID` and `VIEW_ID` specified in the `build-settings.env` file located at:
    ```
    C:\env\nde\customModule-base\build-settings.env
    ```
  - Example configuration:
    ```
    INST_ID=DEMO_INST
    VIEW_ID=Auto1
    ```
  - The ZIP file, e.g., `DEMO_INST-Auto1.zip`, is automatically created in the `dist/` directory after a successful build.


### Step 6: Upload Customization Package to Alma
1. In Alma, navigate to **Discovery > View List > Edit**.
2. Go to the **Manage Customization Package** tab.
3. Upload your zipped package in the **Customization Package** field and save.
4. Refresh the front-end to see your changes.


---

## Additional Resources

### Live Demo Tutorial
- **Customize Primo NDE UI**: Watch our live demo on YouTube for a visual guide on how to customize the Primo NDE UI:
  [Customize Primo NDE UI: Live Demo](https://www.youtube.com/watch?v=j6jAYkawDSM)



---

## Conclusion
By following these steps, you can customize and extend the NDE interface using the `CustomModule` package. If you have any questions or run into issues, refer to the project documentation or the ExLibris support.

