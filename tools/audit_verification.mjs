import {readFileSync,readdirSync,writeFileSync} from 'node:fs';

const ids=/\b(?:OP|EB|ST|PRB)\d{2}-\d{3}\b/g;
const cards=JSON.parse(readFileSync('dist/data/cards.json','utf8'));
const decks=JSON.parse(readFileSync('dist/data/decks.json','utf8'));
const evidence={};
for(const file of readdirSync('tests').filter(name=>name.endsWith('.test.mjs'))){
  const text=readFileSync(`tests/${file}`,'utf8');
  for(const id of text.match(ids)||[]) (evidence[id]??=[]).push(file);
}
const testedIds=Object.keys(evidence).sort();
const report={
  generatedAt:new Date().toISOString(),
  totalCards:cards.length,
  testReferencedCards:testedIds.length,
  notYetIndividuallyCertified:cards.length-testedIds.length,
  note:'“测试引用”表示该卡出现在可执行规则测试中，不等于该卡全部效果已经逐条人工核验。未逐卡认证的卡必须继续以中文官方卡表建立场景测试。',
  evidence:Object.fromEntries(testedIds.map(id=>[id,{testFiles:[...new Set(evidence[id])]}])),
  starterDeckEvidence:decks.filter(deck=>deck.name.startsWith('ST')).map(deck=>{const ids=Object.keys(deck.cards);const missing=ids.filter(id=>!evidence[id]);return {name:deck.name,total:ids.length,testReferenced:ids.length-missing.length,notYetReferenced:missing};})
};
writeFileSync('dist/data/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({totalCards:report.totalCards,testReferencedCards:report.testReferencedCards,notYetIndividuallyCertified:report.notYetIndividuallyCertified},null,2));
