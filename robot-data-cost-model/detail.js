(function(){
  'use strict';
  const U=window.ReportUI,C=window.ReportContent,{M,$,node,clear,num,money,qty,field}=U;
  let P=M.clone(M.DEFAULT),base=null,results=null,timer;
  const baseKey='rdcm-detail-baseline-'+M.VERSION;
  try{const s=new URLSearchParams(location.hash.slice(1)).get('s');if(s)P=M.restore(U.decode(s));}catch(e){U.flash('未载入链接：'+e.message+'。已展示默认示例。');}
  try{const saved=localStorage.getItem(baseKey);if(saved){const s=JSON.parse(saved);M.restore(s);base=s;}}catch(e){U.flash('已忽略不兼容的本地基线。');}
  const place=[['cloud','公有云'],['idc','IDC']],tiers=[['std','标准'],['ia','低频'],['arc','冷层一'],['deep','冷层二']];
  function section(title,open,note){const d=node('details');d.open=open;d.append(node('summary',title));const b=node('div',undefined,'body');if(note)b.append(node('p',note,'sub'));d.append(b);$('params').append(d);return b;}
  function fields(b,items){items.forEach(([path,label,opts])=>field(b,P,path,label,opts||{}));}
  function build(){
    clear($('params'));$('params').append(C.tagLegend());
    let b=section('采集与处理产出',true,'按机器人采集时长计；GB/h 为全部视角和传感器合计，不是单路视频码率。');
    P.mod.forEach((m,i)=>{const box=node('div',undefined,'task');box.append(node('h3',m.name));fields(box,[[`mod.${i}.h`,'采集小时 / 天'],[`mod.${i}.raw`,'原始 GB / 小时'],[`mod.${i}.del`,'可交付数据 GB / 小时']]);b.append(box);});
    fields(b,[['growth','月增长 %',{min:-99,max:100}],['lagDays','可交付数据输出延迟 / 天',{step:1}]]);
    b=section('生命周期与初始库存',true,'天数为数据年龄阈值，不是额外增加的停留天数。最终保留 0 = 无限期。');
    fields(b,[['hotDays','原始热缓冲 / 天',{step:1}],['retain','原始长期留存 %',{max:100}],['stdDays','满多少天转冷层一',{step:1}],['coldTier','冷层一类型',{choices:[['ia','低频'],['arc','供应商冷层一']]}],['arcDays','满多少天转冷层二',{step:1}],['rawDays','原始最终保留 / 天',{step:1}],['prodDays','可交付数据最终保留 / 天',{step:1}],['productTier','可交付数据存储类型',{choices:tiers}],['initialRawPB','已有留存原始数据 / PB'],['initialRawAge','已有原始数据年龄 / 天',{step:1}],['initialProdPB','已有可交付数据 / PB'],['initialProdAge','已有可交付数据年龄 / 天',{step:1}]]);
    b=section('容量价格与计量',false,'选择厂商只替换容量价和最低保存期。手改后标记为自定义；留空表示缺报价。');
    field(b,P,'vendor','容量价资料',{choices:[...Object.entries(M.VENDORS).map(([k,v])=>[k,v.name]),['custom','自定义 / 待验证']]});
    fields(b,[['unit','容量 / 取回计量',{choices:[['GiB','GiB · 2³⁰ 字节'],['GB','GB · 10⁹ 字节']]}],['networkUnit','网络预算计量',{choices:[['GB','GB · 10⁹ 字节'],['GiB','GiB · 2³⁰ 字节']]}],['discount','容量实付比例 %',{max:200}]]);
    tiers.forEach(([k,name])=>fields(b,[[`price.${k}`,name+' 元 / 单位·月'],[`minDays.${k}`,name+' 最低保存 / 天',{step:1}],[`retrieve.${k}`,name+' 取回 元 / 单位']]));
    const note=node('p',P.quoteNote,'muted');note.id='quoteNote';b.append(note);
    b=section('任务与部署位置',false,'GPU 为有效卡时；CPU 只填实例以外的额外核时。任务输出体量只用于跨位置汇集。每项系数均待实测。');
    P.wl.forEach((w,i)=>{const box=node('div',undefined,'task');box.append(node('h3',w.name));fields(box,[[`wl.${i}.gpu`,'GPU 卡时 / 数据小时'],[`wl.${i}.cpu`,'额外 CPU 核时 / 小时'],[`wl.${i}.cov`,'覆盖率 %',{max:100}],[`wl.${i}.out`,'任务产物 GB / 小时'],[`wl.${i}.place`,'执行位置',{choices:place}]]);b.append(box);});
    fields(b,[['hotPlace','原始热数据',{choices:place}],['coldPlace','原始冷数据',{choices:place}],['packPlace','可交付数据打包位置',{choices:place}],['productPlace','可交付数据存放位置',{choices:place}]]);
    b=section('计算预算',false,'不是已取得的硬件报价；实例规格与吞吐必须配套校准。');
    fields(b,[['gpuScale','GPU 工作量倍率'],['gpuPrice','GPU 完整实例 元 / 卡时'],['cpuPrice','独立 CPU 元 / 核时'],['cloudUtil','云 GPU 有效利用率 %',{min:1,max:100}],['idcUtil','IDC GPU 有效利用率 %',{min:1,max:100}],['spotShare','抢占实例比例 %',{max:100}],['spotDisc','抢占折扣幅度 %',{max:100}],['retry','计算重试开销 %',{max:100}],['gpuLimit','可供云 GPU 数量',{note:'0 = 尚未确认供给'}]]);
    b=section('已有 IDC 与追加采购',false,'容量为本工作负载专属预留。净值为剩余待摊金额，默认 0 = 尚未录入；采购单价与运营单价均为占位。');
    fields(b,[['existingPB','已有可用逻辑容量 / PB'],['existingGPU','已有 GPU 卡数',{step:1}],['existingStorBook','已有存储净值 / 万元'],['existingGpuBook','已有 GPU 净值 / 万元'],['existingRemaining','已有资产剩余摊销 / 月',{min:1,step:1}],['idcStorCapex','存储造价 / 万元·PB',{note:'每可用逻辑 PB；已包含冗余'}],['idcStorOpex','存储运营 / 万元·PB·月'],['idcStorYears','新存储折旧 / 年',{min:1}],['idcHeadroom','额外采购余量 %',{max:100}],['blockPB','存储采购块 / PB',{min:.001}],['idcGpuCapex','GPU 含主机造价 / 万元·卡'],['idcGpuOpex','GPU 运营 / 元·卡·月'],['idcGpuYears','新 GPU 折旧 / 年',{min:1}],['idcCpuCost','IDC 额外 CPU 运营 / 元·核时']]);
    b=section('交付、读取与链路',false,'路径单价应含该路径全部按流量费用，不与固定专线重复报价。三种交付方式按份数归一。');
    fields(b,[['deliverRatio','交付量 / 当月可交付数据 %',{note:'可 > 100%，表示重复销售'}],['dlvInternal','同云内网交付 / 份',{max:100}],['dlvPublic','公网交付 / 份',{max:100}],['dlvDisk','寄盘交付 / 份',{max:100}],['egressPrice','云公网外发 / 元·单位'],['idcEgress','IDC 公网外发 / 元·单位'],['cloudToIDC','云 → IDC / 元·单位'],['idcToCloud','IDC → 云 / 元·单位'],['diskPrice','寄盘耗材物流 / 元·TB'],['uplinkPrice','接入链路 / 元·Gbps·月'],['deliveryDays','月交付集中窗口 / 天',{min:.01,max:30}],['restoreHours','归档恢复预留 / 小时'],['cacheDays','恢复临时副本 / 天'],['coldReadPct','原始冷库存月额外读取 %',{max:100}],['linkGbps','可用聚合链路 / Gbps',{note:'0 = 尚未验证'}],['linkEfficiency','链路有效效率 %',{min:1,max:100}],['accessBudget','请求等额外预算 / 元·月'],['controlBudget','控制服务预算 / 元·月']]);
  }
  const cats=[['storage','云容量'],['access','读取 / 最低保存期 / 请求'],['cloudGPU','云 GPU'],['cloudCPU','云 CPU'],['idcStorage','IDC 存储'],['idcCompute','IDC 计算'],['network','接入与两地搬运'],['delivery','客户交付'],['control','控制服务']];
  const total=(r,view)=>view==='cash'?r.totalCash:r.totalAmort;
  const aggregate=(rs,view)=>M.sum(rs.map(r=>total(r,view)));
  function render(){
    try{
      results=M.simulate(P);U.error('');const r=results[P.month-1],cost=total(r,P.view),all=aggregate(results,P.view),parts=P.view==='cash'?r.cash:r.amort;
      const per=r.deliveredH>0?cost/r.deliveredH:null;
      let br=null,bt=null;
      if(base){const bp=M.restore(base);bp.month=P.month;bp.months=P.months;bp.view=P.view;const bs=M.simulate(bp);br=bs[P.month-1];bt=aggregate(bs,P.view);}
      const values=[['第 '+P.month+' 月'+(P.view==='cash'?'现金支出':'费用含折旧'),cost,br?total(br,P.view):null],[P.months+' 个月累计',all,bt],['截至本月追加采购',M.sum(results.slice(0,P.month).map(x=>x.capex)),null],['基础设施费 / 交付小时',per,br&&br.deliveredH>0?total(br,P.view)/br.deliveredH:null]];
      clear($('kpis'));const kq=['view',null,'capex','perHour'];values.forEach(([label,value,b],i)=>{const box=node('div',undefined,'metric'),lab=node('div',label,'label');const qb=kq[i]&&C.q(kq[i]);if(qb)lab.append(qb);box.append(lab,node('div',value===null?'无交付':money(value),'value'));if(b!==null&&value!==null)box.append(node('div','较基线 '+(value-b>=0?'+':'')+money(value-b),'delta'));$('kpis').append(box);});
      $('flow').textContent='原始流入 '+qty(r.rawGB/30)+'/天 · 可交付数据 '+qty(r.prodGB)+'/月 · 交付 '+qty(r.deliveredGB)+'/月 · 云容量价：'+(M.VENDORS[P.vendor]?.name||'自定义');
      $('baselineNote').textContent=base?'基线保存完整参数和价格快照；按当前第 '+P.month+' 月、当前成本口径重算比较。':'尚未固定基线。部署策略按钮只改变对应策略，不重置业务量或单价。';
      $('monthLabel').textContent=P.month;$('month').max=P.months;$('month').value=P.month;$('view').value=P.view;
      U.chart($('costChart'),$('costLegend'),cats.map(([k,name])=>({name,values:results.map(x=>(P.view==='cash'?x.cash:x.amort)[k]/1e4)})),results.map(x=>x.month),'万元');
      const largest=Math.max(...results.map(x=>M.sum(Object.values(x.stock)))),divisor=largest>=1e6?1e6:largest>=1000?1000:1,unit=divisor===1e6?'PB':divisor===1000?'TB':'GB';
      U.chart($('stockChart'),$('stockLegend'),[['buf','非留存热缓冲'],['std','留存热数据'],['arc','冷层一'],['deep','冷层二'],['prod','可交付数据']].map(([k,name])=>({name,values:results.map(x=>x.stock[k]/divisor)})),results.map(x=>x.month),unit);
      const sens=[['每日采集量',(p,f)=>p.mod.forEach(m=>m.h*=f)],['GPU 工作量',(p,f)=>p.gpuScale*=f],['原始留存率',(p,f)=>p.retain=Math.min(100,p.retain*f)],['容量价格',(p,f)=>p.discount=Math.min(200,p.discount*f)],['客户交付量',(p,f)=>p.deliverRatio*=f]];
      const sr=sens.map(([name,fn])=>{try{const a=M.clone(P),b=M.clone(P);fn(a,.7);fn(b,1.3);return [name,aggregate(M.simulate(a),P.view)-all,aggregate(M.simulate(b),P.view)-all];}catch(e){return [name,null,null];}}).sort((a,b)=>Math.abs((b[2]||0)-(b[1]||0))-Math.abs((a[2]||0)-(a[1]||0)));
      clear($('sensitivity'));const st=node('table');U.table(st,['参数','降低 30%','提高 30%'],sr.map(([n,a,b])=>[n,a===null?'无效情景':money(a),b===null?'无效情景':money(b)]));$('sensitivity').append(st);
      $('detailTitle').textContent='第 '+P.month+' 个月明细 · '+(P.view==='cash'?'现金':'费用含折旧');
      U.table($('costTable'),['项目','金额','占比'],[...cats.map(([k,n])=>[n,money(parts[k]),cost>0?num(parts[k]/cost*100,1)+'%':'—']),['合计',money(cost),'']]);
      $('resourceSummary').textContent='云 GPU 理论并发 '+num(r.cloudCards,0)+' 卡 · IDC 已配 '+num(r.cards,0)+' 卡 / '+num(r.cap,2)+' PB · 聚合链路需求约 '+num(r.requiredGbps,1)+' Gbps';
      $('warnings').textContent=r.warnings.length?r.warnings.join('；')+'。':'已填资源未触发数量告警；这不等于吞吐、可用性或交付 SLA 已通过实测。';
      clear($('ledger'));[
        '当月跨地点搬运 '+qty(r.transferGB)+'，其中按真实转层发生 '+qty(r.migrationGB)+'。可交付数据位置影响输出搬运和客户路径。',
        '本月最短保存期补费 '+money(r.early)+'；原始冷库存读取及恢复副本 '+money(r.recovery)+'。可交付数据取回另外计入读取项。',
        '本月采购 '+money(r.capex)+'；本月折旧 '+money(r.depreciation)+'。折旧与现金分开，折旧到期后不再摊销同一笔采购。'
      ].forEach(t=>$('ledger').append(node('p',t)));
      U.table($('monthlyTable'),['月','现金支出','费用含折旧','月末库存','追加投资','实际转层搬运'],results.map(x=>[String(x.month),money(x.totalCash),money(x.totalAmort),qty(M.sum(Object.values(x.stock))),money(x.capex),qty(x.migrationGB)]));
      window.reportResult={params:M.clone(P),results:M.clone(results)};
    }catch(e){results=null;U.error('当前参数无法计算：'+e.message+'。结果已隐藏，修正输入后自动恢复。');}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,120);}
  $('params').addEventListener('change',e=>{
    const el=e.target,path=el.dataset.path;if(!path)return;
    if(path==='vendor'&&el.value!=='custom'){M.useVendor(P,el.value);build();render();return;}
    let value=el.tagName==='SELECT'?el.value:el.value===''?null:Number(el.value);
    U.set(P,path,value);
    if(path.startsWith('price.')||path.startsWith('minDays.')){P.vendor='custom';P.quoteNote='手动输入 / 待验证；以导出情景保存的数值为准';$('f-vendor').value='custom';$('quoteNote').textContent=P.quoteNote;}
    schedule();
  });
  $('month').addEventListener('input',e=>{P.month=Number(e.target.value);schedule();});
  $('view').addEventListener('change',e=>{P.view=e.target.value;render();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.preset==='cloud'){P.hotPlace=P.coldPlace=P.packPlace=P.productPlace='cloud';P.wl.forEach(w=>w.place='cloud');}
    if(b.dataset.preset==='hybrid'){P.hotPlace=P.coldPlace=P.packPlace='idc';P.productPlace='cloud';P.wl.forEach(w=>w.place='idc');}
    if(b.dataset.preset==='window'){
      let note='';if(!P.existingPB){P.existingPB=100;note='；已有容量未录入，按 100 PB 示例';}
      P.hotPlace=P.packPlace='idc';P.coldPlace=P.productPlace='cloud';P.wl.forEach(w=>w.place='idc');P.coldTier='arc';
      P.stdDays=M.idcWindowDays(P);P.arcDays=Math.max(P.arcDays,P.stdDays);
      build();render();U.flash('机房滚动窗口 '+P.stdDays+' 天（按已有 '+num(P.existingPB,0)+' PB、余量 '+P.idcHeadroom+'% 推算'+note+'）；更早的原始数据转云上冷层一，可交付数据上传云端。');return;
    }
    if(b.dataset.preset==='lean'){P.retain=10;P.hotDays=Math.max(14,P.lagDays);P.stdDays=Math.max(60,P.hotDays);P.arcDays=Math.max(P.arcDays,P.stdDays);}
    build();render();U.flash('只应用所选策略，业务规模、价格和已有资产保持不变。');
  }));
  $('reset').onclick=()=>{P=M.clone(M.DEFAULT);build();render();U.flash('已恢复全部默认示例；已保存的基线不变。');};
  $('setBase').onclick=()=>{try{M.validate(P);if(!results)throw new Error('请先修正当前情景');base=M.snapshot(P);try{localStorage.setItem(baseKey,JSON.stringify(base));}catch(e){}render();U.flash('已保存完整基线，切换月份与口径时将同步重算。');}catch(e){U.flash(e.message);}};
  $('clearBase').onclick=()=>{base=null;try{localStorage.removeItem(baseKey);}catch(e){}render();U.flash('基线已清除。');};
  $('export').onclick=()=>{try{M.validate(P);U.download(M.snapshot(P),'robot-data-detail-'+M.AS_OF+'.json');}catch(e){U.flash(e.message);}};
  $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>150000)throw new Error('文件过大');const next=M.restore(JSON.parse(await f.text()));M.simulate(next);P=next;build();render();U.flash('已导入完整情景，未改写其他本地基线。');}catch(err){U.flash('导入失败：'+err.message);}e.target.value='';};
  $('share').onclick=async()=>{try{M.validate(P);const hash='s='+encodeURIComponent(U.encode(M.snapshot(P))),url=location.href.split('#')[0]+'#'+hash;history.replaceState(null,'','#'+hash);try{await navigator.clipboard.writeText(url);U.flash('链接已复制；其中包含业务量与价格，请勿公开分发。');}catch(e){window.prompt('复制参数链接（包含敏感业务信息）',url);}}catch(e){U.flash(e.message);}};
  $('print').onclick=()=>window.print();
  C.mount();U.vendors($('vendorTable'));$('version').textContent=' 版本 '+M.VERSION;build();render();
})();
