# calorie-tracker

Free calorie tracker with a barcode scanner. It runs on your phone as an installable web app (PWA), so it
works on both iPhone and Android with no app store needed.

- **Barcode scanner**: scan a product with your phone camera to look it up in [Open Food Facts](https://world.openfoodfacts.org).
- **Full nutrients**: energy, fat, saturates, carbs, sugars, fibre, protein, salt, plus every vitamin and mineral
  on the label, with % of your daily target.
- **Diary**: breakfast, lunch, dinner and snacks for each day, with a calorie ring and macro bars.
- **Search**: packaged products from Open Food Facts (its search is often overloaded, so it can be unavailable)
  and generic foods such as fruit, meat and rice from [USDA FoodData Central](https://fdc.nal.usda.gov). USDA's
  shared demo key only allows a few searches an hour; paste a free personal key from
  [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup) into **Settings** for 1,000 an hour.
- **Recent foods and your own foods**: add a product that isn't in the database by copying its label.
  It's remembered by barcode the next time you scan it.
- **Private and offline**: your diary is stored only on your phone. Use **Settings → Export backup** to keep a copy.

## Put it on your phone

The app is published to GitHub Pages by the workflow in `.github/workflows/deploy.yml` every time `main` is pushed.

1. One-time setup: on GitHub open **Settings → Pages**, and under **Build and deployment → Source** choose
   **GitHub Actions**.
2. Push to `main` (or run the workflow from the **Actions** tab). When it finishes, the app is live at
   **https://superjosh800.github.io/calorie-tracker/**.
3. Open that link on your phone and install it:
   - **iPhone (Safari)**: tap **Share** → **Add to Home Screen**.
   - **Android (Chrome)**: tap **⋮** → **Install app** (or **Add to Home screen**).
4. Open it from the new home screen icon and allow camera access the first time you scan.

Updates are picked up automatically the next time you open the app after a push.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173 (also on your local network)
npm run build    # production build in dist/
```

The camera only works on `https://` pages or `localhost`, so test scanning on the GitHub Pages site
(or any https tunnel) rather than your computer's LAN address.

Product data © Open Food Facts contributors, available under the Open Database License.
