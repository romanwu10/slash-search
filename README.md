# Slash Search

Press '/' to instantly focus the search box on most websites — just like Google’s pages. No adapters needed for native-supported sites; the extension sits quietly there.

Native supported (ignored): GitHub, X/Twitter, Gmail, Drive, Docs, YouTube.

Install (Chrome/Edge)
- Open chrome://extensions
- Enable Developer mode
- Click "Load unpacked" and select this folder

Install (Firefox)
- Open about:debugging#/runtime/this-firefox
- Click "Load Temporary Add-on" and pick `manifest.json`

How it works
- Listens for the '/' key when you’re not typing in an input/textarea/contenteditable
- Finds a likely search box via heuristics (type=search, role=searchbox, placeholder/aria-label/name hints)
- Includes adapters for common sites like Amazon, LinkedIn, Reddit, Bilibili, SHEIN, Apple, TikTok, Pinterest, IMDb, eBay, Weather.com, Fandom, Pornhub, XVideos, XHamster, XNXX, AliExpress, ePorner, Home Depot, Realtor.ca, Costco, MeteoMedia, Wikipedia, Stack Overflow, Chrome Web Store, Microsoft Edge site
- Focuses and selects the input so you can type immediately

Notes
- If a page already has '/', it may still win if we’re excluded or it binds earlier; send a link if something conflicts
- Firefox’s built-in Quick Find also uses '/'. Our script prevents default when it finds a search box; otherwise Firefox behavior remains
- To publish as open source, add a LICENSE (MIT recommended) before releasing

Development
- Manifest V3 content script at `src/content.js`
- Matches all sites except the native-supported excludes in `manifest.json`
- No build step; edit files and reload the extension

Roadmap
- Options page: custom hotkey, site include/exclude list
- More site adapters (send requests!)

Issues and feedback
- Open an issue or share a URL + expected behavior
