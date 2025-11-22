# Understanding Extension Code (src/extension)

located at src/extension is the extension logic of the code base 

High-level:
* The extension has three main parts
    * content-script.tsx
        * runs insdie the webpage we are visiting (like zara for example)
    * background.tsx
        * this is a server worker that runs in the background of chrome. this does the taling to supabase and handles database queries 
    * popup.tsx
        * this controls the little popup UI that we see when clicking the extension icon 
    * all three of these parts communicate with eachother using `chrome.runtime.sendMessage()`

so what does each file do?

`background.tsx`
* this listens for messages from the content script or popup
* it talks to supabase to fetch sustainability scores for brands 
* it returns the results back to whoever asks 
* key parts
    * `const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);`
        * this connects the extension to the database 
    * queryOverallScore(brandName)
        * this function takes a brand name like "zara" and:
            * tries to do an exact match
            * tries to do fuzzy match using Supabase ILIKE (%brand%)
        * then it returns the `overall_score`
    * queryOverallScoreByUrl(url)
        * given a URL (like https://www.patagonia.com/shop/jackets), it will:
            * try to match on the full URL
            * try to match on just the origin (https://www.patagonia.com)
            * try fuzzy match on the hostname (patagonia.com)
        * then it returns the { brand, score } 
    * message listener 
        * `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... });`
        * lets other parts of the extension send queries like:
            * `{ type: "GET_BRAND_SCORE", brand: "Patagonia" }`
            * the background responds with: `{ ok: true, score: 9 }`

`content-script.tsx`
* this runs inside of the webpage
* the file is injected into every webpage that you visit
* what it does:
    * it looks at the webpage and tries t guess the brand name 
    * sends the brandname to the background script
    * receives the sustainability score
    * draws a badge on the webpage like:
        * eco: 8
* key parts
    * detectBrandFromPage()
        * attempts to extract the brand from:
            * hostname (patagonia.com -> Patagonia)
            * URL path (/nike/shoes)
            * `<h1> text`
            * `<title>`
            * `<meta property="og:site_name">`
        * these are basically some heuristics for identifying a url, more can be added here
    * injectBadge(score)
        * creates a floating little box at the bottom-right
        * it will write `Eco: 7` for example 
    * `chrome.runtime.sendMessage({ type: 'GET_BRAND_SCORE', brand })`
        * this also asks for the background script for the score, and the backgroudn script will return:
            * `{ ok: true, score: 7 }`
        * the badge is then injected

`popup.tsx`
* this is a normal react file rendered inside the extension popup window
    * it creates the popup react root
    * shows a close buton
    * renders `<ExtensionPopup />` (the UI component for the popup)
* key lines:
    ```
    const rootEl = document.getElementById("root");
    createRoot(rootEl).render(
    <ExtensionPopup />
    )
    ```
    * this is the standard Reacat bootstrap
