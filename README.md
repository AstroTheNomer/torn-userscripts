# torn-userscripts

A collection of [Tampermonkey](https://www.tampermonkey.net/) userscripts for [Torn](https://www.torn.com/).

## Scripts

### Bazaar Sniper

Scans the bazaar you're viewing and highlights every item listed below its market value, sorted by total profit, so the best deals are easy to spot:

- Each deal shows the item name, `price × quantity = total`, and how far under market value it is.
- A **Min discount** control in the panel filters the list live (default 5%).
- Clicking a deal buys it by driving Torn's **own** Buy and confirmation buttons — one click per purchase.

It only reads data from the bazaar page you have loaded and are viewing, and it makes no requests of its own — purchases go through Torn's native buttons, triggered by your click.

**Install:** [bazaar-sniper.user.js](https://raw.githubusercontent.com/AstroTheNomer/torn-userscripts/main/bazaar-sniper.user.js)
(with Tampermonkey installed, opening that link prompts to install; auto-updates are wired to this repo.)

#### Customising

Settings are at the top of the script:

- `percentage` — default minimum discount below market value (also editable live in the panel).
- `BUY_FULL_STACK` — buy the seller's full listed quantity (`true`) or leave Torn's default amount (`false`).
- `AUTO_CONFIRM` — click Torn's "Yes" automatically (`true`) or stop at the confirmation so you press Yes yourself (`false`).
- `DEBUG` — set `true` for verbose console logging while troubleshooting.

### Needle Stat Labels

Labels each needle on the items page with the stat it enhances, so you can tell them apart at a glance:

- **Tyrosine (Dex)**
- **Melatonin (Spd)**
- **Epinephrine (Str)**
- **Serotonin (Def)**

The label is shown in bold blue so it stands out on Torn's dark theme.

Works on its own, and also plays nicely alongside the [Needles to top!](https://greasyfork.org/scripts/531871) sorter by Elaine [2047176] — the labels stick to each item even when that script re-sorts the list.

**Install:** [needle-stat-labels.user.js](https://raw.githubusercontent.com/AstroTheNomer/torn-userscripts/main/needle-stat-labels.user.js)
(with Tampermonkey installed, opening that link prompts to install; auto-updates are wired to this repo.)

#### Customising

Both settings are at the top of the script:

- `statLabels` — change the wording of any label, e.g. `"Tyrosine": "Dexterity"`.
- `statLabelColor` — change the colour, or set it to `null` to use Torn's default text colour.

## Author

AstroTheNomer [3221506]

## License

MIT
