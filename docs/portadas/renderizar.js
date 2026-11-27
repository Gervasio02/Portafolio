const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const n of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1080 } });
  require('fs').writeFileSync(`/tmp/portadas/${n}.html`, `<html><head><style>
  @font-face{font-family:"Plex Sans";src:url("file:///tmp/portadas/ibm-plex-sans-latin-400-normal.woff2");font-weight:400}
  @font-face{font-family:"Plex Sans";src:url("file:///tmp/portadas/ibm-plex-sans-latin-500-normal.woff2");font-weight:500}
  @font-face{font-family:"Plex Sans";src:url("file:///tmp/portadas/ibm-plex-sans-latin-600-normal.woff2");font-weight:600 700}
  @font-face{font-family:"Plex Mono";src:url("file:///tmp/portadas/ibm-plex-mono-latin-400-normal.woff2");font-weight:400}
  @font-face{font-family:"Plex Mono";src:url("file:///tmp/portadas/ibm-plex-mono-latin-500-normal.woff2");font-weight:500 600}
  body{margin:0;background:#000}</style></head><body>${require('fs').readFileSync('/tmp/portadas/'+n+'.svg','utf8')}</body></html>`); await p.goto(`file:///tmp/portadas/${n}.html`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/portadas/${n}.png` }); await p.close(); }
await b.close(); })();
