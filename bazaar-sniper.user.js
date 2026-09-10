// ==UserScript==
// @name         Bazaar Sniper
// @namespace    https://github.com/AstroTheNomer/
// @version      1.0.0
// @description  Highlights bazaar items listed under market value on the bazaar you're viewing and one-click buys them through Torn's own buttons.
// @author       AstroTheNomer
// @match        https://www.torn.com/bazaar.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        none

// @downloadURL none
// ==/UserScript==

/*
 * Bazaar Sniper by AstroTheNomer.
 * Reads only data from the bazaar page you have loaded and are viewing, and only
 * buys in response to your own clicks, which it forwards to Torn's native Buy / Yes
 * buttons. It makes no requests of its own.
 */

// ---- Settings -------------------------------------------------------------

// Minimum discount below market value for an item to be listed (editable live in the panel).
let percentage = 5;

// If true, sets the native amount field to the full listed stock before buying.
const BUY_FULL_STACK = true;

// If true, also clicks Torn's own "Yes" in the confirmation dialog, so one helper
// click completes the whole purchase. Set to false to stop at Torn's Yes/No prompt
// and press Yes yourself (safer against accidental clicks).
const AUTO_CONFIRM = true;

// Set true only when troubleshooting — prints verbose lines to the browser console.
const DEBUG = false;
function dbg() {
    if (DEBUG) console.log.apply(console, ["[BazaarSniper]"].concat([].slice.call(arguments)));
}

// ---- State ----------------------------------------------------------------

let itemsById = {}; // bazaarID -> { id, name, price, amount, mv, blocked }
let bought = [];    // String(bazaarID) of items already bought this session

// ---- Small helpers --------------------------------------------------------

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// Poll for a value until it exists or we time out. Returns the value or null.
function waitFor(fn, timeout) {
    return new Promise((resolve) => {
        const start = Date.now();
        (function poll() {
            let r = null;
            try { r = fn(); } catch (e) { r = null; }
            if (r) return resolve(r);
            if (Date.now() - start > timeout) return resolve(null);
            setTimeout(poll, 50);
        })();
    });
}

// Dispatch a full pointer/mouse sequence so React buttons that don't respond to a
// bare .click() still fire. (Still triggered by the user's own helper click.)
function realClick(el) {
    let opts = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch (e) { }
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    try { el.dispatchEvent(new PointerEvent("pointerup", opts)); } catch (e) { }
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
}

