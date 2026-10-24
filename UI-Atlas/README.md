# UI Atlas

A responsive React + TypeScript UI pattern library with 60 catalog entries, interactive live previews, search/filtering, favorites, recently viewed patterns, viewport simulation, theme customization, and copyable example source.

## Run locally

```bash
cd UI-Atlas
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Notes

- The catalog contains all 60 requested patterns, grouped by their original categories and numbering.
- Preview implementations are rendered UI, not screenshots. Shared pattern renderers adapt to each pattern's content and purpose.
- Copyable examples are standalone React snippets for the currently selected preview. They are illustrative starter implementations, not a claim that every external provider (authentication, billing, booking, or social integration) is connected.
- Favorites, theme preference, and recent views persist in local storage.
- External services require their own credentials/configuration before they can be considered live integrations.