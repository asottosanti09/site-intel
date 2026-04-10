import { useState, useEffect, useRef } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a restaurant and retail location intelligence analyst with deep expertise in F&B real estate, demographic analysis, and operator viability. You have access to web search — use it extensively before scoring.

STEP 1: CLASSIFY THE CONCEPT
Classify the concept into one of:
- NEIGHBORHOOD_BAR: cocktail bar, wine bar, dive bar
- DESTINATION_RESTAURANT: tasting menu, chef-driven, fine dining
- FAST_CASUAL: counter service, lunch-focused
- CAFE_COFFEE: morning-heavy, repeat visits
- RETAIL_SPECIALTY: boutique, specialty food
- NIGHTLIFE: late-night club, lounge, live music

STEP 2: APPLY CONCEPT-ADAPTIVE WEIGHTS
NEIGHBORHOOD_BAR: customerProfile=0.25, competition=0.22, footTraffic=0.15, trajectory=0.12, realEstate=0.10, locationHistory=0.10, transit=0.06
DESTINATION_RESTAURANT: customerProfile=0.20, competition=0.18, footTraffic=0.12, trajectory=0.14, realEstate=0.12, locationHistory=0.08, transit=0.16
FAST_CASUAL: customerProfile=0.18, competition=0.20, footTraffic=0.25, trajectory=0.10, realEstate=0.12, locationHistory=0.08, transit=0.07
CAFE_COFFEE: customerProfile=0.20, competition=0.20, footTraffic=0.22, trajectory=0.10, realEstate=0.10, locationHistory=0.08, transit=0.10
RETAIL_SPECIALTY: customerProfile=0.22, competition=0.18, footTraffic=0.20, trajectory=0.12, realEstate=0.12, locationHistory=0.08, transit=0.08
NIGHTLIFE: customerProfile=0.20, competition=0.20, footTraffic=0.14, trajectory=0.10, realEstate=0.10, locationHistory=0.08, transit=0.18

STEP 3: RESEARCH using web search:
1. Census/ACS data for that ZIP (median HHI, age, education, owner-occupied, density)
2. Named competing businesses within 0.5 miles with price points
3. Commercial retail rent PSF for this specific corridor
4. Nearest subway station, lines, walk time in minutes, night service availability
5. ALL prior tenants at this exact address - names, years operated, why closed
6. Neighborhood trajectory signals (openings, closures, investment, press)

STEP 4: SCORE 0-100 per dimension. Calculate overallScore = sum(score x weight).

Return ONLY valid JSON, no markdown, no preamble:

