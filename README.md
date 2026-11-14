# Percy Pennies

A simple monthly spending tracker for your phone. Log what you spend by category, then compare months, see a category over time (e.g. petrol from October to November), and look at the whole year.

## 📲 Install it

**Open this link on your phone: https://man95-dev.github.io/percy-pennies/**

- **iPhone (Safari):** tap **Share** → **Add to Home Screen**. Always open it from that icon so your data is kept.
- **Android (Chrome):** tap **⋮** → **Install app**.

## Your data

Everything is stored on the phone only (`localStorage` under `percy-pennies:v1`). Nothing financial is ever in this repo. **More → Save backup** exports a `.json` file; **More → Load backup** reads one back (also how to move to a new phone).

## How it works

- **Month:** spent, money in, saved and left over, with each group and line compared with the month before. Lines marked **Regular** (rent, bills) can be copied from last month in one tap.
- **Compare → Month vs month:** any two months side by side, biggest changes first.
- **Compare → Over time:** one category or line month by month, with average, highest and lowest. Averages leave out the month in progress.
- **Year:** totals per group, share of spending and the monthly average.
- **More:** rename, add or move groups and lines; backup and restore.

## For development

Plain HTML, CSS and JavaScript, no build step. Run `npx http-server -c-1` in this folder and open it. When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.
