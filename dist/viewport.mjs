let preference=null;
try{preference=localStorage.getItem('opcg-fit');}catch{}
// Keep desktop cards readable by default.  The user can still choose compact whole-table view.
export function fitEnabled(){return preference==='on';}
export function toggleFit(){preference=fitEnabled()?'off':'on';try{localStorage.setItem('opcg-fit',preference);}catch{}}
export function fitMarkup(content){return `<div class="view-toolbar"><button data-fit aria-pressed="${fitEnabled()}">${fitEnabled()?'恢复原大小':'适应屏幕'}</button><span>${fitEnabled()?'紧凑显示 · 保持卡牌可读':'原大小显示'}</span></div><div class="fit-viewport"><div class="fit-scaler"><div class="fit-canvas">${content}</div></div></div>`;}
export function resizeTable(){
 const frame=document.querySelector('.fit-viewport'),scaler=document.querySelector('.fit-scaler'),canvas=document.querySelector('.fit-canvas');
 const on=!!frame&&fitEnabled();document.body.classList.toggle('fit-mode',on);
 if(!frame)return;
 const button=document.querySelector('[data-fit]');button.textContent=on?'恢复原大小':'适应屏幕';button.setAttribute('aria-pressed',String(on));button.nextElementSibling.textContent=on?'整桌显示 · 点卡查看大图':'原大小显示';
 canvas.style.cssText='';scaler.style.cssText='';frame.style.cssText='';
 if(!on)return;
 window.scrollTo(0,0);
 const top=frame.getBoundingClientRect().top;
 const height=Math.max(100,(visualViewport?.height||innerHeight)-top-4),width=frame.clientWidth;
 frame.style.height=height+'px';canvas.style.width=Math.max(960,Math.min(1400,width))+'px';
 const unconstrained=Math.min(1,width/canvas.offsetWidth,height/canvas.offsetHeight);
 const scale=unconstrained;
 canvas.style.transform=`scale(${scale})`;canvas.style.left='0px';
 scaler.style.width=(canvas.offsetWidth*scale)+'px';scaler.style.height=(canvas.offsetHeight*scale)+'px';scaler.style.marginLeft=Math.max(0,(width-canvas.offsetWidth*scale)/2)+'px';
}
let pending;
function schedule(){cancelAnimationFrame(pending);pending=requestAnimationFrame(resizeTable);}
addEventListener('resize',schedule);globalThis.visualViewport?.addEventListener('resize',schedule);
