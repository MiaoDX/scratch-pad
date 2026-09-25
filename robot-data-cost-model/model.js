/* Shared, dependency-free planning model. All business volumes are decimal GB.
 * Price meters are explicit. 30-day months; piecewise-constant daily arrivals.
 * Browser: RDCM. Node: require('./model.js'). See README for scope. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RDCM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2.2.0', AS_OF = '2026-09-24', MONTH = 30;
  const clone = x => JSON.parse(JSON.stringify(x));
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const numeric = (v, name, min = 0, max = 1e18) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
      throw new Error(name + ' 必须是 ' + min + ' 至 ' + max + ' 的有限数值');
    return v;
  };
  const integer = (v, name, min = 0, max = 36500) => {
    numeric(v, name, min, max);
    if (!Number.isInteger(v)) throw new Error(name + ' 必须是整数');
    return v;
  };
  function meter(gb, unit) {
    if (!['GB', 'GiB'].includes(unit)) throw new Error('未知计量单位');
    return gb * (unit === 'GiB' ? 1e9 / 1073741824 : 1);
  }
  const VENDORS = {
    aliyun: {name:'阿里云 OSS', source:'https://help.aliyun.com/zh/oss/storage-fees',
      prices:[0.12,0.08,0.033,0.0075], names:['标准','低频','归档','深度冷归档'],
      min:[0,30,60,180], status:['官方算例','预算参考','预算参考','历史价格参考'],
      note:'非企业报价；深度冷归档不等于冷归档。容量计量与地域以合同核对。', unit:'GiB'},
    tencent: {name:'腾讯云 COS', source:'https://buy.cloud.tencent.com/price/cos',
      prices:[0.118,0.08,0.033,0.01], names:['标准','低频','归档','深度归档'],
      min:[0,30,90,180], status:['官方价表','官方价表','官方价表','官方价表'],
      note:'价表地域需复核；容量按二进制。算力、链路仍需独立报价。', unit:'GiB'},
    huawei: {name:'华为云 OBS', source:'https://www.huaweicloud.com/product/obs.html',
      prices:[0.099,0.08,0.033,0.014], names:['标准','低频','归档','深度归档'],
      min:[0,30,90,180], status:['官网起价','官网起价','官网展示价','受限公测展示价'],
      note:'深度归档受限公测；原表写 GB，模型按 GiB 演示，需确认计量定义。', unit:'GiB'},
    baidu: {name:'百度智能云 BOS', source:'https://cloud.baidu.com/product-price/bos.html',
      prices:[0.119,0.08,0.032,0.015], names:['标准','低频','冷存储','归档'],
      min:[0,30,60,180], status:['官方价表','官方价表','官方价表','官方价表'],
      note:'中国大陆普通类型；冷存储与归档分别映射两级冷层。原表 GB 的字节定义需确认。', unit:'GiB'},
    volc: {name:'火山引擎 TOS', source:'https://www.volcengine.com/docs/6349/78455',
      prices:[0.099,null,null,null], names:['标准','低频','归档','深度冷层'],
      min:[0,null,null,null], status:['官方算例','待报价','待报价','待报价'],
      note:'标准值为北京地域计费算例；未知价格与规则不按零计算，不参与缺项总价排名。', unit:'GiB'}
  };
  const DEFAULT = {
    vendor:'aliyun', quoteNote:'公开参考与预算假设，未取得企业报价', unit:'GiB', networkUnit:'GB',
    price:{std:0.12,ia:0.08,arc:0.033,deep:0.0075}, minDays:{std:0,ia:30,arc:60,deep:180},
    retrieve:{std:0,ia:0.03,arc:0.06,deep:0.12}, discount:100,
    mod:[{name:'Ego 头戴',h:21000,raw:13.5,del:4.5},{name:'UMI 手持',h:12500,raw:27,del:6.8},{name:'真机遥操',h:8400,raw:45,del:11}],
    wl:[{name:'解析与时间同步',gpu:0,cpu:2,cov:100,out:0.1,place:'cloud'},
      {name:'视频转码',gpu:0,cpu:3,cov:100,out:0.1,place:'cloud'},
      {name:'手部重建',gpu:0.5,cpu:0.5,cov:80,out:0.2,place:'cloud'},
      {name:'分割',gpu:0.3,cpu:0.2,cov:50,out:0.1,place:'cloud'},
      {name:'VLM 标注',gpu:0.2,cpu:0.2,cov:100,out:0.05,place:'cloud'}],
    months:36, growth:0, hotDays:30, retain:30, stdDays:90, arcDays:365,
    rawDays:0, prodDays:0, productTier:'ia', coldTier:'arc', lagDays:1,
    initialRawPB:0, initialRawAge:0, initialProdPB:0, initialProdAge:0,
    hotPlace:'cloud', coldPlace:'cloud', productPlace:'cloud', packPlace:'cloud',
    gpuScale:1, gpuPrice:8, cpuPrice:0.19, cloudUtil:70, idcUtil:70,
    spotShare:50, spotDisc:60, retry:0,
    existingPB:0, existingGPU:0, existingStorBook:0, existingGpuBook:0, existingRemaining:36,
    idcStorCapex:55, idcStorOpex:1.5, idcStorYears:5, idcHeadroom:20, blockPB:1,
    idcGpuCapex:6, idcGpuOpex:600, idcGpuYears:4, idcCpuCost:0.06,
    uplinkPrice:3000, cloudToIDC:0.1, idcToCloud:0.02, egressPrice:0.3, idcEgress:0.05,
    deliverRatio:50, dlvInternal:50, dlvPublic:40, dlvDisk:10, diskPrice:300,
    deliveryDays:30, restoreHours:12, cacheDays:2, coldReadPct:0,
    accessBudget:10000, controlBudget:100000, linkGbps:0, linkEfficiency:80,
    gpuLimit:0, salePrice:0, month:12, view:'amort'
  };
  function useVendor(p, key) {
    if (!VENDORS[key]) throw new Error('未知供应商');
    const v = VENDORS[key]; p.vendor=key; p.unit=v.unit;
    ['std','ia','arc','deep'].forEach((k,i)=>{p.price[k]=v.prices[i];p.minDays[k]=v.min[i];});
    p.quoteNote = v.note; return p;
  }
  function validate(p) {
    if (!p || !Array.isArray(p.mod) || !p.mod.length || p.mod.length>20 || !Array.isArray(p.wl) || p.wl.length>30)
      throw new Error('情景结构无效');
    const nonnegative=['gpuScale','gpuPrice','cpuPrice','idcStorCapex','idcStorOpex','idcGpuCapex','idcGpuOpex','idcCpuCost','uplinkPrice','cloudToIDC','idcToCloud','egressPrice','idcEgress','deliverRatio','diskPrice','cacheDays','restoreHours','accessBudget','controlBudget','linkGbps','gpuLimit','existingPB','existingGPU','existingStorBook','existingGpuBook','initialRawPB','initialProdPB','salePrice'];
    nonnegative.forEach(k=>numeric(p[k],k));
    ['retain','spotShare','spotDisc','coldReadPct','dlvInternal','dlvPublic','dlvDisk'].forEach(k=>numeric(p[k],k,0,100));
    ['cloudUtil','idcUtil','linkEfficiency'].forEach(k=>numeric(p[k],k,1,100));
    numeric(p.discount,'存储实付比例',0,200); numeric(p.retry,'重试开销',0,100);
    numeric(p.idcHeadroom,'额外采购余量',0,100); numeric(p.growth,'月增长',-99,100);
    integer(p.months,'月数',1,120); integer(p.month,'查看月份',1,p.months);
    ['hotDays','stdDays','arcDays','rawDays','prodDays','lagDays','initialRawAge','initialProdAge'].forEach(k=>integer(p[k],k));
    integer(p.existingRemaining,'已有资产剩余摊销月数',1,120);
    numeric(p.idcStorYears,'存储折旧年限',1,20); numeric(p.idcGpuYears,'GPU折旧年限',1,20);
    numeric(p.blockPB,'采购容量步长',0.001,1000); numeric(p.deliveryDays,'交付窗口',0.01,30);
    integer(p.existingGPU,'已有 GPU 卡数',0,10000000);integer(p.gpuLimit,'可供 GPU 卡数',0,10000000);
    if (p.hotDays<p.lagDays || p.stdDays<p.hotDays || p.arcDays<p.stdDays) throw new Error('需满足：处理延迟 ≤ 热缓冲 ≤ 标准层年龄阈值 ≤ 深冷层年龄阈值');
    if(p.rawDays && p.rawDays<p.hotDays) throw new Error('原始数据最终保留期不能短于热缓冲');
    if(p.initialRawPB && p.rawDays && p.initialRawAge>=p.rawDays) throw new Error('初始原始库存已超过设定保留期');
    if(p.initialProdPB && p.prodDays && p.initialProdAge>=p.prodDays) throw new Error('初始成品库存已超过设定保留期');
    if(p.deliverRatio>0 && p.dlvInternal+p.dlvPublic+p.dlvDisk===0) throw new Error('有交付需求时，交付方式权重不能全部为零');
    ['hotPlace','coldPlace','productPlace','packPlace'].forEach(k=>{if(!['cloud','idc'].includes(p[k]))throw new Error('部署位置无效');});
    if(!['std','ia','arc','deep'].includes(p.productTier)||!['ia','arc'].includes(p.coldTier))throw new Error('存储类型无效');
    meter(0,p.unit);meter(0,p.networkUnit);
    p.mod.forEach(m=>{if(typeof m.name!=='string'||m.name.length>80)throw new Error('模态名称无效');['h','raw','del'].forEach(k=>numeric(m[k],k));});
    p.wl.forEach(w=>{if(typeof w.name!=='string'||w.name.length>80)throw new Error('任务名称无效');['gpu','cpu','out'].forEach(k=>numeric(w[k],k));numeric(w.cov,'覆盖率',0,100);if(!['cloud','idc'].includes(w.place))throw new Error('任务位置无效');});
    ['std','ia','arc','deep'].forEach(k=>{
      if(p.price[k]!==null)numeric(p.price[k],k+' 容量价');
      if(p.minDays[k]!==null)numeric(p.minDays[k],k+' 最低保存期');
      if(p.retrieve[k]!==null)numeric(p.retrieve[k],k+' 取回价');
    });
    if(!['cash','amort'].includes(p.view))throw new Error('成本口径无效');
    return p;
  }
  function price(p,k) {
    if(p.price[k]===null || p.price[k]===undefined)throw new Error(k+' 容量价格缺失；请填写报价，不能按零计费');
    return p.price[k]*p.discount/100;
  }
  function capacityCost(p,gb,k,days=30) {return gb>0 ? meter(gb,p.unit)*price(p,k)*days/30 : 0;}
  function accessCost(p,gb,k) {
    if(gb<=0)return 0;
    if(p.retrieve[k]===null||p.retrieve[k]===undefined)throw new Error(k+' 取回价格缺失');
    return meter(gb,p.unit)*p.retrieve[k] + (['arc','deep'].includes(k)?capacityCost(p,gb,'std',p.cacheDays):0);
  }
  function penalty(p,gb,k,dwell) {
    if(gb<=0)return 0;
    if(p.minDays[k]===null||p.minDays[k]===undefined)throw new Error(k+' 最低保存期缺失');
    return capacityCost(p,gb,k,Math.max(0,p.minDays[k]-dwell));
  }
  // Each transfer has an actual source and destination; no percentage mismatch heuristic.
  function transfer(p,gb,from,to) {
    if(gb<=0||from===to)return 0;
    return meter(gb,p.networkUnit)*(from==='cloud'?p.cloudToIDC:p.idcToCloud);
  }
  function compute(p,h,rawGB,prodGB) {
    let cg=0,ig=0,cc=0,ic=0,move=0,movedGB=0,remoteCoverage=0;
    const active=p.wl.filter(w=>w.cov>0&&(w.cpu>0||w.gpu>0));
    active.forEach(w=>{
      const f=w.cov/100, gh=h*f*w.gpu*p.gpuScale, ch=h*f*w.cpu;
      if(w.place==='cloud'){cg+=gh;cc+=ch;}else{ig+=gh;ic+=ch;}
      if(w.place!==p.hotPlace)remoteCoverage=Math.max(remoteCoverage,f);
      const out=h*f*w.out;
      if(w.place!==p.packPlace){move+=transfer(p,out,w.place,p.packPlace);movedGB+=out;}
    });
    // Coverage is a nested sample subset; remote raw input is staged once per batch.
    if(remoteCoverage){const gb=rawGB*remoteCoverage;move+=transfer(p,gb,p.hotPlace,p.hotPlace==='cloud'?'idc':'cloud');movedGB+=gb;}
    if(prodGB>0){
      if(!active.length && p.hotPlace!==p.packPlace){move+=transfer(p,rawGB,p.hotPlace,p.packPlace);movedGB+=rawGB;}
      if(p.packPlace!==p.productPlace){move+=transfer(p,prodGB,p.packPlace,p.productPlace);movedGB+=prodGB;}
    }
    const retry=1+p.retry/100;
    return {cloudGPU:cg/(p.cloudUtil/100)*retry*p.gpuPrice*(1-p.spotShare*p.spotDisc/10000),
      cloudCPU:cc*retry*p.cpuPrice, idcCPU:ic*retry*p.idcCpuCost,
      idcGpuHours:ig*retry,cloudGpuHours:cg/(p.cloudUtil/100)*retry,gpuHours:(cg+ig)*retry,
      cpuHours:(cc+ic)*retry,transfer:move,movedGB};
  }
  function delivery(p,gb) {
    if(gb<=0)return {cost:0,access:0,externalGB:0};
    const all=p.dlvInternal+p.dlvPublic+p.dlvDisk;
    if(!all)throw new Error('交付权重为零');
    const pub=p.dlvPublic/all, disk=p.dlvDisk/all, internal=p.dlvInternal/all;
    let network=gb*pub*(p.productPlace==='cloud'?p.egressPrice:p.idcEgress);
    network=meter(network,p.networkUnit);
    if(p.productPlace==='idc')network+=transfer(p,gb*internal,'idc','cloud');
    // Physical delivery still needs to read cloud data onto a local disk.
    if(p.productPlace==='cloud')network+=transfer(p,gb*disk,'cloud','idc');
    return {cost:network+gb*disk/1000*p.diskPrice,
      access:p.productPlace==='cloud'?accessCost(p,gb,p.productTier):0,
      externalGB:gb*(pub+(p.productPlace==='idc'?internal:disk))};
  }
  function depreciation(assets,month) {
    return sum(assets.map(a=>month>=a.start&&month<a.start+a.life?a.amount/a.life:0));
  }
  function quantities(p) {
    return {h:sum(p.mod.map(m=>m.h)), raw:sum(p.mod.map(m=>m.h*m.raw)), prod:sum(p.mod.map(m=>m.h*m.del))};
  }
  function simulate(input) {
    const p=validate(clone(input)), n=p.months*30, q=quantities(p), ret=p.retain/100;
    const horizonRaw=p.rawDays||Infinity, horizonProd=p.prodDays||Infinity;
    // Prefix integrals give exact start/end stocks for uniform arrivals within each day.
    const raw=[0], kept=[0], dropped=[0], product=[0], hours=[0];
    for(let d=0;d<n;d++){
      const f=Math.pow(1+p.growth/100,Math.floor(d/30));
      raw.push(raw[d]+q.raw*f);kept.push(kept[d]+q.raw*f*ret);dropped.push(dropped[d]+q.raw*f*(1-ret));hours.push(hours[d]+q.h*f);
      const origin=d-p.lagDays, pf=origin<0?0:Math.pow(1+p.growth/100,Math.floor(origin/30));
      product.push(product[d]+q.prod*pf);
    }
    const val=(a,t)=>a[Math.max(0,Math.min(n,t))];
    const band=(a,t,lo,hi)=>Math.max(0,val(a,t-lo)-(hi===Infinity?0:val(a,t-hi)));
    const stages=[{key:'buf',a:0,b:p.hotDays,arr:dropped,tier:'std',place:p.hotPlace,init:0,age:0},
      {key:'std',a:0,b:Math.min(p.stdDays,horizonRaw),arr:kept,tier:'std',place:p.hotPlace,init:p.initialRawPB*1e6,age:p.initialRawAge},
      {key:'arc',a:p.stdDays,b:Math.min(p.arcDays,horizonRaw),arr:kept,tier:p.coldTier,place:p.coldPlace,init:p.initialRawPB*1e6,age:p.initialRawAge},
      {key:'deep',a:p.arcDays,b:horizonRaw,arr:kept,tier:'deep',place:p.coldPlace,init:p.initialRawPB*1e6,age:p.initialRawAge},
      {key:'prod',a:0,b:horizonProd,arr:product,tier:p.productTier,place:p.productPlace,init:p.initialProdPB*1e6,age:p.initialProdAge}].filter(s=>s.b>s.a);
    let cap=p.existingPB,cards=p.existingGPU;
    const sa=p.existingStorBook?[{start:0,life:p.existingRemaining,amount:p.existingStorBook*1e4}]:[];
    const ga=p.existingGpuBook?[{start:0,life:p.existingRemaining,amount:p.existingGpuBook*1e4}]:[];
    const out=[];
    for(let m=0;m<p.months;m++){
      let cloudStor=0,early=0,recovery=0,idcPeak=0,migration=0,migrationGB=0;
      let stock={buf:0,std:0,arc:0,deep:0,prod:0}, avg={...stock};
      for(let d=m*30;d<(m+1)*30;d++){
        let idcStart=0,idcEnd=0;
        for(const s of stages){
          const initial=(time)=>s.init&&s.age+time>=s.a&&s.age+time<s.b?s.init:0;
          const before=band(s.arr,d,s.a,s.b),after=band(s.arr,d+1,s.a,s.b);
          const midInitial=initial(d+0.5),mean=(before+after)/2+midInitial;
          stock[s.key]=after+initial(d+1);avg[s.key]+=mean/30;
          if(s.place==='cloud'){
            cloudStor+=capacityCost(p,mean,s.tier,1);
            if(s.key==='arc'||s.key==='deep')recovery+=accessCost(p,mean*p.coldReadPct/100/30,s.tier);
            if(s.b!==Infinity){
              const exit=band(s.arr,d+1,s.b,s.b+1)+(s.init&&s.age+d+1===s.b?s.init:0);
              // Initial bulk leaves at the next boundary; charge once there.
              early+=penalty(p,exit,s.tier,s.b-s.a);
            }
          }else{idcStart+=before+midInitial;idcEnd+=after+midInitial;}
        }
        idcPeak=Math.max(idcPeak,idcStart,idcEnd);
        if(p.stdDays<horizonRaw){
          const moved=band(kept,d+1,p.stdDays,p.stdDays+1)+(p.initialRawPB&&p.initialRawAge+d+1===p.stdDays?p.initialRawPB*1e6:0);
          if(p.hotPlace!==p.coldPlace){migration+=transfer(p,moved,p.hotPlace,p.coldPlace);migrationGB+=moved;}
        }
      }
      const start=m*30,end=(m+1)*30,h=hours[end]-hours[start],rawGB=raw[end]-raw[start],prodGB=product[end]-product[start];
      const processing=compute(p,h,rawGB,prodGB);
      const needPB=idcPeak/1e6*(1+p.idcHeadroom/100),addedPB=Math.ceil(Math.max(0,needPB-cap-1e-9)/p.blockPB)*p.blockPB;
      cap+=addedPB;
      const needGPU=Math.ceil(processing.idcGpuHours/(720*p.idcUtil/100)),addedGPU=Math.max(0,needGPU-cards);cards+=addedGPU;
      if(addedPB)sa.push({start:m,life:Math.round(p.idcStorYears*12),amount:addedPB*p.idcStorCapex*1e4});
      if(addedGPU)ga.push({start:m,life:Math.round(p.idcGpuYears*12),amount:addedGPU*p.idcGpuCapex*1e4});
      const deliveredGB=prodGB*p.deliverRatio/100, deliveredH=q.prod>0?deliveredGB*q.h/q.prod:0;
      const dlv=delivery(p,deliveredGB),ingressGBps=(rawGB/30)*8/86400;
      const spend={storage:cloudStor,access:early+recovery+dlv.access+p.accessBudget,
        cloudGPU:processing.cloudGPU,cloudCPU:processing.cloudCPU,
        idcStorage:cap*p.idcStorOpex*1e4,idcCompute:cards*p.idcGpuOpex+processing.idcCPU,
        network:migration+processing.transfer+ingressGBps*p.uplinkPrice,delivery:dlv.cost,control:p.controlBudget};
      const storDep=depreciation(sa,m),gpuDep=depreciation(ga,m);
      const capex=addedPB*p.idcStorCapex*1e4+addedGPU*p.idcGpuCapex*1e4;
      const amort={...spend,idcStorage:spend.idcStorage+storDep,idcCompute:spend.idcCompute+gpuDep};
      const cash={...spend,idcStorage:spend.idcStorage+addedPB*p.idcStorCapex*1e4,idcCompute:spend.idcCompute+addedGPU*p.idcGpuCapex*1e4};
      const transferGB=migrationGB+processing.movedGB;
      const restoring=p.productPlace==='cloud'&&['arc','deep'].includes(p.productTier)&&deliveredGB>0;
      const transferDays=p.deliveryDays-(restoring?p.restoreHours/24:0);
      const requiredGbps=transferDays<=0?null:(ingressGBps+transferGB*8/(30*86400)+dlv.externalGB*8/(transferDays*86400))/(p.linkEfficiency/100);
      const warnings=[];
      if(!p.linkGbps)warnings.push('未提供聚合链路容量，尚未验证带宽可行性');
      else if(requiredGbps!==null&&requiredGbps>p.linkGbps)warnings.push('聚合链路需求超过已填容量');
      const cloudCards=Math.ceil(processing.cloudGpuHours/720);
      if(!p.gpuLimit)warnings.push('云 GPU 可供数量未验证');else if(cloudCards>p.gpuLimit)warnings.push('所需云 GPU 并发超过已填供给');
      if(p.productPlace==='cloud'&&['arc','deep'].includes(p.productTier)&&deliveredGB>0&&p.restoreHours>=p.deliveryDays*24)warnings.push('归档恢复时间不短于交付窗口，交付不可行');
      if(addedPB||addedGPU)warnings.push('需要追加 IDC 采购；到货与上线周期未建模');
      out.push({month:m+1,rawGB,prodGB,h,stock,avg,early,recovery,transferGB,migrationGB,
        gpuHours:processing.gpuHours,cpuHours:processing.cpuHours,cloudCards,cards,cap,addedPB,addedGPU,
        deliveredGB,deliveredH,requiredGbps,capex,depreciation:storDep+gpuDep,
        amort,cash,opex:spend,totalAmort:sum(Object.values(amort)),totalCash:sum(Object.values(cash)),warnings});
    }
    return out;
  }
  // Rolling IDC window: how many days of raw data fit into existing IDC capacity.
  // Non-retained raw occupies the hot buffer; retained raw stays until the window ends.
  // Constant daily volume (growth ignored); never shorter than the hot buffer.
  function idcWindowDays(p) {
    const q=quantities(p), ret=p.retain/100;
    if(!q.raw || ret<=0) return p.hotDays;
    const usable=p.existingPB*1e6/(1+p.idcHeadroom/100);
    const w=Math.floor((usable/q.raw-(1-ret)*p.hotDays)/ret);
    return Math.max(p.hotDays, Math.min(3650, w));
  }
  // Executive view: three layouts for the same business requirement, each run through
  // the detailed simulation for 36 months. Business inputs are in collection hours.
  const EXEC_SCHEMES=['standard','tiered','window'];
  function executiveParams(input,fixed={},id='standard') {
    const x={hours:41900,rawDays:0,prodDays:0,deliveryHours:600000,load:1,...input};
    numeric(x.hours,'每日采集小时',0,1e8);numeric(x.deliveryHours,'每月交付小时',0,1e11);numeric(x.load,'计算负荷',0,10);
    integer(x.rawDays,'原始数据保留天数');integer(x.prodDays,'可交付数据保留天数');
    if(x.hours===0&&x.deliveryHours>0)throw new Error('零产出不能支撑持续交付；历史库存交付请使用详细版');
    if(!EXEC_SCHEMES.includes(id))throw new Error('未知方案');
    const p=Object.assign(clone(DEFAULT),clone(fixed));p.months=36;p.month=12;p.view='amort';
    const baseH=sum(DEFAULT.mod.map(m=>m.h)),f=x.hours/baseH;
    p.mod=p.mod.map(m=>({...m,h:m.h*f}));
    p.deliverRatio=x.hours>0?x.deliveryHours/(x.hours*MONTH)*100:0;
    p.retain=100;p.rawDays=x.rawDays;p.prodDays=x.prodDays;
    p.gpuScale*=x.load;p.wl.forEach(w=>{w.cpu*=x.load;});
    const cloud=()=>{p.hotPlace=p.coldPlace=p.packPlace=p.productPlace='cloud';p.wl.forEach(w=>w.place='cloud');p.existingPB=0;p.existingGPU=0;};
    if(id==='standard'){cloud();p.productTier='std';p.stdDays=p.arcDays=36500;}
    if(id==='tiered'){cloud();p.productTier='ia';p.coldTier='arc';p.stdDays=Math.max(90,p.hotDays);p.arcDays=Math.max(365,p.stdDays);}
    if(id==='window'){
      p.hotPlace=p.packPlace='idc';p.coldPlace=p.productPlace='cloud';p.wl.forEach(w=>w.place='idc');
      p.productTier='ia';p.coldTier='arc';
      validate(p);p.stdDays=idcWindowDays(p);p.arcDays=Math.max(365,p.stdDays);
    }
    return validate(p);
  }
  function executive(input,fixed={}) {
    return EXEC_SCHEMES.map(id=>{
      const p=executiveParams(input,fixed,id),r=simulate(p),m12=r[11],last=r[r.length-1];
      const by=k=>sum(r.map(x=>x.amort[k]));
      const parts={cloudStorage:by('storage'),access:by('access')+by('control'),cloudCompute:by('cloudGPU')+by('cloudCPU'),
        idcStorage:by('idcStorage'),idcCompute:by('idcCompute'),network:by('network')+by('delivery')};
      return {id,parts,total36:sum(r.map(x=>x.totalAmort)),cash36:sum(r.map(x=>x.totalCash)),
        month12:m12.totalAmort,perHour:m12.deliveredH>0?m12.totalAmort/m12.deliveredH:null,
        capex:sum(r.map(x=>x.capex)),newPB:sum(r.map(x=>x.addedPB)),newGPU:sum(r.map(x=>x.addedGPU)),
        windowDays:id==='window'?p.stdDays:null,existingPB:p.existingPB,existingGPU:p.existingGPU,
        stockGB:sum(Object.values(last.stock)),rawGBday:m12.rawGB/MONTH,deliveredGB:m12.deliveredGB,deliveredH:m12.deliveredH,
        requiredGbps:m12.requiredGbps,monthly:r.map(x=>x.totalAmort)};
    });
  }
  function snapshot(p,kind='detail') {return {schema:VERSION,asOf:AS_OF,kind,createdAt:new Date().toISOString(),params:clone(p)};}
  function restore(s,kind='detail') {
    if(!s||s.schema!==VERSION||s.kind!==kind||!s.params)throw new Error('情景版本或类型不兼容；旧版参数不能静默套用新模型');
    const p=clone(s.params);if(kind==='detail')validate(p);return p;
  }
  return {VERSION,AS_OF,MONTH,DEFAULT,VENDORS,clone,sum,meter,useVendor,validate,capacityCost,accessCost,penalty,transfer,compute,delivery,depreciation,quantities,simulate,idcWindowDays,executiveParams,executive,snapshot,restore};
});
