import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soundEvents} from '../dist/sound.mjs';
const state=()=>({winner:null,cards:{},players:[{life:['a','b']},{life:['c','d']}],prompt:{type:'counter',owner:1}});
test('successful life damage gets a distinct hit sound; blocked combat stays silent',()=>{const a=state(),b=structuredClone(a);b.prompt=null;assert.deepEqual(soundEvents(a,b,{type:'choose',value:'finish'}),[]);b.players[1].life.shift();assert.deepEqual(soundEvents(a,b,{type:'choose',value:'finish'}),['damage']);});
test('life trigger hit sounds once before its choice, not again when the card moves',()=>{const a=state(),b=structuredClone(a);b.prompt={type:'lifeTrigger',owner:1,card:'c'};assert.deepEqual(soundEvents(a,b,{type:'choose',value:'finish'}),['damage']);const c=structuredClone(b);c.players[1].life.shift();c.prompt=null;assert.deepEqual(soundEvents(b,c,{type:'choose',value:'no'}),[]);});
test('a second double-attack life trigger still sounds',()=>{const a=state();a.prompt={type:'lifeTrigger',owner:1,card:'c'};const b=structuredClone(a);b.players[1].life.shift();b.prompt.card='d';assert.deepEqual(soundEvents(a,b,{type:'choose',value:'no'}),['damage']);});
test('undo never plays damage',()=>{const a=state(),b=structuredClone(a);b.players[1].life.shift();assert.deepEqual(soundEvents(a,b,{type:'undo'}),[]);});