{"overallScore":<int>,"conceptCategory":"<category>","verdict":"<sharp specific sentence referencing actual local context>","address":"<full address>","neighborhood":"<name>","concept":"<as provided>","dimensions":[{"name":"Customer Profile","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences with specific data>","signals":["<signal>","<signal>","<signal>"]},{"name":"Competition & Comp Set","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences naming competitors>","signals":["<named competitor>","<signal>","<signal>"]},{"name":"Foot Traffic & Visibility","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences>","signals":["<signal>","<signal>","<signal>"]},{"name":"Neighborhood Trajectory","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences>","signals":["<signal>","<signal>","<signal>"]},{"name":"Real Estate Economics","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences with PSF estimates>","signals":["<signal>","<signal>","<signal>"]},{"name":"Location History","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences naming prior tenants>","signals":["<prior tenant + tenure>","<signal>","<signal>"]},{"name":"Transit & Accessibility","score":<int>,"weight":<decimal>,"weightedScore":<decimal>,"summary":"<2-3 sentences with lines and distances>","signals":["<line + distance>","<signal>","<signal>"]}],"risks":["<risk 1>","<risk 2>","<risk 3>"],"opportunities":["<opp 1>","<opp 2>","<opp 3>"],"comparables":[{"name":"<real business>","type":"<type>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why relevant>"},{"name":"<real business>","type":"<type>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why relevant>"},{"name":"<real business>","type":"<type>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why relevant>"},{"name":"<real business>","type":"<type>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why relevant>"}],"locationHistory":[{"name":"<prior tenant>","concept":"<type>","tenure":"<years>","closureNote":"<context>"}],"transitSnapshot":{"nearestSubway":"<station>","linesServed":["<line>"],"walkMinutes":<int>,"nightService":"<yes/limited/no>","walkScore":"<score>","citibikeNearby":"<yes/no>"},"censusSnapshot":{"medianHouseholdIncome":"<$XXX,XXX>","averageHouseholdIncome":"<$XXX,XXX>","medianAge":"<XX>","educationBachelorsPlus":"<XX%>","professionalWorkforce":"<XX%>","ownerOccupied":"<XX%>","populationDensity":"<XX,XXX per sq mi>"}}`;

const CATEGORY_COLORS = {NEIGHBORHOOD_BAR:"#a78bfa",DESTINATION_RESTAURANT:"#f59e0b",FAST_CASUAL:"#38bdf8",CAFE_COFFEE:"#fb923c",RETAIL_SPECIALTY:"#34d399",NIGHTLIFE:"#f472b6"};
const CATEGORY_LABELS = {NEIGHBORHOOD_BAR:"Neighborhood Bar",DESTINATION_RESTAURANT:"Destination Restaurant",FAST_CASUAL:"Fast Casual",CAFE_COFFEE:"Cafe / Coffee",RETAIL_SPECIALTY:"Retail / Specialty",NIGHTLIFE:"Nightlife"};

function ScoreRing({score,size=140,strokeWidth=12}){
  const r=(size-strokeWidth)/2,c=2*Math.PI*r;
  const [a,setA]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setA(score),300);return()=>clearTimeout(t);},[score]);
  const color=score>=75?"#4ade80":score>=55?"#facc15":"#f87171";
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeDasharray={c} strokeDashoffset={c-(a/100)*c} strokeLinecap="round"
      style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)"}}/>
  </svg>;
}

function DimensionBar({dim,index}){
  const [w,setW]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setW(dim.score),400+index*120);return()=>clearTimeout(t);},[dim.score,index]);
  const color=dim.score>=75?"#4ade80":dim.score>=55?"#facc15":"#f87171";
  return <div style={{marginBottom:"22px",paddingBottom:"22px",borderBottom:"1px solid #0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"7px"}}>
      <div>
        <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"11px",color:"#94a3b8",letterSpacing:"0.08em",textTransform:"uppercase"}}>{dim.name}</span>
        <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#1e293b",marginLeft:"10px"}}>wt {dim.weight}</span>
      </div>
      <div style={{textAlign:"right"}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",color,fontWeight:"700"}}>{dim.score}</span>
        <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#334155",marginLeft:"6px"}}>= {dim.weightedScore} pts</span>
      </div>
    </div>
    <div style={{height:"3px",background:"#1e293b",borderRadius:"2px",overflow:"hidden",marginBottom:"10px"}}>
      <div style={{height:"100%",width:`${w}%`,background:color,borderRadius:"2px",transition:`width 1.1s cubic-bezier(0.34,1.56,0.64,1) ${index*0.08}s`}}/>
    </div>
    <p style={{margin:"0 0 8px",fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"}}>{dim.summary}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
      {dim.signals.map((s,i)=><span key={i} style={{fontSize:"11px",padding:"3px 9px",background:"#0a0f1e",border:"1px solid #1e293b",borderRadius:"20px",color:"#475569",fontFamily:"'Courier Prime',monospace"}}>{s}</span>)}
    </div>
  </div>;
}

function StreamingLog({lines}){
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[lines]);
  return <div ref={ref} style={{fontFamily:"'Courier Prime',monospace",fontSize:"12px",color:"#4ade80",background:"#020617",border:"1px solid #0f172a",padding:"20px",borderRadius:"8px",height:"180px",overflowY:"auto",lineHeight:"1.9"}}>
    {lines.map((l,i)=><div key={i}><span style={{color:"#1d4ed8"}}>▶ </span>{l}</div>)}
    <div style={{animation:"blink 1s infinite"}}>█</div>
  </div>;
}

export default function LocationScorer(){
  const [address,setAddress]=useState("384 Court St, Brooklyn, NY 11231");
  const [concept,setConcept]=useState("High-end cocktail bar");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [logs,setLogs]=useState([]);
  const [activeTab,setActiveTab]=useState("overview");
  const addLog=(msg)=>setLogs(prev=>[...prev,msg]);

  const callAPI=async(messages)=>{
    const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:ANTHROPIC_MODEL,max_tokens:4000,system:SYSTEM_PROMPT,tools:[{type:"web_search_20250305",name:"web_search"}],messages})});
    return r.json();
  };

  const analyze=async()=>{
    setLoading(true);setResult(null);setError(null);setLogs([]);setActiveTab("overview");
    addLog("Initializing location intelligence scan...");
    addLog(`Address: ${address}`);
    addLog(`Concept: ${concept}`);
    addLog("Classifying concept → selecting adaptive weight table...");
    const userMsg={role:"user",content:`Run full location intelligence analysis:\n\nAddress: ${address}\nConcept: ${concept}\n\nSearch for: (1) ALL prior tenants at this exact address, years operated, why closed, (2) nearest subway station name, lines, walk minutes, night service, (3) census/ACS data for this ZIP, (4) named competing concepts within 0.5 miles with price points, (5) commercial retail rent PSF for this corridor, (6) neighborhood trajectory. Classify concept, apply adaptive weights, score all 7 dimensions, return complete JSON.`};
    try{
      let messages=[userMsg],jsonText=null,rounds=0;
      while(rounds<4&&!jsonText){
        const data=await callAPI(messages);rounds++;
        for(const b of data.content){if(b.type==="tool_use")addLog(`Searching: "${b.input?.query}"`);}
        if(data.stop_reason==="tool_use"){
          if(rounds===2)addLog("Processing results, scoring dimensions...");
          if(rounds===3)addLog("Running follow-up searches...");
          const tr=data.content.filter(b=>b.type==="tool_use").map(b=>({type:"tool_result",tool_use_id:b.id,content:`Search for "${b.input?.query}" completed.`}));
          messages=[...messages,{role:"assistant",content:data.content},{role:"user",content:tr}];
        }else{
          for(const b of data.content){if(b.type==="text"&&b.text.includes("{")){jsonText=b.text;break;}}
        }
      }
      addLog("Calculating weighted composite score...");addLog("Building report...");
      if(!jsonText)throw new Error("No JSON response after "+rounds+" rounds.");
      setResult(JSON.parse(jsonText.replace(/```json|```/g,"").trim()));
    }catch(err){setError(err.message);}
    setLoading(false);
  };

  const scoreColor=s=>s>=75?"#4ade80":s>=55?"#facc15":"#f87171";
  const accent=result?(CATEGORY_COLORS[result.conceptCategory]||"#4ade80"):"#4ade80";
  const tabStyle=tab=>({padding:"7px 16px",background:activeTab===tab?"#1e293b":"transparent",border:activeTab===tab?"1px solid #334155":"1px solid transparent",borderRadius:"5px",color:activeTab===tab?"#f1f5f9":"#475569",cursor:"pointer",fontFamily:"'Courier Prime',monospace",fontSize:"10px",letterSpacing:"0.09em",textTransform:"uppercase"});

  return <div style={{minHeight:"100vh",background:"#020617",color:"#f1f5f9",fontFamily:"'Playfair Display',serif"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Courier+Prime:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#020617}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px}input{background:#0a0f1e!important;border:1px solid #1e293b!important;color:#f1f5f9!important;border-radius:6px!important;padding:11px 14px!important;width:100%!important;font-family:'Courier Prime',monospace!important;font-size:13px!important;outline:none!important}input:focus{border-color:#334155!important}input::placeholder{color:#1e293b!important}button{transition:all 0.15s}`}</style>

    <div style={{borderBottom:"1px solid #0a0f1e",padding:"20px 36px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:"14px"}}>
        <h1 style={{fontSize:"20px",fontWeight:"900",letterSpacing:"-0.02em"}}>SITE INTEL</h1>
        <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#1e293b",letterSpacing:"0.15em"}}>LOCATION SCORING ENGINE v2.0</span>
      </div>
      <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#1e293b"}}>7-DIM · CONCEPT-ADAPTIVE WEIGHTS</span>
    </div>

    <div style={{maxWidth:"860px",margin:"0 auto",padding:"36px 24px"}}>
      <div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"24px",marginBottom:"28px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"16px"}}>
          <div>
            <label style={{display:"block",fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"7px"}}>Business Address</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="123 Main St, Brooklyn, NY"/>
          </div>
          <div>
            <label style={{display:"block",fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"7px"}}>Business Concept</label>
            <input value={concept} onChange={e=>setConcept(e.target.value)} placeholder="e.g. High-end cocktail bar"/>
          </div>
        </div>
        <button onClick={analyze} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"#0f172a":"#f1f5f9",color:loading?"#334155":"#020617",border:"none",borderRadius:"7px",fontFamily:"'Courier Prime',monospace",fontSize:"11px",fontWeight:"700",letterSpacing:"0.14em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer"}}>
          {loading?"ANALYZING LOCATION...":"RUN LOCATION ANALYSIS →"}
        </button>
      </div>

      {loading&&<div style={{marginBottom:"24px"}}><StreamingLog lines={logs}/></div>}
      {error&&<div style={{background:"#150000",border:"1px solid #450a0a",borderRadius:"8px",padding:"16px",color:"#f87171",fontFamily:"'Courier Prime',monospace",fontSize:"12px",marginBottom:"24px"}}>ERROR: {error}</div>}

      {result&&<div style={{animation:"fadeUp 0.4s ease"}}>
        <div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"28px",marginBottom:"20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"28px"}}>
            <div style={{position:"relative",flexShrink:0}}>
              <ScoreRing score={result.overallScore}/>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:"34px",fontWeight:"900",lineHeight:1,color:scoreColor(result.overallScore)}}>{result.overallScore}</span>
                <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155",letterSpacing:"0.1em"}}>/100</span>
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px",flexWrap:"wrap"}}>
                <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:accent,letterSpacing:"0.1em",textTransform:"uppercase",border:`1px solid ${accent}33`,padding:"3px 8px",borderRadius:"4px"}}>{CATEGORY_LABELS[result.conceptCategory]||result.conceptCategory}</span>
                <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155"}}>{result.neighborhood} · {result.address}</span>
              </div>
              <h2 style={{fontSize:"21px",fontWeight:"900",letterSpacing:"-0.02em",marginBottom:"8px"}}>{result.concept}</h2>
              <p style={{fontSize:"14px",color:"#94a3b8",fontStyle:"italic",lineHeight:"1.6"}}>{result.verdict}</p>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"6px",marginTop:"22px",paddingTop:"18px",borderTop:"1px solid #0f172a"}}>
            {result.dimensions.map((d,i)=><div key={i} style={{textAlign:"center",padding:"8px 4px",background:"#0f172a",borderRadius:"6px"}}>
              <div style={{fontFamily:"'Courier Prime',monospace",fontSize:"8px",color:"#334155",textTransform:"uppercase",marginBottom:"4px",lineHeight:"1.4"}}>{d.name.split(" ")[0]}</div>
              <div style={{fontSize:"17px",fontWeight:"700",color:scoreColor(d.score)}}>{d.score}</div>
              <div style={{fontFamily:"'Courier Prime',monospace",fontSize:"8px",color:"#1e293b",marginTop:"2px"}}>×{d.weight}</div>
            </div>)}
          </div>
        </div>

        <div style={{display:"flex",gap:"6px",marginBottom:"16px",flexWrap:"wrap"}}>
          {["overview","dimensions","history","transit","market","census"].map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} style={tabStyle(tab)}>{tab}</button>)}
        </div>

        {activeTab==="overview"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
          <div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"22px"}}>
            <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#4ade80",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>↑ OPPORTUNITIES</h3>
            {result.opportunities.map((o,i)=><div key={i} style={{display:"flex",gap:"10px",marginBottom:"13px",fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"}}><span style={{color:"#4ade80",flexShrink:0}}>→</span>{o}</div>)}
          </div>
          <div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"22px"}}>
            <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#f87171",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>↓ RISKS</h3>
            {result.risks.map((r,i)=><div key={i} style={{display:"flex",gap:"10px",marginBottom:"13px",fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"}}><span style={{color:"#f87171",flexShrink:0}}>→</span>{r}</div>)}
          </div>
        </div>}

        {activeTab==="dimensions"&&<div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"26px"}}>
          {result.dimensions.map((dim,i)=><DimensionBar key={i} dim={dim} index={i}/>)}
          <div style={{marginTop:"8px",padding:"16px",background:"#0f172a",borderRadius:"8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#475569",letterSpacing:"0.08em",textTransform:"uppercase"}}>Weighted Composite Score</span>
            <span style={{fontSize:"28px",fontWeight:"900",color:scoreColor(result.overallScore)}}>{result.overallScore} / 100</span>
          </div>
        </div>}

        {activeTab==="history"&&<div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"26px"}}>
          <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#475569",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"20px"}}>Prior Tenants at This Address</h3>
          {result.locationHistory&&result.locationHistory.length>0
            ?result.locationHistory.map((h,i)=><div key={i} style={{display:"flex",gap:"16px",padding:"16px 0",borderBottom:i<result.locationHistory.length-1?"1px solid #0f172a":"none"}}>
                <div style={{width:"34px",height:"34px",background:"#0f172a",borderRadius:"6px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#334155"}}>{i+1}</div>
                <div>
                  <div style={{fontWeight:"700",fontSize:"15px",marginBottom:"3px"}}>{h.name}</div>
                  <div style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"5px"}}>{h.concept} · {h.tenure}</div>
                  <div style={{fontSize:"13px",color:"#64748b",lineHeight:"1.5"}}>{h.closureNote}</div>
                </div>
              </div>)
            :<p style={{color:"#334155",fontFamily:"'Courier Prime',monospace",fontSize:"12px"}}>No prior tenant data found.</p>}
          {result.dimensions.find(d=>d.name==="Location History")&&<div style={{marginTop:"20px",padding:"16px",background:"#0f172a",borderRadius:"8px"}}>
            <p style={{fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"}}>{result.dimensions.find(d=>d.name==="Location History").summary}</p>
          </div>}
        </div>}

        {activeTab==="transit"&&result.transitSnapshot&&<div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"26px"}}>
          <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#475569",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"20px"}}>Transit & Accessibility</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
            {[["Nearest Subway",result.transitSnapshot.nearestSubway],["Walk Time",result.transitSnapshot.walkMinutes?`${result.transitSnapshot.walkMinutes} min`:"—"],["Lines Served",(result.transitSnapshot.linesServed||[]).join(", ")],["Night Service",result.transitSnapshot.nightService],["Walk Score",result.transitSnapshot.walkScore],["Citibike Nearby",result.transitSnapshot.citibikeNearby]].map(([label,val])=><div key={label} style={{background:"#0f172a",borderRadius:"7px",padding:"16px"}}>
              <div style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"5px"}}>{label}</div>
              <div style={{fontSize:"15px",fontWeight:"700"}}>{val||"—"}</div>
            </div>)}
          </div>
          {result.dimensions.find(d=>d.name==="Transit & Accessibility")&&<div style={{padding:"16px",background:"#0f172a",borderRadius:"8px"}}>
            <p style={{fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"}}>{result.dimensions.find(d=>d.name==="Transit & Accessibility").summary}</p>
          </div>}
        </div>}

        {activeTab==="market"&&<div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"26px"}}>
          <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#475569",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"20px"}}>Competitive Comp Set</h3>
          {result.comparables.map((c,i)=><div key={i} style={{display:"flex",gap:"14px",padding:"14px 0",borderBottom:i<result.comparables.length-1?"1px solid #0f172a":"none",alignItems:"flex-start"}}>
            <div style={{width:"30px",height:"30px",background:"#0f172a",borderRadius:"5px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Courier Prime',monospace",fontSize:"10px",color:"#334155"}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"3px"}}>
                <span style={{fontWeight:"700",fontSize:"14px"}}>{c.name}</span>
                <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"11px",color:"#facc15"}}>{c.pricePoint}</span>
              </div>
              <div style={{display:"flex",gap:"10px",marginBottom:"5px"}}>
                <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#475569",textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.type}</span>
                {c.distance&&<span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155"}}>{c.distance}</span>}
              </div>
              <div style={{fontSize:"12px",color:"#475569",lineHeight:"1.5"}}>{c.note}</div>
            </div>
          </div>)}
        </div>}

        {activeTab==="census"&&result.censusSnapshot&&<div style={{background:"#0a0f1e",border:"1px solid #0f172a",borderRadius:"10px",padding:"26px"}}>
          <h3 style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#475569",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"20px"}}>Census Snapshot · ZIP {address.match(/\d{5}/)?.[0]||""}</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            {Object.entries(result.censusSnapshot).map(([k,v])=><div key={k} style={{background:"#0f172a",borderRadius:"7px",padding:"16px"}}>
              <div style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",color:"#334155",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>{k.replace(/([A-Z])/g,' $1').trim()}</div>
              <div style={{fontSize:"19px",fontWeight:"900"}}>{v||"—"}</div>
            </div>)}
          </div>
        </div>}

      </div>}
    </div>
  </div>;
}
