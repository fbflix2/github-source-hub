

## Analysis

The template download system (`downloadBloco` in `ItemDetails.tsx`) already replaces `{{placeholders}}` with stock data. However, there are two issues:

1. **Missing placeholders**: The template in the screenshot has fields like "LINK DO PERFIL:", "ID:", "SENHA E-MAIL:" that have no corresponding placeholders defined in the system.
2. **Missing data mapping**: The `identification` and `identification_link` fields from `stock_items` (set in blocagem) are not included in the `stockData` object or replacement map.

## Changes

### 1. Add missing placeholders to `AdminBlocoPadrao.tsx`
Add these new placeholders to the `PLACEHOLDERS` array and `SAMPLE_DATA`:
- `{{linkPerfil}}` - Link do perfil (from `identification_link`)
- `{{idPerfil}}` - ID do perfil (from `identification`)
- `{{senhaEmail}}` - Senha do e-mail (if stored separately, or alias)

### 2. Update `ItemDetails.tsx` - include stock item's top-level fields
In `fetchData`, also capture `identification` and `identification_link` from the stock item and merge them into `stockData` so they're available for placeholder replacement.

Update the `replacements` map in `downloadBloco` to include:
```
"{{linkPerfil}}": stockIdentificationLink || "—",
"{{idPerfil}}": stockIdentification || "—",
```

### 3. Update `StockData` interface
Add `linkPerfil` and `idPerfil` optional fields to the `StockData` interface so the data flows cleanly.

### Summary of files to edit
- `src/pages/admin/AdminBlocoPadrao.tsx` - Add new placeholders + sample data
- `src/pages/ItemDetails.tsx` - Expand StockData interface, capture identification fields, add to replacement map

