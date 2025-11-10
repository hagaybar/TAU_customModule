# Icon Setup for External Search Feature

## Required Icon Files

The External Search feature requires the following 16x16px PNG icons to be placed in:
`src/assets/images/external-sources/`

### Icons Needed:

1. **uli_logo_16_16.png** - ULI (Union List of Israel) logo
2. **worldcat-16.png** - WorldCat logo
3. **scholar_logo_16_16.png** - Google Scholar logo
4. **crossref_logo_16_16.png** - Crossref logo (optional - currently commented out)

## Where to Find Icons

### From Old TAU Customization:
Your old Primo customization package likely has these icons at:
```
custom/972TAU_INST-TAU/img/
├── uli_logo_16_16.png
├── worldcat-16.png
├── scholar_logo_16_16.png
└── crossred_logo_16_16.png
```

### To Copy Icons:
```bash
# If you have the old customization package extracted:
cp path/to/old/custom/972TAU_INST-TAU/img/uli_logo_16_16.png src/assets/images/external-sources/
cp path/to/old/custom/972TAU_INST-TAU/img/worldcat-16.png src/assets/images/external-sources/
cp path/to/old/custom/972TAU_INST-TAU/img/scholar_logo_16_16.png src/assets/images/external-sources/
```

### Alternative - Download from Web:
Use favicon grabbing services or create your own 16x16 icons from the official logos.

## Testing Without Icons

The component will still function without icons, but will show:
- Broken image icons (browser default)
- Alt text will still display
- Links will work correctly

For development testing, you can temporarily use placeholder images or comment out the `<img>` tags in the template.

## Verification

After adding icons, verify they appear in the build output:
```bash
npm run build
# Check dist/972TAU_INST-NDE_TEST/assets/images/external-sources/
```