// Set a React-controlled input's value so React notices the change.
function setNativeValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Concatenate only the direct text-node children of an element (ignores nested
// elements). Needed because the price element embeds a market-rate % as a child,
// e.g. <div>$100<div>81%</div></div> whose textContent is misleadingly "$10081%".
function directText(el) {
    let s = "";
    el.childNodes.forEach(function (n) {
        if (n.nodeType === 3) s += n.textContent;
    });
    return s;
}

// ---- Matching the native bazaar rows --------------------------------------

// Item name works in both collapsed ("name") and opened ("buy-item-name") states.
function getItemName(c) {
    let el = c.querySelector('[data-testid="name"], [data-testid="buy-item-name"]');
    return el ? el.textContent.trim() : null;
}

// Unit price, reading only the price element's own text (not the rate % child).
function getItemPrice(c) {
    let el = c.querySelector('[data-testid="price"], [data-testid="buy-item-price"]');
    if (!el) return null;
    let digits = directText(el).replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : null;
}

// Stock/amount shown on the row, used only to disambiguate identical listings.
function getItemStock(c) {
    let el = c.querySelector('[data-testid="amount-value"]');
    if (!el) return null;
    let digits = el.textContent.replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : null;
}

// Find the native bazaar item container(s) matching a name + unit price.
function findNativeItems(name, price) {
    let matches = [];
    let containers = document.querySelectorAll('[data-testid="item"]');
    for (let c of containers) {
        if (getItemName(c) === name && getItemPrice(c) === price) {
            matches.push(c);
        }
    }
    return matches;
}

// Forward the user's helper click to Torn's own native Buy / Yes buttons.
// Returns true only once Torn's purchase has been triggered.
async function triggerNativeBuy(name, price, amount) {
    let matches = findNativeItems(name, price);

    if (matches.length === 0) {
        addResult(`Couldn't find "${name}" @ $${price.toLocaleString()} on the page. Scroll it into view, then retry.`, "red");
        return false;
    }
    // If several listings share the same name+price, try to disambiguate by stock.
    if (matches.length > 1) {
        let refined = matches.filter((c) => getItemStock(c) === amount);
        if (refined.length === 1) {
            matches = refined;
        } else {
            matches[0].scrollIntoView({ behavior: "smooth", block: "center" });
            addResult(`Multiple "${name}" @ $${price.toLocaleString()} listings found — scrolled to one. Click its Buy button yourself to be safe.`, "orange");
            return false;
        }
    }

    let container = matches[0];
    container.scrollIntoView({ behavior: "smooth", block: "center" });

    // The real Buy button only exists once the buy menu is open. Collapsed rows
    // have an "activate-buy-button" that opens that menu first.
    let buyBtn = container.querySelector('button[data-testid="buy-button"]');
    if (!buyBtn) {
        let activate = container.querySelector('button[data-testid="activate-buy-button"]');
        if (activate) {
            realClick(activate); // open the buy menu (a native button, still user-initiated)
        }
        buyBtn = await waitFor(() => container.querySelector('button[data-testid="buy-button"]'), 2000);
        if (!buyBtn) {
            addResult(`Opened "${name}" but no Buy button appeared. Buy it manually.`, "orange");
            return false;
        }
    }

    // Let the newly-rendered menu attach its event handlers before we interact.
    await sleep(250);

    if (BUY_FULL_STACK) {
        let input = container.querySelector('input[data-testid="number-input"], input.buyAmountInput___PMrzV');
        if (input) {
            setNativeValue(input, amount);
            await sleep(100);
        }
    }

    realClick(buyBtn); // clicks Torn's OWN Buy button, which opens its confirmation dialog

    if (!AUTO_CONFIRM) {
        addResult(`Opened confirmation for ${name} x${amount.toLocaleString()} @ $${price.toLocaleString()}. Click "Yes" to finish.`, "yellow");
        return false; // leave the helper listed in case you cancel
    }

    // Click Torn's own "Yes", but only in the confirmation dialog for THIS item.
    let confirmBtn = await waitFor(() => {
        let dlgs = document.querySelectorAll('[data-testid="buy-confirmation"]');
        for (let d of dlgs) {
            if (d.textContent.includes(name)) {
                return d.querySelector('button[aria-label="Yes"]');
            }
        }
        return null;
    }, 2000);

    if (!confirmBtn) {
        addResult(`Confirmation for "${name}" didn't appear — finish it manually.`, "orange");
        return false;
    }

    realClick(confirmBtn); // clicks Torn's OWN "Yes"; Torn's code completes the purchase
    addResult(`Bought ${name} x${amount.toLocaleString()} @ $${price.toLocaleString()}.`, "green");
    return true;
}

// ---- UI -------------------------------------------------------------------

function addResult(resultMsg, rescol) {
    let colors = { green: "#7ec699", red: "#e57373", orange: "#e0a458", yellow: "#e6d24a" };
    let col = colors[rescol] || rescol || "#e6e6e6";
    let el = $("#ob-status");
    if (el.length) {
        el.html(`<span style="color:${col}">${resultMsg}</span>`).show();
    }
    dbg(resultMsg);
}

function cardHTML(row) {
    let it = row.it;
    let total = it.price * it.amount;
    return `<button class="itembuynao" data-id="${it.id}" data-name="${encodeURIComponent(it.name)}" data-amount="${it.amount}" data-price="${it.price}" title="Buy ${it.name}">
        <span class="ob-name">${it.name}</span>
        <span class="ob-sub">$${it.price.toLocaleString()} &times; ${it.amount.toLocaleString()} = $${total.toLocaleString()}</span>
        <span class="ob-badge">&#9660; ${row.discount.toFixed(0)}% under MV &middot; +$${Math.round(row.profit).toLocaleString()}</span>
    </button>`;
}

function update() {
    let rows = [];
    for (let id in itemsById) {
        let it = itemsById[id];
        if (bought.includes(String(it.id))) continue;
        if (it.blocked) continue;
        if (!it.mv || it.mv <= 0) continue;
        let discount = (1 - it.price / it.mv) * 100;
        if (discount < percentage) continue;
        rows.push({ it: it, discount: discount, profit: (it.mv - it.price) * it.amount });
    }
    rows.sort((a, b) => b.profit - a.profit);

    let list = $("#itemList");
    if (rows.length === 0) {
        list.html(`<div class="ob-empty">No items at least ${percentage}% under market value right now.</div>`);
    } else {
        list.html(rows.map(cardHTML).join(""));
    }
    $("#ob-count").text(`${rows.length} deal${rows.length === 1 ? "" : "s"}`);

    list.find(".itembuynao").off("click").on("click", async function () {
        let iid = $(this).attr("data-id");
        let iname = decodeURIComponent($(this).attr("data-name"));
        let iamount = parseInt($(this).attr("data-amount"), 10);
        let ip = parseInt($(this).attr("data-price"), 10);

        dbg("helper clicked:", { iid, iname, iamount, ip });
        addResult(`Looking for ${iname} @ $${ip.toLocaleString()}...`, "yellow");

        // The user physically clicked this helper. We forward that single click to
        // Torn's own native buttons; we never send a request ourselves.
        try {
            let ok = await triggerNativeBuy(iname, ip, iamount);
            if (ok) {
                bought.push(String(iid));
                delete itemsById[iid];
                update();
            }
        } catch (e) {
            console.error("[BazaarSniper] buy error:", e);
            addResult(`Error: ${e && e.message ? e.message : e}`, "red");
        }
    });
}

function insert() {
    if ($("div[class^='topSection']").length === 0) {
        setTimeout(insert, 300);
        return;
    }
    if ($("#displayContainer").length > 0) return;

    if ($("#ob-styles").length === 0) {
        $("head").append(`<style id="ob-styles">
            #displayContainer.ob-panel { position: relative; width: min(760px, 96%); margin: 8px auto; background:#22262b; color:#e6e6e6; border:1px solid #3a3f46; border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,.45); font:13px/1.4 Arial, sans-serif; text-transform:none; overflow:hidden; }
            .ob-header { display:flex; align-items:center; gap:12px; padding:8px 12px; background:#1a1d21; border-bottom:1px solid #3a3f46; }
            .ob-title { font-weight:700; color:#7ec699; letter-spacing:.3px; }
            .ob-thresh { font-size:12px; color:#aeb4bb; display:flex; align-items:center; gap:6px; }
            .ob-thresh input { width:52px; background:#2b2f35; color:#fff; border:1px solid #454b52; border-radius:4px; padding:2px 6px; font:12px Arial; }
            .ob-count { margin-left:auto; font-size:12px; color:#aeb4bb; }
            .ob-collapse { background:#2b2f35; color:#fff; border:1px solid #454b52; border-radius:4px; width:26px; height:24px; cursor:pointer; line-height:1; }
            .ob-collapse:hover { background:#343941; }
            .ob-list { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:6px; padding:8px; max-height:320px; overflow-y:auto; }
            .itembuynao { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; text-align:left; padding:7px 10px; background:#2b2f35; border:1px solid #3a3f46; border-left:3px solid #7ec699; border-radius:6px; color:#f0f0f0; cursor:pointer; text-transform:none; transition:background .1s; }
            .itembuynao:hover { background:#343941; border-left-color:#a6e3bd; }
            .ob-name { font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
            .ob-sub { font-size:12px; color:#c2c7cd; }
            .ob-badge { font-size:11px; font-weight:700; color:#7ec699; }
            .ob-empty { grid-column:1 / -1; color:#8a9099; font-size:12px; padding:6px 2px; }
            .ob-status { padding:6px 12px; border-top:1px solid #3a3f46; background:#1a1d21; font:12px Consolas, "Courier New", monospace; word-break:break-word; }
            .ob-list::-webkit-scrollbar { width:8px; }
            .ob-list::-webkit-scrollbar-thumb { background:#3b9ab7; border-radius:8px; }
            .ob-list::-webkit-scrollbar-track { background:#1a1d21; }
        </style>`);
    }

    let cont = `<div id="displayContainer" class="ob-panel">
        <div class="ob-header">
            <span class="ob-title">Bazaar Sniper</span>
            <label class="ob-thresh">Min discount <input id="ob-percent" type="number" min="0" max="99" value="${percentage}"> %</label>
            <span id="ob-count" class="ob-count">0 deals</span>
            <button id="ob-collapse" class="ob-collapse" title="Collapse / expand">&ndash;</button>
        </div>
        <div id="ob-body">
            <div id="itemList" class="ob-list"><div class="ob-empty">Waiting for bazaar data...</div></div>
            <div id="ob-status" class="ob-status" style="display:none;"></div>
        </div>
    </div>`;

    $(".content-wrapper").prepend(cont);

    $("#ob-percent").on("input", function () {
        let v = parseInt($(this).val(), 10);
        percentage = isNaN(v) ? 0 : v;
        update();
    });
    $("#ob-collapse").on("click", function () {
        let body = $("#ob-body");
        let hidden = body.is(":hidden");
        body.toggle();
        $(this).html(hidden ? "&ndash;" : "+");
    });
}

// ---- Read the bazaar you're viewing ---------------------------------------

if (window.location.href.includes("userId")) {

    insert();

    const { fetch: origFetch } = window;
    window.fetch = async (...args) => {
        dbg("fetch:", args && args[0]);

        const response = await origFetch(...args);

        // Only read the data for the bazaar you have loaded and are viewing.
        if (response.url && response.url.includes("/bazaar.php?sid=bazaarData&step=getBazaarItems")) {
            try {
                let clonedJ = await response.clone().json();
                for (let item of clonedJ.list) {
                    itemsById[item.bazaarID] = {
                        id: item.bazaarID,
                        name: item.name,
                        price: item.price,
                        amount: item.amount,
                        mv: item.averageprice,
                        blocked: item.isBlockedForBuying
                    };
                }
                update();
            } catch (e) {
                dbg("failed to parse bazaar data:", e);
            }
        }

        return response;
    };

}
