# torn-userscripts

A collection of [Tampermonkey](https://www.tampermonkey.net/) userscripts for [Torn](https://www.torn.com/).

## Scripts

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
