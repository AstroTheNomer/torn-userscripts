// ==UserScript==
// @name         Needle Stat Labels
// @namespace    https://www.torn.com/profiles.php?XID=3221506
// @version      1.0
// @description  Labels each needle on Torn.com's items page with the stat it enhances (e.g. "Tyrosine (Dex)"). Works standalone, and alongside "Needles to top!".
// @author       AstroTheNomer [3221506]
// @match        https://www.torn.com/item.php
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AstroTheNomer/torn-userscripts/main/needle-stat-labels.user.js
// @updateURL    https://raw.githubusercontent.com/AstroTheNomer/torn-userscripts/main/needle-stat-labels.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    // Maps each needle's exact 'data-sort' name to the stat it enhances.
    // The label is shown in brackets right after the item name.
    const statLabels = {
        "Tyrosine":    "Dex",
        "Melatonin":   "Spd",
        "Epinephrine": "Str",
        "Serotonin":   "Def"
    };
    // Colour of the label text (stands out on Torn's dark theme).
    // Set to null to keep Torn's default text colour.
    const statLabelColor = "#4ea1ff";

    // --- CSS Selectors ---
    const itemContainerSelector = '#temporary-items';
    const itemSelector = 'li[data-sort]';

    // --- Internals ---
    const LABEL_FLAG = "needleStatLabeled"; // dataset marker so we never double-label
    let debounceTimer;
    const debounceWait = 300;

    // --- Debounce: run func only after 'wait' ms have passed since the last call ---
    function debounce(func, wait) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func(...args), wait);
        };
    }

    // --- Labeling ---
    // For each needle item, find the text node holding its visible name and
    // append a bracketed stat label right after it. Torn wraps the name in
    // elements with hashed/changing class names, so we match on the exact name
    // text rather than on a fragile CSS selector.
    function addStatLabels() {
        const container = document.querySelector(itemContainerSelector);
        if (!container) {
            return;
        }

        const items = container.querySelectorAll(itemSelector);
        items.forEach(item => {
            if (item.dataset[LABEL_FLAG]) {
                return; // Already labeled this element.
            }
            const sortName = (item.getAttribute('data-sort') || '').trim();
            const stat = statLabels[sortName];
            if (!stat) {
                return; // Not a needle we care about.
            }

            // Find the text node whose trimmed value equals the item name.
            const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);
            let nameNode = null;
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue.trim() === sortName) {
                    nameNode = node;
                    break;
                }
            }
            if (!nameNode || !nameNode.parentNode) {
                return; // Name not rendered yet; try again on the next pass.
            }

            const label = document.createElement('span');
            label.textContent = ' (' + stat + ')';
            label.className = 'needle-stat-label';
            label.style.fontWeight = 'bold';
            if (statLabelColor) {
                label.style.color = statLabelColor;
            }

            // Insert directly after the name text node.
            nameNode.parentNode.insertBefore(label, nameNode.nextSibling);
            item.dataset[LABEL_FLAG] = 'true';
        });
    }

    const debouncedAddStatLabels = debounce(addStatLabels, debounceWait);

    // --- Observe the item list so labels reappear as items load / re-render / re-sort ---
    function startObserver() {
        const targetNode = document.querySelector(itemContainerSelector);
        if (!targetNode) {
            setTimeout(startObserver, 1000); // Container not there yet; retry.
            return;
        }
        const observer = new MutationObserver(() => debouncedAddStatLabels());
        observer.observe(targetNode, { childList: true, subtree: true });
        console.log('Needle Stat Labels: observer active on', itemContainerSelector);
        // Initial pass on load.
        setTimeout(addStatLabels, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

})();
