let preference=null;
try{preference=localStorage.getItem('opcg-fit');}catch{}
// Keep desktop cards readable by default.  The user can still choose compact whole-table view.
export function fitEnabled(){return preference==='on';}
export function toggleFit(){preference=fitEnabled()?'off':'on';try{localStorage.setItem('opcg-fit',preference);}catch{}}
export function fitMarkup(content){return `<div class="view-toolbar"><button data-fit aria-pressed="${fitEnabled()}">${fitEnabled()?'恢复原大小':'适应屏幕'}</button><span>${fitEnabled()?'整桌显示 · 点卡查看大图':'原大小显示'}</span></div><div class="fit-viewport"><div class="fit-canvas">${content}</div></div>`;}
export function resizeTable(){
 const frame=document.querySelector('.fit-viewport'),canvas=document.querySelector('.fit-canvas');
 const on=!!frame&&fitEnabled();document.body.classList.toggle('fit-mode',on);
 if(!frame)return;
 const button=document.querySelector('[data-fit]');button.textContent=on?'恢复原大小':'适应屏幕';button.setAttribute('aria-pressed',String(on));button.nextElementSibling.textContent=on?'整桌显示 · 点卡查看大图':'原大小显示';
 canvas.style.cssText='';frame.style.cssText='';
 if(!on)return;
 window.scrollTo(0,0);
 const top=frame.getBoundingClientRect().top;
 const height=Math.max(100,(visualViewport?.height||innerHeight)-top-4),width=frame.clientWidth;
 frame.style.height=height+'px';canvas.style.width=Math.max(960,Math.min(1400,width))+'px';
 const scale=Math.min(1,width/canvas.offsetWidth,height/canvas.offsetHeight);
 canvas.style.transform=`scale(${scale})`;canvas.style.left=Math.max(0,(width-canvas.offsetWidth*scale)/2)+'px';
}
let pending;
function schedule(){cancelAnimationFrame(pending);pending=requestAnimationFrame(resizeTable);}
addEventListener('resize',schedule);globalThis.visualViewport?.addEventListener('resize',schedule);
