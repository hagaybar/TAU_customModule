# External Search Source Icons

This directory contains icons for external search sources displayed in the Filter Assist Panel.

## Required Icons

Place the following 16x16 pixel icon files in this directory:

1. **uli_logo_16_16.png** - ULI (Union List of Israel) logo
2. **worldcat-16.png** - WorldCat logo
3. **scholar_logo_16_16.png** - Google Scholar logo
4. **crossref_logo_16_16.png** - Crossref logo (optional, currently disabled)

## Icon Specifications

- **Size**: 16x16 pixels
- **Format**: PNG with transparency
- **Background**: Transparent
- **Color mode**: RGB
- **Optimization**: Use PNG compression for smaller file size

## Source Icons

You can obtain these icons from:

- **ULI**: [National Library of Israel](https://uli.nli.org.il/)
- **WorldCat**: [OCLC WorldCat](https://www.worldcat.org/)
- **Google Scholar**: [Google Scholar](https://scholar.google.com/)
- **Crossref**: [Crossref](https://www.crossref.org/)

Alternatively, use favicon grabbing services or screenshot the actual sites.

## Usage

These icons are referenced in:
- `src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts`

The paths are relative to the `src/assets/` directory.
