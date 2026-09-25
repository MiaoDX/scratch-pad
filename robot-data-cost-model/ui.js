/* DOM helpers: no user-controlled HTML interpolation, no network dependencies. */
(function () {
  'use strict';
  const M=window.RDCM, $=id=>document.getElementById(id);
  const colors=['#3d72b4','#bd8940','#8971ab','#79909c','#329b92','#93bfc4','#b39b80','#b16a75','#576d79'];
  function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function clear(e){e.replaceChildren();return e;}
  const num=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:d}):'待确认';
  function money(v){if(!Number.isFinite(v))return '待确认';if(Math.abs(v)>=1e8)return num(v/1e8,2)+' 亿元';if(Math.abs(v)>=1e4)return num(v/1e4,1)+' 万元';return num(v,0)+' 元';}
  function qty(gb){return gb>=1e6?num(gb/1e6,2)+' PB':gb>=1e3?num(gb/1e3,2)+' TB':num(gb,2)+' GB';}
  function get(o,path){return path.split('.').reduce((a,k)=>a[k],o);}
  function set(o,path,value){const keys=path.split('.');const last=keys.pop();const parent=keys.reduce((a,k)=>a[k],o);if(!Object.prototype.hasOwnProperty.call(parent,last))throw new Error('未知字段');parent[last]=value;}
  function field(container,p,path,label,options={}){
    const row=node('div',undefined,'field'+(options.wide?' wide':'')),lab=node('label',label);
    const id='f-'+path.replaceAll('.','-');lab.htmlFor=id;
    const C=window.ReportContent;
    if(C){const g=options.g!==undefined?options.g:C.glossFor(path),t=options.tag!==undefined?options.tag:C.tagFor(path);
      const qb=g?C.q(g):null;if(qb)lab.append(qb);const tn=t?C.tag(t):null;if(tn)lab.append(tn);}
    if(options.note)lab.append(node('small',options.note));
    let input;
    if(options.choices){input=node('select');options.choices.forEach(([v,t])=>{const o=node('option',t);o.value=v;input.append(o);});}
    else{input=node('input');input.type='number';input.step=options.step||'any';input.min=options.min??0;if(options.max!==undefined)input.max=options.max;}
    input.id=id;input.dataset.path=path;input.value=get(p,path)??'';row.append(lab,input);container.append(row);return input;
  }
  function table(target,headers,rows){clear(target);const head=node('thead'),tr=node('tr');headers.forEach(h=>tr.append(node('th',h)));head.append(tr);const body=node('tbody');rows.forEach(row=>{const r=node('tr');row.forEach((v,i)=>{const c=node('td',typeof v==='string'?v:String(v));if(i)c.className='num';r.append(c);});body.append(r);});target.append(head,body);}
  function vendors(target){const t=node('table'),h=node('thead'),hr=node('tr');['供应商','标准','低频','冷层一','冷层二','证据与适用条件'].forEach(x=>hr.append(node('th',x)));h.append(hr);t.append(h);const b=node('tbody');
    Object.values(M.VENDORS).forEach(v=>{const r=node('tr');r.append(node('td',v.name));v.prices.forEach((p,i)=>{const c=node('td',p===null?'待报价':String(p));c.append(node('small',v.names[i]+' · '+v.status[i]));r.append(c);});const c=node('td');const a=node('a','官方来源');a.href=v.source;a.target='_blank';a.rel='noopener noreferrer';c.append(a,node('small',v.note));r.append(c);b.append(r);});t.append(b);clear(target).append(t);
  }
  function svg(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));return e;}
  function chart(target,legend,series,labels,unit){clear(target);clear(legend);const w=760,h=260,left=60,top=16,right=12,bottom=38,pw=w-left-right,ph=h-top-bottom;
    const totals=labels.map((_,i)=>M.sum(series.map(s=>Math.max(0,s.values[i]||0))));const max=Math.max(1,...totals)*1.12;
    const s=svg('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':unit+'；数值详见下方月度表'});
    for(let i=0;i<=4;i++){const value=max*i/4,y=top+ph*(1-i/4);s.append(svg('line',{x1:left,y1:y,x2:w-right,y2:y,stroke:'#e1e7eb'}));const text=svg('text',{x:left-8,y:y+4,'text-anchor':'end',fill:'#586e7c','font-size':11});text.textContent=num(value,1);s.append(text);}
    const bw=pw/labels.length;
    labels.forEach((label,i)=>{let total=0;series.forEach((a,j)=>{const value=Math.max(0,a.values[i]||0),bar=svg('rect',{x:left+i*bw+1,y:top+ph-(total+value)/max*ph,width:Math.max(1,bw-2),height:value/max*ph,fill:colors[j%colors.length]});const title=svg('title');title.textContent='第 '+label+' 月 / '+a.name+'：'+num(value,2)+' '+unit;bar.append(title);s.append(bar);total+=value;});if(i===0||i===labels.length-1||(i+1)%6===0){const text=svg('text',{x:left+(i+.5)*bw,y:h-13,'text-anchor':'middle',fill:'#586e7c','font-size':11});text.textContent=label;s.append(text);}});
    target.append(s);series.forEach((a,i)=>{const l=node('span'),sw=node('i');sw.style.background=colors[i%colors.length];l.append(sw,document.createTextNode(a.name));legend.append(l);});
  }
  function flash(text){$('flash').textContent=text;}
  function download(obj,name){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function encode(obj){return btoa(Array.from(new TextEncoder().encode(JSON.stringify(obj)),b=>String.fromCharCode(b)).join(''));}
  function decode(s){if(s.length>150000)throw new Error('情景过大');return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0))));}
  function error(message){const e=$('error');e.hidden=!message;e.textContent=message||'';$('results').hidden=!!message;}
  window.ReportUI={M,$,node,clear,num,money,qty,get,set,field,table,vendors,chart,flash,download,encode,decode,error,colors};
})();
