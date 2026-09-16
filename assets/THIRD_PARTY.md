# Geographic animation dependencies

The opening and experience globe are original implementations in `motion.js` and `motion.css`.

- Map: world-atlas 2.0.2, redistributed Natural Earth land data (public domain). https://www.naturalearthdata.com/ ; https://github.com/topojson/world-atlas
- d3-geo 3.1.1 and d3-array (transitive dependency), ISC license. https://github.com/d3/d3-geo ; https://github.com/d3/d3-array
- internmap (transitive dependency), ISC license. https://github.com/mbostock/internmap
- topojson-client 3.1.0, ISC license. https://github.com/topojson/topojson-client

Full dependency license notices are in `vendor-licenses.txt`. Map coordinates represent city-level locations, not specific buildings or campuses.

Rebuild: run `npm ci` then `npm run build` in the website directory. The committed bundle and map data can be served as static files without npm on the web server.

## Fonts (self-hosted, assets/fonts/)
- Archivo — Omnibus-Type, SIL Open Font License 1.1
- IBM Plex Mono — IBM, SIL Open Font License 1.1
- Newsreader — Production Type, SIL Open Font License 1.1
Subsets taken from the @fontsource packages.

## Reading graph
- d3-force — Mike Bostock, ISC
- Graph data generated from https://github.com/Solvement/jarvis-digest (MIT)
