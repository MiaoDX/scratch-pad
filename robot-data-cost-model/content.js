/* Shared reading aids: design principles, glossary, provenance tags and click-to-open definitions.
   All content is static text; DOM is built with textContent only. */
(function () {
  'use strict';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};

  // [lead, body]
  const PRINCIPLES=[
    ['留多少原始数据、留多久，是成本的第一大杠杆。','这是业务决策，不是技术决策。留得越多，将来重新标注、换算法重跑的余地越大，但存储会随时间持续累积，3 年成本可能相差数倍。'],
    ['原始数据是唯一不可再生的资产，可交付数据是可以重新生成的缓存。','原始数据丢了，重刷能力就永久失去；可交付数据丢了，只需付算力重跑。原始数据必须连同标定、时间同步和管线版本一起保存，否则将来也无法复现。放进深度归档后，按默认估计，每天产生的原始数据每月约 1 万元，反而比放在低频档的可交付数据（约 2.2 万元）便宜。一小时可交付数据若一年内无人购买，删除后按需重跑通常更划算。'],
    ['存进云里免费，拿出来贵：重刷在归档所在的云上就地进行。','上传不收流量费，公网下载约 0.25–0.5 元/GB。把一年的原始数据（约 365 PB）拉回机房，仅出流量就约 0.9–1.8 亿元。选归档云时先看能否临时拿到大量 GPU，再看客户是否集中在这朵云上，最后才比单价。可交付数据是否在多个云上放副本，按交付频率算：1 PB 放低频档约 8 万元/月，若该云上的客户每 3–6 个月就取一次同一批数据，放副本更划算（这项取舍模型未计算）。'],
    ['机房容量用来放最近的原始数据，窗口长短由重刷需求决定。','机房的价值主要是避开云上最贵的标准档：100 PB 约能放 80 天原始数据，每月省约 1,000 万元；但窗口从 60 天拉长到 80 天只多省几十万元，因为较旧的数据放在云上普通归档已接近机房成本。算法和硬件不稳定的第一年，窗口尽量开大，较早数据进云上普通归档；稳定后直接进深度归档。热缓冲期本身也是固定开销：每天 1 PB、缓冲 30 天，就常驻约 30 PB。'],
    ['入库前把小文件聚合成大文件。','把散帧、散传感器片段打包成 MCAP、Lance 或 WebDataset。低频及更冷的档次按 64 KB 起计费，请求费按文件个数收，训练加载也更快。这一条几乎没有反例。']
  ];

  // key -> [title, one-line, full]
  const G={
    perHour:['基础设施费 / 交付小时','当月基础设施费用除以当月交付的数据小时数。','把存储、算力、网络、交付全部摊到卖出的每一小时数据上，可以和售价对照。它不含采集、标注人工等成本，因此不能直接算毛利。交付量越大，单位成本越低，因为存储和缓冲这类成本不随交付量增加。'],
    total36:['36 个月总成本（费用 + 折旧）','三年内每月费用之和，自建设备按折旧计入。','云上费用按月计入；自建设备的采购款按折旧年限逐月摊入，因此第 3 年末尚未用完的设备价值不计入。已有资产只计运营费和已录入的剩余净值。'],
    view:['费用含折旧 / 现金支出','两种看成本的方式，只影响自建设备采购款。','费用含折旧：设备款按折旧年限拆到每个月，适合比较长期哪种方案更划算。现金支出：设备在买的当月一次计入，适合看每个月要准备多少现金。全部上云时两者相同。'],
    capex:['追加设备投入','除已有资源外，还需新买的存储和 GPU 的一次性采购款。','按占位造价计算：存储 55 万元/PB、GPU 6 万元/卡。已有容量和卡数在"会前前提"或"已有 IDC"里录入后，会相应减少。到货和上线周期没有建模。'],
    baseline:['对比基线','把当前情景存为参照，之后调整参数时显示差值。','开会时先把一个情景设为基线，再尝试别人提的方案，指标下方会显示比基线多或少多少。基线只保存在你自己的浏览器里。'],
    sens:['单变量敏感性','每次只改一个参数，看总成本变化多少。','每个参数分别降低和提高 30%，其他不变，计算累计成本比当前方案少（负数）或多（正数）多少。差距越大，这个参数越值得拿到真实数据；差距很小的参数粗估即可。'],
    schemes:['三个方案','同样的数据量、保留期和交付量，只改变存放位置和存储档次。','A 全云标准：一切放在同一家云的标准档，作为比较基准。B 全云分层：原始数据 90 天后转归档、满一年转深度归档，可交付数据放低频。C 机房窗口 + 云归档：在自建机房处理并保留最近一段原始数据，更早的转到云上归档，可交付数据放云上低频。'],
    window:['机房滚动窗口','最近多少天的原始数据留在自建机房。','由已有机房容量推算：可用容量扣除采购余量后，除以每天的原始数据量。窗口内的数据可以在机房直接重刷，零搬运；窗口外的数据转到云上归档，重刷就在云上进行。计算时按不增长的日产量估算。'],
    load:['计算负荷','相对默认处理任务链的倍数。','1 表示按详细版默认任务系数；2 表示同样的数据需要两倍的 GPU 和 CPU 工作量，例如增加了新的标注任务。'],
    rawPolicy:['原始数据保留','原始数据最终保留多久。','"永久保留"表示原始数据一直留存：前期放在标准档或机房，之后转归档，满一年转深度归档。选择 1 年或 90 天时，到期即删除。'],
    prodPolicy:['可交付数据保留','处理好、可以直接出售的数据保留多久。','可交付数据会被多个客户反复购买，默认长期保留在低频档。缩短保留期相当于把它当作缓存，需要时从原始数据重新生成。'],
    deliverable:['可交付数据','处理完、按客户格式整理好、可以直接出售的数据。','通常比原始数据小（重新压缩、裁剪），但会被多个客户反复购买。它可以从原始数据重新生成，所以本质上是一份缓存；人工标注除外，它们体积很小但无法重跑，应永久保存。'],
    hotDays:['原始热缓冲期','新采集的原始数据等待处理、放在随时可读位置的天数。','所有原始数据都要先放在标准档或机房里等待解析、重建和标注。缓冲期越长，常驻数据越多：每天 1 PB、缓冲 30 天就是常驻约 30 PB。能缩短多少取决于处理管线的速度。'],
    retain:['原始长期留存比例','热缓冲结束后，还保留多少比例的原始数据。','100% 表示全部保留，10% 表示只留十分之一，其余删除。留存的数据按年龄依次进入标准档、冷层一、冷层二。'],
    rawDays:['原始最终保留','原始数据最多保留多少天，0 表示不删除。','到期后数据被删除；如果删除时还没满该档位的最低保存天数，按最低天数补费。'],
    tiers:['存储档次：标准 / 低频 / 冷层一 / 冷层二','同一份数据在云上的几种存放方式，越往后越便宜，但读取越慢、越贵。','标准：随时读，不收取回费。低频：随时可读，但按读取量收费，最少存约 30 天。冷层一（归档）：读之前要先解冻，几分钟到几小时，最少存 60–90 天。冷层二（深度归档）：解冻要数小时，最少存约 180 天，价格最低。打个比方：标准是书桌上，低频是书柜里，归档是地下室，深度归档是城外仓库。天数阈值指数据年龄，例如"满 90 天转冷层一"。'],
    minDays:['最低保存期','该档位按至少存多少天计费。','提前删除或转档，差额天数仍然收费。模型在数据离开该档位时一次性计入补费。'],
    retrieve:['取回费','从低频或冷档读取数据时按量收的费用。','冷档还需要先解冻，模型额外计入解冻期间的临时标准档副本。重刷旧数据时，取回费可能是一笔大开销，所以最好只重跑受影响的环节、只取回受影响的数据。'],
    discount:['容量实付比例','实际成交价相对公开牌价的比例。','PB 级采购通常能谈到折扣。拿到正式报价后，把这里改成实际比例即可。'],
    unit:['GiB 与 GB','两种容量单位，1 GiB 约等于 1.074 GB。','云厂商的"GB"多数实际按 GiB 计量，签约前应确认。计量单位不同会让同一单价相差约 7%。'],
    gpuCoef:['GPU 卡时 / CPU 核时系数','每处理 1 小时采集数据，需要多少张卡运行多少小时。','1 卡时 = 一张 GPU 运行一小时；1 核时 = 一个 CPU 核运行一小时。例如系数 0.5 表示每小时数据需要一张卡跑半小时。覆盖率表示这项任务作用于多少比例的数据。这些系数目前都是估计，用几十小时样本实测后替换最有价值。'],
    spot:['抢占式实例','云厂商把闲置机器低价出租，但可能随时收回。','价格最低可到按量价格的一成，适合可以断点重跑的批量处理，不适合需要连续运行的服务。'],
    util:['有效利用率','GPU 实际在干活的时间比例。','自建机器不管用不用都要付钱；利用率 70% 表示需要比满负荷多买约 40% 的卡。云上的利用率反映调度空转和排队，按量付费时可以调高。'],
    idc:['IDC（自建机房）','自己购买服务器、放在自有或托管机房运行。','前期一次性投入大，之后每月只付电力、机柜、运维。数据量大且稳定时通常比云便宜，但要自己承担容量规划、故障和扩容。模型里的机房造价和运营全部是占位值。'],
    existing:['已有资源','可以分给这条管线使用的现有机房容量和 GPU。','容量按去掉冗余后的可用容量填写。只计运营费；若录入剩余净值，按剩余月数摊销。填 0 表示尚未录入，不代表没有资源。'],
    xfer:['跨地点搬运','数据在云和机房之间传输的费用。','例如数据在云上、计算放在机房，就要把原始数据拉到机房。云 → 机房按出流量计，通常较贵；机房 → 云只付自己的带宽。计算尽量和数据放在一起。'],
    uplink:['接入链路','从采集现场把数据传到云或机房的网络带宽。','每天 1 PB 相当于持续约 93 Gbps，价格和可用性需要单独询价，也可以部分用寄硬盘的方式离线传输。'],
    deliverRatio:['交付量','每月卖出的数据量，相对当月产出的比例。','可以超过 100%：同一批数据可能卖给多个客户。'],
    egress:['公网外发','把数据从云上通过互联网下载出去的费用。','上传免费、下载收费是各家云的通行做法，约 0.25–0.5 元/GB。交付尽量让客户在同一云、同一地域内拷贝，或寄硬盘。'],
    budget:['服务预算','请求费、控制服务等难以逐项估算的固定预算。','为占位值，用来提醒这类费用存在，拿到实际账单后替换。'],
    tags:['参数标签','说明每个数字的可信程度。','已查实：来自厂商公开价格或文档。估计：有一定依据的推测，建议实测。占位：暂时填的数字，必须换成真实报价。待确认：需要业务拍板或录入内部信息。']
  };

  const TAGS={ok:['已查实','t-ok'],est:['估计','t-est'],ph:['占位','t-ph'],dec:['待确认','t-dec']};
  // Longest matching rule wins; '*' matches one path segment.
  const TAG_RULES=[
    ['price.*','ok'],['minDays.*','ok'],['cpuPrice','ok'],['egressPrice','ok'],['vendor','ok'],
    ['retain','dec'],['rawDays','dec'],['prodDays','dec'],['productTier','dec'],['deliverRatio','dec'],
    ['hotPlace','dec'],['coldPlace','dec'],['packPlace','dec'],['productPlace','dec'],['wl.*.place','dec'],
    ['existingPB','dec'],['existingGPU','dec'],['existingStorBook','dec'],['existingGpuBook','dec'],['existingRemaining','dec'],
    ['initialRawPB','dec'],['initialRawAge','dec'],['initialProdPB','dec'],['initialProdAge','dec'],['gpuLimit','dec'],['linkGbps','dec'],
    ['idcStorCapex','ph'],['idcStorOpex','ph'],['idcGpuCapex','ph'],['idcGpuOpex','ph'],['idcCpuCost','ph'],['idcEgress','ph'],
    ['cloudToIDC','ph'],['idcToCloud','ph'],['diskPrice','ph'],['uplinkPrice','ph'],['accessBudget','ph'],['controlBudget','ph']
  ];
  const GLOSS_RULES=[
    ['hotDays','hotDays'],['retain','retain'],['stdDays','tiers'],['coldTier','tiers'],['arcDays','tiers'],['rawDays','rawDays'],
    ['prodDays','deliverable'],['productTier','tiers'],['minDays.*','minDays'],['retrieve.*','retrieve'],['discount','discount'],['unit','unit'],
    ['wl.*.gpu','gpuCoef'],['wl.*.cpu','gpuCoef'],['gpuScale','gpuCoef'],['spotShare','spot'],['cloudUtil','util'],['idcUtil','util'],
    ['hotPlace','idc'],['coldPlace','idc'],['existingPB','existing'],['existingGPU','existing'],['idcStorCapex','idc'],['idcGpuCapex','idc'],
    ['cloudToIDC','xfer'],['idcToCloud','xfer'],['uplinkPrice','uplink'],['linkGbps','uplink'],['deliverRatio','deliverRatio'],
    ['egressPrice','egress'],['accessBudget','budget'],['controlBudget','budget'],['mod.*.del','deliverable']
  ];
  const match=(rules,path)=>{const parts=path.split('.');let best=null;
    for(const [pat,val] of rules){const pp=pat.split('.');if(pp.length!==parts.length)continue;if(pp.every((x,i)=>x==='*'||x===parts[i]))best=val;}
    if(best)return best;if(rules===TAG_RULES)return 'est';return null;};
  const tagFor=path=>match(TAG_RULES,path);
  const glossFor=path=>match(GLOSS_RULES,path);

  function tag(t){const d=TAGS[t];return d?node('span',d[0],'tag '+d[1]):null;}
  function q(key){if(!G[key])return null;const b=node('button','?','q');b.type='button';b.dataset.g=key;b.setAttribute('aria-label','解释：'+G[key][0]);b.setAttribute('aria-expanded','false');return b;}
  function tagLegend(){const d=node('div',undefined,'taglegend');Object.keys(TAGS).forEach(k=>d.append(tag(k)));d.append(q('tags'));return d;}

  function principles(target){
    if(!target)return;target.replaceChildren();
    const ul=node('ul');PRINCIPLES.forEach(([lead,body])=>{const li=node('li');li.append(node('b',lead),document.createTextNode(body));ul.append(li);});
    target.append(ul);
  }
  const GROUPS=[['看结果',['total36','perHour','view','capex','baseline','sens']],['V2 的业务变量',['schemes','rawPolicy','prodPolicy','load','window']],
    ['数据与存储',['deliverable','hotDays','retain','rawDays','tiers','minDays','retrieve','discount','unit']],
    ['算力',['gpuCoef','spot','util']],['部署与交付',['idc','existing','xfer','uplink','deliverRatio','egress','budget']],['参数标签',['tags']]];
  function glossary(target){
    if(!target)return;target.replaceChildren();
    GROUPS.forEach(([title,keys])=>{target.append(node('h3',title,'glosshead'));keys.forEach(k=>{const [t,,full]=G[k];const d=node('div',undefined,'gi');d.id='gl-'+k;d.append(node('h4',t),node('p',full));target.append(d);});});
  }

  let pop=null,owner=null;
  function close(){if(pop)pop.hidden=true;if(owner)owner.setAttribute('aria-expanded','false');owner=null;}
  function open(b){
    const g=G[b.dataset.g];if(!g)return;
    if(!pop){pop=node('div',undefined,'termpop');pop.id='termpop';pop.setAttribute('role','dialog');pop.hidden=true;document.body.append(pop);}
    pop.replaceChildren(node('b',g[0]),node('span',g[1]));
    if(document.getElementById('gl-'+b.dataset.g)){const a=node('a','详细说明');a.href='#gl-'+b.dataset.g;pop.append(a);}
    pop.hidden=false;
    const r=b.getBoundingClientRect(),w=pop.offsetWidth,vw=document.documentElement.clientWidth;
    pop.style.left=Math.max(12,Math.min(r.left-8,vw-w-12))+window.scrollX+'px';pop.style.top=r.bottom+window.scrollY+6+'px';
    b.setAttribute('aria-expanded','true');owner=b;
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button.q');
    if(b){e.preventDefault();e.stopPropagation();if(owner===b){close();return;}close();open(b);return;}
    const a=e.target.closest&&e.target.closest('#termpop a');
    if(a){const t=document.querySelector(a.getAttribute('href'));const d=t&&t.closest('details');if(d)d.open=true;close();return;}
    if(!(e.target.closest&&e.target.closest('#termpop')))close();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  window.addEventListener('resize',close);
  // Static ? markers in HTML: <span data-q="key"></span>
  function mount(){document.querySelectorAll('[data-q]').forEach(s=>{const b=q(s.dataset.q);if(b)s.replaceWith(b);});
    principles(document.getElementById('principles'));glossary(document.getElementById('glossary'));
    const tl=document.getElementById('tagLegend');if(tl)tl.replaceChildren(tagLegend());}
  window.ReportContent={PRINCIPLES,G,tagFor,glossFor,tag,q,tagLegend,principles,glossary,mount,close};
})();
