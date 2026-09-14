const files={attack:'attack',damage:'damage',draw:'draw',deploy:'deploy',discard:'discard',start:'gamestart',don:'click3',counter:'click3'};

// Compare committed states so invalid actions and cancelled choices stay silent.
export function soundEvents(before,after,command){
 if(!before||command.type==='undo')return [];
 if(after.winner!==null&&before.winner===null)return ['win'];
 const events=[];
 // A triggered life card waits for a choice before moving; signal the hit once.
 const triggerHit=after.prompt?.type==='lifeTrigger'&&after.prompt.card!==before.prompt?.card;
 const lifeLost=after.players.some((p,o)=>p.life.length<before.players[o].life.length&&!(before.prompt?.type==='lifeTrigger'&&before.prompt.owner===o));
 if(triggerHit||lifeLost)events.push('damage');
 if(command.type==='attack')events.push('attack');
 if(before.prompt?.type==='counter'&&command.uid)events.push('counter');
 for(const c of Object.values(after.cards)){
  const old=before.cards[c.uid];if(!old)continue;
  if(old.zone==='deck'&&c.zone==='hand')events.push('draw');
  if(!['field','stage'].includes(old.zone)&&['field','stage'].includes(c.zone))events.push('deploy');
  if(c.id==='DON'&&(old.zone!==c.zone||old.attached!==c.attached||old.rested!==c.rested))events.push('don');
  if(c.zone==='trash'&&old.zone!=='trash')events.push('discard');
 }
 return [...new Set(events)].slice(0,3);
}

export class GameSound {
 constructor(){
  this.muted=false;this.volume=.35;this.context=null;this.buffers={};this.sources=new Set();this.generation=0;
  try{const v=JSON.parse(localStorage.getItem('opcg-audio')||'null');if(v){this.muted=!!v.muted;if(Number.isFinite(v.volume))this.volume=Math.max(0,Math.min(1,v.volume));}}catch{}
 }
 save(){try{localStorage.setItem('opcg-audio',JSON.stringify({muted:this.muted,volume:this.volume}));}catch{}}
 setMuted(value){this.muted=value;this.generation++;this.applyVolume();if(value)for(const s of this.sources){try{s.stop();}catch{}}this.save();}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.applyVolume();this.save();}
 applyVolume(){if(this.gain)this.gain.gain.value=this.muted?0:this.volume;}
 unlock(){
  if(this.muted)return;
  try{
   if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;this.context=new Audio();this.gain=this.context.createGain();this.gain.connect(this.context.destination);this.applyVolume();}
   if(this.context.state==='suspended')this.context.resume().catch(()=>{});
  }catch{/* Audio support must never block the game. */}
 }
 async buffer(name){
  const file=files[name];if(!file)return null;
  if(!this.buffers[file])this.buffers[file]=fetch(new URL(`./audio/${file}.wav${file==='damage'?'?v=2':''}`,import.meta.url)).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)).catch(()=>null);
  return this.buffers[file];
 }
 track(source){this.sources.add(source);source.onended=()=>{source.disconnect();this.sources.delete(source);};}
 async play(names){
  if(this.muted||!this.volume||!names.length)return;
  this.unlock();if(!this.context)return;
  const generation=this.generation;
  try{
   if(this.context.state!=='running')return;
   const loaded=await Promise.all(names.map(n=>this.buffer(n)));
   if(this.muted||generation!==this.generation||this.context.state!=='running')return;
   names.forEach((name,i)=>{
    const at=this.context.currentTime+i*.12;
    if(name==='win'){[523.25,659.25,783.99,1046.5].forEach((hz,j)=>{const oscillator=this.context.createOscillator(),envelope=this.context.createGain(),t=at+j*.13;oscillator.type='sine';oscillator.frequency.value=hz;envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(.2,t+.015);envelope.gain.exponentialRampToValueAtTime(.001,t+.35);oscillator.connect(envelope);envelope.connect(this.gain);this.track(oscillator);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();this.sources.delete(oscillator);};oscillator.start(t);oscillator.stop(t+.36);});}
    else if(loaded[i]){const source=this.context.createBufferSource();source.buffer=loaded[i];source.connect(this.gain);this.track(source);source.start(at);}
   });
  }catch{/* A failed sound must not interrupt a committed move. */}
 }
}
