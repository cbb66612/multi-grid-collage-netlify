// Inline critical styling and split the tool script without changing its behavior.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const hash = content => crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
const minifyCSS = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim();
let html = read('index.html');
const appCSS = minifyCSS(read('assets/app-v14.css'));
const appStyle = `<style id="workbench-style">${appCSS}</style>`;
html = html.replace(/<link rel="stylesheet" href="assets\/app-v14\.css">|<style id="workbench-style">[\s\S]*?<\/style>/, appStyle);
const toolMatch = html.match(/<script>\s*(\/\* ========= 全局 ========= \*\/[\s\S]*?)<\/script>/);
if (toolMatch) {
  fs.writeFileSync(path.join(root, 'assets/tool-v15.js'), toolMatch[1]);
  html = html.replace(toolMatch[0], '<script defer src="assets/tool-v15.js"></script>');
}
const iconNames = new Set((html + read('assets/tool-v15.js') + read('assets/app-v14.js')).match(/bi-[a-z0-9-]+/g));
const originalIcons = read('assets/icons/bootstrap-icons.min.css');
const iconRules = [...originalIcons.matchAll(/\.bi-([a-z0-9-]+)::before\{[^}]+\}/g)]
  .filter(match => iconNames.has(`bi-${match[1]}`)).map(match => match[0]).join('');
const iconCSS = `/* Bootstrap Icons v1.11.3, MIT, Copyright The Bootstrap Authors. */
@font-face{font-display:swap;font-family:bootstrap-icons;src:url("/assets/icons/fonts/bootstrap-icons.woff2") format("woff2")}
.bi::before{display:inline-block;font-family:bootstrap-icons!important;font-style:normal;font-weight:400!important;font-variant:normal;text-transform:none;line-height:1;vertical-align:-.125em;-webkit-font-smoothing:antialiased}${iconRules}`;
html = html.replace(/<link rel="stylesheet" href="assets\/icons\/bootstrap-icons\.min\.css">|<style id="tool-icons">[\s\S]*?<\/style>/, `<style id="tool-icons">${iconCSS}</style>`);
html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_, attrs, css) => `<style${attrs}>${minifyCSS(css)}</style>`);
html = html.replace(/<script(?: defer)? src="assets\/(collage-layout-v16|tool-v15|app-v14)\.js(?:\?v=[a-f0-9]+)?"><\/script>/g,
  (_, name) => `<script defer src="assets/${name}.js?v=${hash(read(`assets/${name}.js`))}"></script>`);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Fast shell: ${Buffer.byteLength(html)} bytes; ${iconNames.size} icon rules; no external blocking stylesheets.`);
