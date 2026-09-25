(function(){
  'use strict';
  const U=window.ReportUI,C=window.ReportContent,{M,$,node,clear,num,money,qty}=U;
  const DEF_X={hours:41900,rawDays:0,prodDays:0,deliveryHours:600000,load:1};
  let x={...DEF_X};
  let fixed={existingPB:100,existingGPU:0,coldReadPct:0,gpuPrice:8,idcStorCapex:55,idcGpuCapex:6,egressPrice:0.3,uplinkPrice:3000};
  const fixedKeys=Object.keys(fixed),businessKeys=Object.keys(DEF_X),baseKey='rdcm-executive-baseline-'+M.VERSION;
  let baseline=null;
  const spec=[
    {id:'standard',letter:'A / 比较基准',title:'全云 · 标准存储',route:()=>'处理、原始数据和可交付数据都在同一家云，全部放在标准档。',limit:'读取最方便；长期库存全部按最贵的档位计费。'},
    {id:'tiered',letter:'B / 生命周期优化',title:'全云 · 冷热分层',route:()=>'处理在云上；原始数据 90 天后转归档，满 1 年转深度归档；可交付数据放低频。',limit:'取回费与最低保存期补费已计入；重刷旧数据需要先解冻。'},
    {id:'window',letter:'C / 利用自有机房',title:'机房窗口 + 云归档',route:r=>'在机房处理；最近 '+r.windowDays+' 天原始数据留在机房，更早的转云上归档、满 1 年转深度归档；可交付数据上传云端低频。',limit:'机房造价与运营费为占位值；已有容量不计购置款。'}];
  const partRows=[['cloudStorage','云存储容量'],['access','取回、保存期补费与服务预算'],['cloudCompute','云上算力'],['idcStorage','机房存储（运营 + 折旧）'],['idcCompute','机房算力（运营 + 折旧）'],['network','接入、搬运与交付']];
  const partColors=[0,6,2,4,1,5];
  function parseSnapshot(s){
    const p=M.restore(s,'executive');if(!p.business||!p.fixed)throw new Error('缺少业务或固定前提');
    const b={},f={};
    for(const k of businessKeys){if(!Object.prototype.hasOwnProperty.call(p.business,k))throw new Error('缺少业务变量 '+k);b[k]=p.business[k];}
    for(const k of fixedKeys){if(!Object.prototype.hasOwnProperty.call(p.fixed,k))throw new Error('缺少固定前提 '+k);f[k]=p.fixed[k];}
    M.executive(b,f);return {business:b,fixed:f};
  }
  try{const s=localStorage.getItem(baseKey);if(s){parseSnapshot(JSON.parse(s));baseline=JSON.parse(s);}}catch(e){}
  function sync(){$('hours').value=x.hours;$('deliveryHours').value=x.deliveryHours;$('rawPolicy').value=String(x.rawDays);$('prodPolicy').value=String(x.prodDays);$('load').value=String(x.load);}
  function fixedFields(){
    clear($('fixedFields'));
    [['existingPB','已有机房可用容量 / PB',{note:'去掉冗余后的容量；决定机房窗口长度'}],['existingGPU','已有 GPU / 卡',{note:'0 = 尚未录入'}],['coldReadPct','原始冷库存每月额外读取 %'],['gpuPrice','云单卡完整实例 / 元·小时'],['idcStorCapex','机房存储造价 / 万元·可用 PB'],['idcGpuCapex','机房 GPU 含主机造价 / 万元·卡'],['egressPrice','公网交付 / 元·GB'],['uplinkPrice','接入带宽 / 元·Gbps·月']]
      .forEach(([key,label,o])=>U.field($('fixedFields'),fixed,key,label,{min:0,...(o||{})}));
  }
  const pb=gb=>qty(gb);
  function kv(label,value,gkey){const d=node('div',undefined,'kv'),l=node('span',label);if(gkey){const b=C.q(gkey);if(b)l.append(b);}d.append(l,node('strong',value));return d;}
  function render(){
    try{
      const rows=M.executive(x,fixed);U.error('');let bs=null;
      if(baseline){const s=parseSnapshot(baseline);bs=M.executive(s.business,s.fixed);}
      const r0=rows[0];
      $('hoursNote').textContent='约 '+pb(r0.rawGBday)+'/天原始数据';
      $('deliveryNote').textContent='约 '+pb(r0.deliveredGB)+'/月；可超过当月产出（重复销售）';
      clear($('schemes'));
      rows.forEach((r,i)=>{
        const s=spec[i],box=node('article',undefined,'card scheme');
        const lab=node('div','36 个月总成本（费用 + 折旧）','label');
        box.append(node('div',s.letter,'letter'),node('h3',s.title),node('p',s.route(r),'route'),lab,node('div',money(r.total36),'big'));
        if(bs){const d=r.total36-bs[i].total36;box.append(node('p','较讨论基准 '+(d>=0?'+':'')+money(d),'delta'));}
        box.append(kv('第 12 个月月费',money(r.month12)),kv('基础设施费 / 交付小时',r.perHour===null?'无交付':money(r.perHour),'perHour'));
        const inv=node('div',undefined,'invest'),il=node('span','追加设备投入（现金）');const qb=C.q('capex');if(qb)il.append(qb);inv.append(il,node('strong',money(r.capex)));box.append(inv);
        const bar=node('div',undefined,'horizontalbar');partRows.forEach(([k],j)=>{const a=node('span');a.style.width=(r.total36>0?Math.max(0,r.parts[k])/r.total36*100:0)+'%';a.style.background=U.colors[partColors[j]];a.title=partRows[j][1];bar.append(a);});box.append(bar);
        box.append(node('p',s.limit,'limit'));
        if(r.id==='window'){box.append(node('p','机房窗口 '+r.windowDays+' 天（已有 '+num(r.existingPB,0)+' PB）；新增容量 '+num(r.newPB,1)+' PB，新增 GPU '+num(r.newGPU,0)+' 卡。','muted'));const f=node('p',undefined,'flag');f.append(node('span','含占位报价','pill warn'));box.append(f);}
        $('schemes').append(box);
      });
      const legend=node('div',undefined,'legend');partRows.forEach(([,n],j)=>{const l=node('span'),sw=node('i');sw.style.background=U.colors[partColors[j]];l.append(sw,document.createTextNode(n));legend.append(l);});$('schemes').append(legend);legend.style.gridColumn='1 / -1';
      const t=node('table');U.table(t,['36 个月合计','A · 全云标准','B · 全云分层','C · 机房窗口 + 云归档'],[
        ...partRows.map(([k,n])=>[n,...rows.map(r=>money(r.parts[k]))]),
        ['36 个月总成本',...rows.map(r=>money(r.total36))],
        ['第 12 个月月费',...rows.map(r=>money(r.month12))],
        ['基础设施费 / 交付小时（第 12 个月）',...rows.map(r=>r.perHour===null?'无交付':money(r.perHour))],
        ['追加设备投入（现金）',...rows.map(r=>money(r.capex))],
        ['第 36 个月末数据总量',...rows.map(r=>pb(r.stockGB))],
        ['链路需求（第 12 个月，待验证）',...rows.map(r=>num(r.requiredGbps,1)+' Gbps')]]);
      clear($('comparison')).append(t);
      const [a,b,c]=rows,ab=b.total36-a.total36;
      $('decisionText').textContent='按当前假设，36 个月总成本：A '+money(a.total36)+'，B '+money(b.total36)+'，C '+money(c.total36)+'。冷热分层相对全部标准档'+(ab<=0?'少约 ':'多约 ')+money(Math.abs(ab))+'，这是不依赖机房报价的结论。C 依赖机房占位报价和已有 '+num(fixed.existingPB,0)+' PB 容量，拿到报价前只作方向参考。';
      $('comparisonNote').textContent='三个方案每天采集 '+num(x.hours,0)+' 小时（约 '+pb(a.rawGBday)+'），每月交付 '+num(x.deliveryHours,0)+' 小时，原始数据'+(x.rawDays?'保留 '+x.rawDays+' 天':'永久保留')+'，可交付数据'+(x.prodDays?'保留 '+x.prodDays+' 天':'长期保留')+'。总成本随时间增长，是因为保留的数据在持续累积。';
      $('baseNote').textContent=baseline?'基准已保存完整业务输入与固定前提；差值反映两组情景的变化。':'尚未固定讨论基准。';
      $('snapshotLine').textContent='当前情景：每天采集 '+num(x.hours,0)+' 小时；原始数据'+(x.rawDays?'保留 '+x.rawDays+' 天':'永久保留')+'；可交付数据'+(x.prodDays?'保留 '+x.prodDays+' 天':'长期保留')+'；每月交付 '+num(x.deliveryHours,0)+' 小时；计算负荷 '+x.load+' 倍；已有机房 '+num(fixed.existingPB,0)+' PB / '+num(fixed.existingGPU,0)+' 卡。';
      window.executiveResult={business:M.clone(x),fixed:M.clone(fixed),rows:M.clone(rows)};
    }catch(e){$('decisionText').textContent='请先修正输入；当前情景不生成预算判断。';U.error('当前情景无法计算：'+e.message+'。修正参数后恢复显示。');}
  }
  const read=id=>$(id).value===''?NaN:Number($(id).value);
  ['hours','deliveryHours','rawPolicy','prodPolicy','load'].forEach(id=>$(id).addEventListener('input',()=>{
    x={hours:read('hours'),deliveryHours:read('deliveryHours'),rawDays:Number($('rawPolicy').value),prodDays:Number($('prodPolicy').value),load:Number($('load').value)};render();
  }));
  $('fixedFields').addEventListener('change',e=>{const key=e.target.dataset.path;if(!fixedKeys.includes(key))return;fixed[key]=e.target.value===''?NaN:Number(e.target.value);render();});
  const save=()=>M.snapshot({business:x,fixed},'executive');
  $('saveBase').onclick=()=>{try{M.executive(x,fixed);baseline=save();try{localStorage.setItem(baseKey,JSON.stringify(baseline));}catch(e){}render();U.flash('已固定业务输入与预算前提，后续调整将显示差额。');}catch(e){U.flash(e.message);}};
  $('clearBase').onclick=()=>{baseline=null;try{localStorage.removeItem(baseKey);}catch(e){}render();U.flash('讨论基准已清除。');};
  $('export').onclick=()=>{try{M.executive(x,fixed);U.download(save(),'robot-data-executive-'+M.AS_OF+'.json');}catch(e){U.flash(e.message);}};
  $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>150000)throw new Error('情景文件过大');const s=parseSnapshot(JSON.parse(await f.text()));x=s.business;fixed=s.fixed;sync();fixedFields();render();U.flash('已还原讨论情景，来源版本 '+M.VERSION+'。');}catch(err){U.flash('导入失败：'+err.message);}e.target.value='';};
  $('print').onclick=()=>window.print();
  C.mount();U.vendors($('vendorTable'));sync();fixedFields();render();
})();
