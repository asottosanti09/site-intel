import { useState, useEffect, useRef } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a restaurant and retail location intelligence analyst with deep expertise in F&B real estate, demographic analysis, and operator viability. You have access to web search — use it extensively before scoring.

STEP 1: CLASSIFY THE CONCEPT
Classify into one of:
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
4. Nearest subway station, lines, walk time in minutes, night service
5. ALL prior tenants at this exact address - names, years operated, why closed
6. Neighborhood trajectory signals (openings, closures, investment, press)

STEP 4: REAL ESTATE ECONOMICS
If monthlyRent is provided (not null/0), use it to calculate:
- Implied annual rent = monthlyRent x 12
- Estimated sq footage if PSF is known: monthlyRent / (PSF/12)
- Rent-to-revenue ratio benchmark: F&B healthy range is 6-10% of gross revenue. Calculate what annual revenue is needed for this rent to hit 8%: monthlyRent x 12 / 0.08
- Flag if rent appears high, fair, or favorable for the concept type and market

STEP 5: SCORE 0-100 per dimension. overallScore = sum(score x weight).

Return ONLY valid JSON, no markdown:

{"overallScore":<int>,"conceptCategory":"<cat>","verdict":"<sharp specific sentence with local context>","address":"<full>","neighborhood":"<n>","concept":"<as given>","dimensions":[{"name":"Customer Profile","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences>","signals":["<s>","<s>","<s>"]},{"name":"Competition & Comp Set","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences naming competitors>","signals":["<named competitor>","<s>","<s>"]},{"name":"Foot Traffic & Visibility","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences>","signals":["<s>","<s>","<s>"]},{"name":"Neighborhood Trajectory","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences>","signals":["<s>","<s>","<s>"]},{"name":"Real Estate Economics","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences with PSF and rent analysis>","signals":["<s>","<s>","<s>"]},{"name":"Location History","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences naming prior tenants>","signals":["<prior tenant + tenure>","<s>","<s>"]},{"name":"Transit & Accessibility","score":<int>,"weight":<dec>,"weightedScore":<dec>,"summary":"<2-3 sentences>","signals":["<line + distance>","<s>","<s>"]}],"risks":["<r1>","<r2>","<r3>"],"opportunities":["<o1>","<o2>","<o3>"],"comparables":[{"name":"<real biz>","type":"<t>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why>"},{"name":"<real biz>","type":"<t>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why>"},{"name":"<real biz>","type":"<t>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why>"},{"name":"<real biz>","type":"<t>","distance":"<X min>","pricePoint":"<$-$$$$>","note":"<why>"}],"locationHistory":[{"name":"<prior>","concept":"<t>","tenure":"<yrs>","closureNote":"<context>"}],"rentAnalysis":{"monthlyRent":"<$X,XXX or null>","impliedAnnual":"<$XX,XXX or null>","revenueNeededAt8pct":"<$XXX,XXX or null>","estimatedPSF":"<$XX or estimated>","rentVerdict":"<favorable/fair/high or null if no rent provided>","rentNote":"<1 sentence analysis or null>"},"transitSnapshot":{"nearestSubway":"<station>","linesServed":["<line>"],"walkMinutes":<int>,"nightService":"<yes/limited/no>","walkScore":"<score>","citibikeNearby":"<yes/no>"},"censusSnapshot":{"medianHouseholdIncome":"<$XXX,XXX>","averageHouseholdIncome":"<$XXX,XXX>","medianAge":"<XX>","educationBachelorsPlus":"<XX%>","professionalWorkforce":"<XX%>","ownerOccupied":"<XX%>","populationDensity":"<XX,XXX per sq mi>"}}`;

const CATEGORY_LABELS = {NEIGHBORHOOD_BAR:"Neighborhood Bar",DESTINATION_RESTAURANT:"Destination Restaurant",FAST_CASUAL:"Fast Casual",CAFE_COFFEE:"Café / Coffee",RETAIL_SPECIALTY:"Retail / Specialty",NIGHTLIFE:"Nightlife"};

function ScoreArc({ score }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(score), 400); return () => clearTimeout(t); }, [score]);
  const size = 260, sw = 16, r = (size - sw) / 2;
  const angleRad = (a) => (a * Math.PI) / 180;
  const cx = size / 2, cy = size / 2 + 30;
  const startAngle = -220, totalAngle = 260;
  const startRad = angleRad(startAngle), endRad = angleRad(startAngle + totalAngle);
  const sx = cx + r * Math.cos(startRad), sy = cy + r * Math.sin(startRad);
  const ex = cx + r * Math.cos(endRad), ey = cy + r * Math.sin(endRad);
  const bgPath = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
  const pct = animated / 100;
  const fillAngle = startAngle + totalAngle * pct;
  const fillRad = angleRad(fillAngle);
  const fx = cx + r * Math.cos(fillRad), fy = cy + r * Math.sin(fillRad);
  const large = totalAngle * pct > 180 ? 1 : 0;
  const fillPath = pct > 0 ? `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${fx} ${fy}` : "";
  const color = score >= 75 ? "#2e7d52" : score >= 55 ? "#c8860a" : "#a53030";
  return (
    <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.8}`} style={{overflow:"visible"}}>
      <path d={bgPath} fill="none" stroke="#1a1a1a" strokeWidth={sw} strokeLinecap="round"/>
      {fillPath && <path d={fillPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(0.34,1.2,0.64,1)"}}/>}
      <text x={cx} y={cy-10} textAnchor="middle" fill={color} fontSize="72" fontFamily="'Cormorant Garamond',serif" fontWeight="700">{animated}</text>
      <text x={cx} y={cy+18} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="12" fontFamily="'Helvetica Neue',Helvetica,Arial,sans-serif" letterSpacing="3">OUT OF 100</text>
    </svg>
  );
}

