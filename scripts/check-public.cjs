// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),site=path.join(root,'dist');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['.git','node_modules','__pycache__'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const fixture=path.join(root,'harpe-control/test-fixtures/named-macro-v1.bin');
for(const file of walk(root)){
 const rel=path.relative(root,file).replaceAll('\\','/');
 if(rel.split('/').slice(0,-1).some(d=>d.startsWith('build-')||d==='research'))throw Error('Private/build directory in public checkout: '+rel);
 if(/\.(bin|elf|exe|dll|msi|zip|pem|key)$/i.test(rel)&&file!==fixture)throw Error('Unexpected binary/private artifact: '+rel);
 if(!/\.bin$/i.test(rel)&&file!==__filename){const text=fs.readFileSync(file,'utf8');if(/C:[\\/]+Users[\\/]|storage-20\d{6}-|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/.test(text))throw Error('Private path or credential-like content: '+rel);}
}
const record=require('../harpe-control/firmware-extension/client.js').decodeRecord(fs.readFileSync(fixture));assert.equal(record.macro.name,'Hallo · Grüße 🖱');assert.equal(record.macro.events[0].value,'KeyE');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');assert.match(html,/<html lang="en"/);assert.doesNotMatch(html,/<script\s+src=/);assert.doesNotMatch(html,/<link[^>]+stylesheet/);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,11);const csp=/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];assert.ok(csp);assert.match(csp,/connect-src 'none'/);
for(const script of scripts){new vm.Script(script[1]);const hash=createHash('sha256').update(script[1]).digest('base64');assert.ok(csp.includes("'sha256-"+hash+"'"));}
for(const file of walk(site).filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate element IDs: '+file);for(const m of text.matchAll(/\b(?:href|src)="([^"]+)"/g)){const url=m[1];if(/^(?:https?:|data:|blob:|#)/.test(url))continue;const target=path.resolve(path.dirname(file),decodeURIComponent(url.split('#')[0]));assert.ok(target.startsWith(site+path.sep),'Outside-site reference: '+url);assert.ok(fs.existsSync(target),'Broken site reference: '+url);}}
console.log('Public source, synthetic fixture, inline script syntax/CSP and all relative site links verified.');
