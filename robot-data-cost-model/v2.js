(function(){
  'use strict';
  const U=window.ReportUI,{M,$,node,clear,num,money,qty}=U;
  let x={dailyTB:1000,days:90,deliveryTB:6000,load:1};
  let fixed={existingPB:0,existingGPU:0,coldReadPct:0,gpuPrice:8,idcStorCapex:55,idcGpuCapex:6,egressPrice:0.3,uplinkPrice:3000};
  const fixedKeys=Object.keys(fixed),baseKey='rdcm-executive-baseline-'+M.VERSION;
  let baseline=null,last=null;
  const spec=[{id:'standard',letter:'A / 比较基准',title:'全云标准存储',route:'原始数据、计算和成品均在同一云；全部保持标准存储。',limit:'读取直接；长期库存的容量费较高。'},
    {id:'tiered',letter:'B / 生命周期优化',title:'云上冷热分层',route:'原始数据前 7 天标准、之后低频；计算同云，成品低频。',limit:'减少容量费；低频取回与最低保存期补费已计入。'},
    {id:'hybrid',letter:'C / 利用自有资源',title:'已有 IDC + 公有云',route:'原始数据与全部计算在 IDC；成品上传云端低频，靠近客户交付。',limit:'运营费不含设备折旧；必须同时评估投资缺口与上线能力。'}];
  function parseSnapshot(s){
    const p=M.restore(s,'executive');if(!p.business||!p.fixed)throw new Error('缺少业务或固定前提');
    const f={};for(const key of fixedKeys){if(!Object.prototype.hasOwnProperty.call(p.fixed,key))throw new Error('缺少固定前提 '+key);f[key]=p.fixed[key];}
    M.executive(p.business,f);return {business:p.business,fixed:f};
  }
  try{const s=localStorage.getItem(baseKey);if(s){parseSnapshot(JSON.parse(s));baseline=JSON.parse(s);}}catch(e){}
  function sync(){
    $('daily').value=x.dailyTB/($('dailyUnit').value==='PB'?1000:1);
    $('delivery').value=x.deliveryTB/($('deliveryUnit').value==='PB'?1000:1);
    $('policy').value=x.days;$('load').value=x.load;
  }
  function fixedFields(){
    clear($('fixedFields'));
    const fields=[['existingPB','可用于本方案的已有 IDC 容量 / PB'],['existingGPU','可用于本方案的已有 GPU / 卡'],['coldReadPct','原始低频库存额外读取 / %·月'],['gpuPrice','云单卡完整实例 / 元·小时'],['idcStorCapex','IDC 存储造价 / 万元·可用PB'],['idcGpuCapex','IDC GPU 含主机造价 / 万元·卡'],['egressPrice','公网交付预算 / 元·GB'],['uplinkPrice','接入带宽预算 / 元·Gbps·月']];
    fields.forEach(([key,label])=>U.field($('fixedFields'),fixed,key,label,{min:0}));
  }
  function render(){
    try{
      const rows=M.executive(x,fixed);last=rows;U.error('');let bs=null;
      if(baseline){const s=parseSnapshot(baseline);bs=M.executive(s.business,s.fixed);}
      clear($('schemes'));
      rows.forEach((r,i)=>{
        const s=spec[i],box=node('article',undefined,'card scheme');box.append(node('div',s.letter,'letter'),node('h3',s.title),node('p',s.route,'route'),node('div','稳定规模月运营费 ≈','label'),node('div',money(r.monthly),'big'));
        const inv=node('div',undefined,'invest');inv.append(node('span','存储与 GPU 追加投入 ≈'),node('strong',money(r.capex)));box.append(inv);
        if(bs)box.append(node('p','较讨论基准：月费 '+(r.monthly-bs[i].monthly>=0?'+':'')+money(r.monthly-bs[i].monthly),'delta'));
        const bar=node('div',undefined,'horizontalbar');Object.values(r.parts).forEach((v,j)=>{const a=node('span');a.style.width=(r.monthly>0?v/r.monthly*100:0)+'%';a.style.background=U.colors[[0,2,4,1][j]];bar.append(a);});box.append(bar);
        box.append(node('p',s.limit,'limit'));
        if(i===2)box.append(node('p','新增容量 '+num(r.newPB,2)+' PB；新增 GPU '+num(r.newGPU,0)+' 卡。','muted'));
        $('schemes').append(box);
      });
      const t=node('table');U.table(t,['同口径费用','A · 全云标准','B · 云上分层','C · IDC + 云'],[['容量与存储运营',...rows.map(r=>money(r.parts.storage))],['计算与算力运营',...rows.map(r=>money(r.parts.compute))],['接入、搬运与交付',...rows.map(r=>money(r.parts.network))],['取回、保存期补费及服务预算',...rows.map(r=>money(r.parts.other))],['稳定规模月费（不含自建设备折旧）',...rows.map(r=>money(r.monthly))],['一次性追加设备投入',...rows.map(r=>money(r.capex))],['聚合链路需求（待验证）',...rows.map(r=>num(r.requiredGbps,1)+' Gbps')]]);clear($('comparison')).append(t);
      const diff=rows[1].monthly-rows[0].monthly;
      $('decisionText').textContent='当前假设下，云上分层相对全云标准的月费'+(diff<=0?'减少约 ':'增加约 ')+money(Math.abs(diff))+'；混合部署需追加约 '+money(rows[2].capex)+'。这些是预算比较，尚不足以确定采购赢家。';
      $('comparisonNote').textContent='三种方案均保有约 '+qty(rows[0].stockGB)+' 数据、每月交付 '+qty(x.deliveryTB*1000)+'。混合部署的月费不含硬件折旧，因此不能只比较月费；已有资源默认为未录入，需在下方核实。';
      $('baseNote').textContent=baseline?'基准已保存完整业务输入与固定前提。差值反映两组情景的变化，不自动归因为架构优化。':'尚未固定讨论基准。业务规模变化时，三个方案保持同口径同步计算。';
      $('snapshotLine').textContent='当前情景：每天 '+qty(x.dailyTB*1000)+'；原始全量保留 '+x.days+' 天；每月交付 '+qty(x.deliveryTB*1000)+'；计算负荷 '+x.load+' 倍。已有 IDC '+num(fixed.existingPB,2)+' PB / '+num(fixed.existingGPU,0)+' 卡；GPU '+num(fixed.gpuPrice,2)+' 元/实例小时；存储造价 '+num(fixed.idcStorCapex,2)+' 万元/PB。';
      window.executiveResult={business:M.clone(x),fixed:M.clone(fixed),rows:M.clone(rows)};
    }catch(e){last=null;$('decisionText').textContent='请先修正输入；当前情景不生成预算判断。';U.error('当前情景无法计算：'+e.message+'。修正参数后恢复显示。');}
  }
  ['daily','delivery','policy','load'].forEach(id=>$(id).addEventListener('input',()=>{
    x={dailyTB:$('daily').value===''?NaN:Number($('daily').value)*($('dailyUnit').value==='PB'?1000:1),deliveryTB:$('delivery').value===''?NaN:Number($('delivery').value)*($('deliveryUnit').value==='PB'?1000:1),days:Number($('policy').value),load:Number($('load').value)};render();
  }));
  ['dailyUnit','deliveryUnit'].forEach(id=>$(id).addEventListener('change',sync));
  $('fixedFields').addEventListener('change',e=>{const key=e.target.dataset.path;if(!fixedKeys.includes(key))return;fixed[key]=e.target.value===''?NaN:Number(e.target.value);render();});
  const save=()=>M.snapshot({business:x,fixed},'executive');
  $('saveBase').onclick=()=>{try{M.executive(x,fixed);baseline=save();try{localStorage.setItem(baseKey,JSON.stringify(baseline));}catch(e){}render();U.flash('已固定业务输入与预算前提，后续调整将显示差额。');}catch(e){U.flash(e.message);}};
  $('clearBase').onclick=()=>{baseline=null;try{localStorage.removeItem(baseKey);}catch(e){}render();U.flash('讨论基准已清除。');};
  $('export').onclick=()=>{try{M.executive(x,fixed);U.download(save(),'robot-data-executive-'+M.AS_OF+'.json');}catch(e){U.flash(e.message);}};
  $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>150000)throw new Error('情景文件过大');const s=parseSnapshot(JSON.parse(await f.text()));x=s.business;fixed=s.fixed;sync();fixedFields();render();U.flash('已还原讨论情景，来源版本 '+M.VERSION+'。');}catch(err){U.flash('导入失败：'+err.message);}e.target.value='';};
  $('print').onclick=()=>window.print();U.vendors($('vendorTable'));sync();fixedFields();render();
})();