function DimRow({ dim, index }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(dim.score), 500 + index * 80); return () => clearTimeout(t); }, [dim.score]);
  const color = dim.score >= 75 ? "#2e7d52" : dim.score >= 55 ? "#c8860a" : "#a53030";
  return (
    <div style={{padding:"20px 0",borderBottom:"1px solid #eee"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"8px"}}>
        <span style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",fontSize:"10px",color:"#999",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:"600"}}>{dim.name}</span>
        <div style={{display:"flex",alignItems:"baseline",gap:"8px"}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"30px",color,fontWeight:"700",lineHeight:1}}>{dim.score}</span>
          <span style={{fontSize:"9px",color:"#bbb"}}>x{dim.weight}</span>
        </div>
      </div>
      <div style={{height:"2px",background:"#eee",borderRadius:"1px",overflow:"hidden",marginBottom:"12px"}}>
        <div style={{height:"100%",width:`${w}%`,background:color,transition:`width 1s ease ${index*0.07}s`}}/>
      </div>
      <p style={{fontFamily:"'EB Garamond',serif",fontSize:"16px",color:"#555",lineHeight:"1.7",margin:"0 0 10px"}}>{dim.summary}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
        {dim.signals.map((s,i) => <span key={i} style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",fontSize:"10px",color:"#888",border:"1px solid #e0ddd8",padding:"3px 10px",borderRadius:"2px",background:"#fafaf8"}}>{s}</span>)}
      </div>
    </div>
  );
}

