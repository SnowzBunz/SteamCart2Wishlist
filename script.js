(async () => {
    "use strict";

    const KEEP_APPIDS = new Set([
        "3293260", // Waterpark Simulator (EXAMPLE, MUST BE STEAM GAME ID)

    ]);

    const KEEP_BUNDLEIDS = new Set([
        "75268" // The House Always Wins Deluxe Edition (EXAMPLE, MUST BE STEAM BUNDLE ID)
    ]);

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    console.clear();

    console.log("==========================================");
    console.log(" STEAM CART → WISHLIST CLEANER");
    console.log("==========================================");

    if (typeof g_sessionID === "undefined") {
        console.error("Steam session ID not found.");
        return;
    }

    let moved = 0;
    let kept = 0;
    let failed = 0;

    async function getCartItems() {

        const links = [
            ...document.querySelectorAll(
                'a[href*="/app/"], a[href*="/bundle/"], a[href*="/sub/"]'
            )
        ];

        const found = [];
        const seen = new Set();

        for (const link of links) {

            const href = link.href;

            const appMatch = href.match(/\/app\/(\d+)\//);
            const bundleMatch = href.match(/\/bundle\/(\d+)\//);
            const subMatch = href.match(/\/sub\/(\d+)\//);

            if (!appMatch && !bundleMatch && !subMatch)
                continue;

            const type = appMatch
                ? "APP"
                : bundleMatch
                    ? "BUNDLE"
                    : "SUB";

            const id =
                appMatch?.[1] ||
                bundleMatch?.[1] ||
                subMatch?.[1];

            const key = `${type}:${id}`;

            if (seen.has(key))
                continue;

            seen.add(key);

            // Find the cart container containing the Remove button.
            let container = link;

            for (let i = 0; i < 15 && container; i++) {

                const removeButton = [
                    ...container.querySelectorAll('[role="button"]')
                ].find(
                    b =>
                        b.textContent.trim().toLowerCase() === "remove"
                );

                if (removeButton) {
                    found.push({
                        type,
                        id,
                        link,
                        container,
                        removeButton
                    });

                    break;
                }

                container = container.parentElement;
            }
        }

        return found;
    }

    async function addToWishlist(appid) {

        const body = new URLSearchParams();

        body.set("sessionid", g_sessionID);
        body.set("appid", appid);

        const response = await fetch(
            "https://store.steampowered.com/api/addtowishlist",
            {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded; charset=UTF-8"
                },
                body
            }
        );

        const text = await response.text();

        let result;

        try {
            result = JSON.parse(text);
        } catch {
            result = null;
        }

        return result;
    }

    while (true) {

        const items = await getCartItems();

        console.log(`Current cart entries detected: ${items.length}`);

        if (!items.length) {
            console.log("No more cart entries detected.");
            break;
        }

        let processedSomething = false;

        for (const item of items) {

            // ==============================
            // PROTECTED ITEMS
            // ==============================

            if (
                item.type === "APP" &&
                KEEP_APPIDS.has(item.id)
            ) {
                console.log(`KEEP APP: ${item.id}`);
                kept++;
                continue;
            }

            if (
                item.type === "BUNDLE" &&
                KEEP_BUNDLEIDS.has(item.id)
            ) {
                console.log(`KEEP BUNDLE: ${item.id}`);
                kept++;
                continue;
            }

            // ==============================
            // SUBS / PACKAGES
            // ==============================

            if (item.type !== "APP") {
                console.warn(
                    `SKIP ${item.type}: ${item.id}`
                );
                continue;
            }

            // ==============================
            // PROCESS APP
            // ==============================

            const title =
                item.link.textContent.trim() ||
                item.link.querySelector("img")?.alt ||
                `App ${item.id}`;

            console.log("");
            console.log("------------------------------------------");
            console.log(`Processing: ${title}`);
            console.log(`AppID: ${item.id}`);

            try {

                const result = await addToWishlist(item.id);

                console.log("Wishlist response:", result);

                /*
                 * Steam can return different success formats.
                 *
                 * success === 1/true:
                 *   Successfully added.
                 *
                 * success === 0 with certain responses:
                 *   Can mean already wishlisted.
                 *
                 * We ONLY proceed automatically on explicit success.
                 */

                if (
                    !result ||
                    !(
                        result.success === true ||
                        result.success === 1
                    )
                ) {
                    console.warn(
                        `Wishlist did not explicitly succeed: ${title}`
                    );

                    failed++;
                    continue;
                }

                console.log(`✓ Added to Wishlist: ${title}`);

                await sleep(1000);

                // Re-find the current cart element.
                const currentItems = await getCartItems();

                const current = currentItems.find(
                    x =>
                        x.type === item.type &&
                        x.id === item.id
                );

                if (!current) {
                    console.log(
                        `Already disappeared from cart: ${title}`
                    );

                    moved++;
                    processedSomething = true;
                    break;
                }

                // Click Steam's actual React Remove button.
                current.removeButton.click();

                console.log(`✓ Removed from cart: ${title}`);

                moved++;
                processedSomething = true;

                await sleep(1800);

                break;

            } catch (error) {

                console.error(
                    `ERROR processing ${title}:`,
                    error
                );

                failed++;
            }
        }

        if (!processedSomething) {

            console.log("");
            console.log(
                "No removable item could be processed in this pass."
            );

            break;
        }
    }

    console.log("");
    console.log("==========================================");
    console.log(" COMPLETE");
    console.log("==========================================");
    console.log(`Moved to Wishlist: ${moved}`);
    console.log(`Protected:          ${kept}`);
    console.log(`Failed:             ${failed}`);
    console.log("==========================================");

    console.log("");
    console.log("Protected AppIDs:", [...KEEP_APPIDS]);
    console.log("Protected BundleIDs:", [...KEEP_BUNDLEIDS]);

    setTimeout(() => location.reload(), 3000);
})();
