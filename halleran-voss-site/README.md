# Halleran-Voss Pharmaceuticals

A speculative-design series presented as a pharmaceutical manufacturer's
product index. Twenty-one plates, selectable, with prescribing notes.

All brands, agencies, compounds, contracts and people are invented.

## Hosting on GitHub Pages

1. Create a repository and push the contents of this folder to its root,
   so that `index.html` sits at the top level.
2. In **Settings -> Pages**, set *Source* to `Deploy from a branch`,
   pick your branch and the `/ (root)` folder, and save.
3. The site appears at `https://<user>.github.io/<repo>/` within a minute
   or two.

`.nojekyll` is included so GitHub serves the `assets/` folder as-is
rather than running the files through Jekyll.

The page is static and needs no build step. It also opens correctly by
double-clicking `index.html` locally, because the product data is loaded
as a script rather than fetched.

## Layout

    index.html                 the page
    assets/css/style.css       all styles
    assets/js/data.js          products and marks, as window.HV_DATA
    assets/js/app.js           the picker
    assets/img/plates/*.jpg    one advertisement per preparation
    assets/img/*.png           marks

## Editing

To add or change a preparation, edit `assets/js/data.js`. Each entry
takes: `id`, `brand`, `generic`, `indication`, `body`, `series_label`,
`supply`, `ink`, `swatch` (an array of hex values shown as the ink strip),
`accent` (the hex the page tints itself with while that entry is
selected), and `img` (a path relative to `index.html`).