export default function App() {
  const [address, setAddress] = useState("");
  const [concept, setConcept] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPct, setLoadingPct] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const resultRef = useRef(null);
  const addressInputRef = useRef(null);
  const loadingTimer = useRef(null);

  // Load Google Places + wire autocomplete
  useEffect(() => {
    const initAC = () => {
      if (!window.google || !addressInputRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ["address"], componentRestrictions: { country: "us" }
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place.formatted_address) setAddress(place.formatted_address);
      });
    };

    if (window.google) { initAC(); return; }
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyC9p7jRRvr5j_sPfFNbFaFNjr7RXS5AKCI&libraries=places";
    script.async = true;
    script.onload = initAC;
    document.head.appendChild(script);
  }, []);

  const startProgress = () => {
    setLoadingPct(0);
    let pct = 0;
    loadingTimer.current = setInterval(() => {
      const step = Math.max(0.2, (90 - pct) * 0.025);
      pct = Math.min(90, pct + step);
      setLoadingPct(pct);
    }, 350);
  };

  const finishProgress = () => {
    clearInterval(loadingTimer.current);
    setLoadingPct(100);
  };

  const callAPI = async (messages) => {
    const r = await fetch("/api/anthropic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 4000, system: SYSTEM_PROMPT, tools: [{ type: "web_search_20250305", name: "web_search" }], messages })
    });
    return r.json();
  };

  const analyze = async () => {
    setLoading(true); setResult(null); setError(null); setTab("overview");
    startProgress();
    const rentNote = monthlyRent
      ? `\nMonthly Rent: $${monthlyRent} — calculate rent economics (implied annual, PSF estimate, revenue needed at 8% rent-to-sales ratio, verdict).`
      : "\nMonthly Rent: not provided — estimate market PSF only.";
    const userMsg = { role: "user", content: `Run full location intelligence analysis:\n\nAddress: ${address}\nConcept: ${concept}${rentNote}\n\nSearch for: (1) ALL prior tenants at this exact address, years operated, why closed, (2) nearest subway station, lines, walk minutes, night service, (3) census/ACS for this ZIP, (4) named competing concepts within 0.5 miles with price points, (5) retail rent PSF for this corridor, (6) neighborhood trajectory. Classify, apply adaptive weights, score 7 dimensions, return complete JSON.` };
    try {
      let messages = [userMsg], jsonText = null, rounds = 0;
      while (rounds < 4 && !jsonText) {
        const data = await callAPI(messages); rounds++;
        if (!data.content || !Array.isArray(data.content)) {
          throw new Error(`API error: ${data.error?.message || data.message || JSON.stringify(data)}`);
        }
        if (data.stop_reason === "tool_use") {
          const tr = data.content.filter(b => b.type === "tool_use").map(b => ({ type: "tool_result", tool_use_id: b.id, content: `Search for "${b.input?.query}" completed.` }));
          messages = [...messages, { role: "assistant", content: data.content }, { role: "user", content: tr }];
        } else {
          for (const b of data.content) { if (b.type === "text" && b.text.includes("{")) { jsonText = b.text; break; } }
        }
      }
      if (!jsonText) throw new Error("No JSON response after " + rounds + " rounds.");
      finishProgress();
      setResult(JSON.parse(jsonText.replace(/```json|```/g, "").trim()));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    } catch (err) {
      finishProgress();
      setError(err.message);
    }
    setLoading(false);
  };

  const sc = s => s >= 75 ? "#2e7d52" : s >= 55 ? "#c8860a" : "#a53030";
  const BH_RED = "#7a1515";
  const inputStyle = { width:"100%", background:"#fff", border:"1px solid #ddd", color:"#1a1a1a", padding:"12px 14px", fontFamily:"'EB Garamond',serif", fontSize:"17px", outline:"none", borderRadius:"2px" };
  const labelStyle = { display:"block", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"10px", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"8px", fontWeight:"500" };

  return (
    <div style={{ background:"#fff", minHeight:"100vh", color:"#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes scoreReveal { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar{width:2px} ::-webkit-scrollbar-thumb{background:#ccc}
        input::placeholder { color:#bbb !important; font-family:'EB Garamond',serif !important; font-style:italic; }
        .pac-container { font-family:'EB Garamond',serif; font-size:15px; border:1px solid #ddd; border-radius:2px; box-shadow:0 4px 16px rgba(0,0,0,0.08); margin-top:2px; }
        .pac-item { padding:10px 14px; cursor:pointer; color:#333; }
        .pac-item:hover { background:#f8f7f5; }
        .pac-item-query { font-family:'EB Garamond',serif; }
      `}</style>

      {/* Hero — no nav */}
      <div style={{ maxWidth:"780px", margin:"0 auto", padding:"72px 32px 56px", textAlign:"center" }}>
        <p style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"10px", letterSpacing:"0.25em", color:BH_RED, textTransform:"uppercase", marginBottom:"20px", fontWeight:"500" }}>Back-House · Location Intelligence</p>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(48px,7vw,80px)", fontWeight:"600", lineHeight:"1.05", letterSpacing:"-0.01em", color:"#111", marginBottom:"24px" }}>
          Is this the<br /><em style={{ fontStyle:"italic", color:BH_RED }}>right location</em><br />for your concept?
        </h1>
        <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"19px", color:"#555", lineHeight:"1.75", maxWidth:"540px", margin:"0 auto 52px" }}>
          Enter an address and business concept. We score it across seven weighted dimensions — demographics, competition, foot traffic, real estate economics, location history, transit access, and neighborhood trajectory — using live market data and census research.
        </p>

        {/* Input card */}
        <div style={{ background:"#f8f7f5", border:"1px solid #e8e4de", padding:"40px", textAlign:"left" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>
            <div>
              <label style={labelStyle}>Business Address</label>
              <input
                ref={addressInputRef}
                value={address}
                onChange={e => setAddress(e.target.value)}
                style={inputStyle}
                placeholder="123 Court St, Brooklyn, NY"
                autoComplete="off"
              />
            </div>
            <div>
              <label style={labelStyle}>Business Concept</label>
              <input value={concept} onChange={e => setConcept(e.target.value)} style={inputStyle} placeholder="High-end cocktail bar" />
            </div>
          </div>
          <div style={{ marginBottom:"24px" }}>
            <label style={labelStyle}>Monthly Rent <span style={{ color:"#bbb", fontWeight:"400", letterSpacing:"0.05em", textTransform:"none" }}>— optional, unlocks rent economics</span></label>
            <div style={{ display:"flex", alignItems:"center", background:"#fff", border:"1px solid #ddd", borderRadius:"2px" }}>
              <span style={{ padding:"12px 2px 12px 14px", fontFamily:"'EB Garamond',serif", fontSize:"17px", color:"#aaa", userSelect:"none", lineHeight:1 }}>$</span>
              <input value={monthlyRent} onChange={e => setMonthlyRent(e.target.value.replace(/\D/g,""))}
                style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", padding:"12px 14px 12px 6px", fontFamily:"'EB Garamond',serif", fontSize:"17px", outline:"none" }}
                placeholder="8,500" />
            </div>
          </div>

          {/* Button with progress bar fill */}
          <div style={{ position:"relative", overflow:"hidden", borderRadius:"2px" }}>
            <div style={{
              position:"absolute", top:0, left:0, height:"100%",
              width: loading ? `${loadingPct}%` : "0%",
              background:"#5c0f0f",
              transition:"width 0.35s ease",
              zIndex:0
            }}/>
            <button onClick={analyze} disabled={loading} style={{
              position:"relative", zIndex:1,
              width:"100%", padding:"16px",
              background: BH_RED,
              color:"#fff", border:"none",
              fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
              fontSize:"11px", fontWeight:"600", letterSpacing:"0.22em",
              textTransform:"uppercase", cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Analyzing Location..." : "Score This Location →"}
            </button>
          </div>
        </div>

        {error && <div style={{ marginTop:"20px", background:"#fff5f5", border:"1px solid #fcc", padding:"16px", color:"#c0392b", fontFamily:"monospace", fontSize:"12px", textAlign:"left", borderRadius:"2px" }}>Error: {error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div ref={resultRef} style={{ animation:"fadeUp 0.6s ease", borderTop:`4px solid ${BH_RED}` }}>

          {/* Score hero */}
          <div style={{ background:"#111", padding:"72px 48px", textAlign:"center", borderBottom:"1px solid #222" }}>
            <p style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"10px", letterSpacing:"0.22em", color:"rgba(255,255,255,0.35)", textTransform:"uppercase", marginBottom:"8px", fontWeight:"500" }}>
              {result.neighborhood} · {CATEGORY_LABELS[result.conceptCategory] || result.conceptCategory}
            </p>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(26px,4vw,42px)", fontWeight:"600", color:"#f5f0ea", marginBottom:"48px", letterSpacing:"-0.01em" }}>{result.address}</h2>
            <div style={{ display:"inline-block", animation:"scoreReveal 0.8s ease 0.2s both" }}>
              <ScoreArc score={result.overallScore} />
            </div>
            <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"21px", fontStyle:"italic", color:"rgba(255,255,255,0.55)", maxWidth:"620px", margin:"24px auto 0", lineHeight:"1.65" }}>"{result.verdict}"</p>

            <div style={{ display:"flex", marginTop:"56px", borderTop:"1px solid #222", borderLeft:"1px solid #222" }}>
              {result.dimensions.map((d,i) => (
                <div key={i} style={{ flex:1, padding:"20px 8px", borderRight:"1px solid #222", borderBottom:"1px solid #222", textAlign:"center" }}>
                  <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"8px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"10px", lineHeight:"1.5", fontWeight:"500" }}>{d.name}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"30px", fontWeight:"700", color:sc(d.score), lineHeight:1 }}>{d.score}</div>
                  <div style={{ fontSize:"8px", color:"rgba(255,255,255,0.2)", marginTop:"5px" }}>wt {d.weight}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom:"2px solid #eee", padding:"0 48px", display:"flex", background:"#fff", overflowX:"auto" }}>
            {(result.rentAnalysis?.monthlyRent && result.rentAnalysis.monthlyRent !== "null"
              ? ["Overview","Dimensions","Rent","History","Transit","Market","Census"]
              : ["Overview","Dimensions","History","Transit","Market","Census"]
            ).map(t => (
              <button key={t} onClick={() => setTab(t.toLowerCase())} style={{
                fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"10px", letterSpacing:"0.15em",
                textTransform:"uppercase", padding:"16px 20px", border:"none",
                borderBottom: tab === t.toLowerCase() ? `3px solid ${BH_RED}` : "3px solid transparent",
                background:"transparent", color: tab === t.toLowerCase() ? BH_RED : "#999",
                cursor:"pointer", fontWeight:"600", whiteSpace:"nowrap", marginBottom:"-2px"
              }}>{t}</button>
            ))}
          </div>

          <div style={{ maxWidth:"920px", margin:"0 auto", padding:"52px 32px" }}>

            {tab==="overview" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"28px" }}>
                <div style={{ border:"1px solid #e8e4de", padding:"32px", background:"#fafaf8" }}>
                  <p style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#2e7d52", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:"24px", fontWeight:"600" }}>↑ Opportunities</p>
                  {result.opportunities.map((o,i) => (
                    <div key={i} style={{ display:"flex", gap:"14px", marginBottom:"18px" }}>
                      <span style={{ color:BH_RED, fontFamily:"'Cormorant Garamond',serif", fontSize:"20px", lineHeight:"1.3", flexShrink:0 }}>—</span>
                      <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#444", lineHeight:"1.7" }}>{o}</p>
                    </div>
                  ))}
                </div>
                <div style={{ border:"1px solid #e8e4de", padding:"32px", background:"#fafaf8" }}>
                  <p style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#a53030", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:"24px", fontWeight:"600" }}>↓ Risks</p>
                  {result.risks.map((r,i) => (
                    <div key={i} style={{ display:"flex", gap:"14px", marginBottom:"18px" }}>
                      <span style={{ color:BH_RED, fontFamily:"'Cormorant Garamond',serif", fontSize:"20px", lineHeight:"1.3", flexShrink:0 }}>—</span>
                      <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#444", lineHeight:"1.7" }}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab==="dimensions" && (
              <div>
                {result.dimensions.map((d,i) => <DimRow key={i} dim={d} index={i}/>)}
                <div style={{ marginTop:"32px", display:"flex", justifyContent:"space-between", alignItems:"baseline", borderTop:`3px solid ${BH_RED}`, paddingTop:"24px" }}>
                  <span style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"11px", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:"600" }}>Weighted Composite Score</span>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"60px", fontWeight:"700", color:sc(result.overallScore), lineHeight:1 }}>{result.overallScore}</span>
                </div>
              </div>
            )}

            {tab==="rent" && result.rentAnalysis && (
              <div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"36px", fontWeight:"600", marginBottom:"8px", color:"#111" }}>Rent Economics</h3>
                <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#888", marginBottom:"32px", fontStyle:"italic" }}>F&B industry benchmark: rent should not exceed 8–10% of gross revenue.</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"28px" }}>
                  {[
                    ["Monthly Rent", result.rentAnalysis.monthlyRent, null],
                    ["Implied Annual", result.rentAnalysis.impliedAnnual, null],
                    ["Est. Rent PSF", result.rentAnalysis.estimatedPSF, null],
                    ["Revenue Needed at 8%", result.rentAnalysis.revenueNeededAt8pct, null],
                    ["Verdict", result.rentAnalysis.rentVerdict?.toUpperCase(), result.rentAnalysis.rentVerdict],
                    ["Concept Type", CATEGORY_LABELS[result.conceptCategory], null],
                  ].map(([label,val,verdict]) => (
                    <div key={label} style={{ border:"1px solid #e8e4de", padding:"24px", background:"#fafaf8" }}>
                      <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"10px", fontWeight:"600" }}>{label}</div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"26px", fontWeight:"600", color: verdict ? (verdict==="favorable"?"#2e7d52":verdict==="fair"?"#c8860a":"#a53030") : "#1a1a1a" }}>{val||"—"}</div>
                    </div>
                  ))}
                </div>
                {result.rentAnalysis.rentNote && (
                  <div style={{ border:`1px solid ${BH_RED}22`, padding:"24px", background:`${BH_RED}08`, borderLeft:`3px solid ${BH_RED}` }}>
                    <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"17px", color:"#555", lineHeight:"1.7", fontStyle:"italic" }}>{result.rentAnalysis.rentNote}</p>
                  </div>
                )}
              </div>
            )}

            {tab==="history" && (
              <div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"36px", fontWeight:"600", marginBottom:"8px", color:"#111" }}>Location History</h3>
                <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#888", marginBottom:"36px", fontStyle:"italic" }}>Prior tenants at this exact address — a key signal for space viability.</p>
                {result.locationHistory?.length > 0
                  ? result.locationHistory.map((h,i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"72px 1fr", gap:"24px", padding:"28px 0", borderBottom:"1px solid #eee" }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"52px", fontWeight:"700", color:"#eee", lineHeight:1 }}>0{i+1}</div>
                      <div>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"24px", fontWeight:"600", color:"#111", marginBottom:"4px" }}>{h.name}</div>
                        <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:BH_RED, textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"10px", fontWeight:"600" }}>{h.concept} · {h.tenure}</div>
                        <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#666", lineHeight:"1.7" }}>{h.closureNote}</p>
                      </div>
                    </div>
                  ))
                  : <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#aaa", fontStyle:"italic" }}>No prior tenant data found.</p>
                }
                {result.dimensions.find(d=>d.name==="Location History") && (
                  <div style={{ marginTop:"32px", padding:"24px", borderLeft:`3px solid ${BH_RED}`, background:"#fafaf8" }}>
                    <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#666", lineHeight:"1.7" }}>{result.dimensions.find(d=>d.name==="Location History").summary}</p>
                  </div>
                )}
              </div>
            )}

            {tab==="transit" && result.transitSnapshot && (
              <div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"36px", fontWeight:"600", marginBottom:"8px", color:"#111" }}>Transit & Accessibility</h3>
                <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#888", marginBottom:"32px", fontStyle:"italic" }}>Subway proximity weighted at {(result.dimensions.find(d=>d.name==="Transit & Accessibility")?.weight*100)||0}% for this concept type.</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"24px" }}>
                  {[
                    ["Nearest Station", result.transitSnapshot.nearestSubway],
                    ["Walk Time", result.transitSnapshot.walkMinutes ? `${result.transitSnapshot.walkMinutes} min` : "—"],
                    ["Lines Served", (result.transitSnapshot.linesServed||[]).join(" · ")],
                    ["Night Service", result.transitSnapshot.nightService],
                    ["Walk Score", result.transitSnapshot.walkScore],
                    ["Citibike Nearby", result.transitSnapshot.citibikeNearby],
                  ].map(([label,val]) => (
                    <div key={label} style={{ border:"1px solid #e8e4de", padding:"22px", background:"#fafaf8" }}>
                      <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"10px", fontWeight:"600" }}>{label}</div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"24px", fontWeight:"600", color:"#1a1a1a" }}>{val||"—"}</div>
                    </div>
                  ))}
                </div>
                {result.dimensions.find(d=>d.name==="Transit & Accessibility") && (
                  <div style={{ padding:"24px", borderLeft:`3px solid ${BH_RED}`, background:"#fafaf8" }}>
                    <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#666", lineHeight:"1.7" }}>{result.dimensions.find(d=>d.name==="Transit & Accessibility").summary}</p>
                  </div>
                )}
              </div>
            )}

            {tab==="market" && (
              <div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"36px", fontWeight:"600", marginBottom:"8px", color:"#111" }}>Competitive Comp Set</h3>
                <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#888", marginBottom:"36px", fontStyle:"italic" }}>Named competitors within 0.5 miles and their relevance to this concept.</p>
                {result.comparables.map((c,i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"72px 1fr auto", gap:"24px", padding:"24px 0", borderBottom:"1px solid #eee", alignItems:"start" }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"52px", fontWeight:"700", color:"#eee", lineHeight:1 }}>0{i+1}</div>
                    <div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"22px", fontWeight:"600", color:"#111", marginBottom:"3px" }}>{c.name}</div>
                      <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#aaa", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"8px", fontWeight:"500" }}>{c.type}{c.distance?` · ${c.distance}`:""}</div>
                      <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"15px", color:"#777", lineHeight:"1.65" }}>{c.note}</p>
                    </div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"22px", color:BH_RED, fontWeight:"600" }}>{c.pricePoint}</div>
                  </div>
                ))}
              </div>
            )}

            {tab==="census" && result.censusSnapshot && (
              <div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"36px", fontWeight:"600", marginBottom:"8px", color:"#111" }}>Census Snapshot</h3>
                <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"16px", color:"#888", marginBottom:"32px", fontStyle:"italic" }}>ZIP {address.match(/\d{5}/)?.[0]||""} — ACS 5-Year Estimates</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                  {Object.entries(result.censusSnapshot).map(([k,v]) => (
                    <div key={k} style={{ border:"1px solid #e8e4de", padding:"24px", background:"#fafaf8" }}>
                      <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"9px", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"10px", fontWeight:"600" }}>{k.replace(/([A-Z])/g," $1").trim()}</div>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"30px", fontWeight:"700", color:"#1a1a1a" }}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer CTA */}
          <div style={{ background:BH_RED, padding:"52px 48px", textAlign:"center" }}>
            <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"28px", fontWeight:"600", color:"#fff", marginBottom:"8px", letterSpacing:"-0.01em" }}>Need a deeper analysis?</p>
            <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"17px", fontStyle:"italic", color:"rgba(255,255,255,0.65)", marginBottom:"24px" }}>Back-House provides full location diligence for clients evaluating new spaces, expansions, and acquisitions.</p>
            <a href="https://www.back-house.us/contact-us" style={{ display:"inline-block", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize:"10px", letterSpacing:"0.22em", textTransform:"uppercase", color:"#fff", textDecoration:"none", border:"2px solid rgba(255,255,255,0.6)", padding:"12px 28px", fontWeight:"600" }}>Get in Touch →</a>
          </div>
        </div>
      )}
    </div>
  );
}
