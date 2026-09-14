import {readFileSync,writeFileSync} from 'node:fs';
import {unsupported} from '../dist/coverage.mjs';
const rules=JSON.parse(readFileSync('dist/data/rules.json','utf8')),decks=JSON.parse(readFileSync('dist/data/decks.json','utf8'));
const missing=Object.fromEntries(Object.entries(rules).map(([id,r])=>[id,unsupported(r)]).filter(([,v])=>v.length));
const report={total:Object.keys(rules).length,structurallyHandled:Object.keys(rules).length-Object.keys(missing).length,notYetHandled:Object.keys(missing).length,missing,deckCoverage:decks.map(d=>({name:d.name,missingCards:Object.keys(d.cards).filter(id=>missing[id])}))};
writeFileSync('dist/data/coverage.json',JSON.stringify(report));
console.log(JSON.stringify({total:report.total,structurallyHandled:report.structurallyHandled,notYetHandled:report.notYetHandled,starters:report.deckCoverage.filter(d=>d.name.startsWith('ST'))},null,2));
