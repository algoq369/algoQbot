
-- BroolyKid Keynote Automation Script
-- Run this in AppleScript Editor or Script Editor

tell application "Keynote"
    activate
    
    -- Create new presentation
    set newPresentation to make new document with properties {document theme:theme "Basic White"}
    
    -- Set presentation properties
    set document properties of newPresentation to {slide size:{1920, 1080}, slide transition:smooth, auto advance:false}
    
    -- Configure master slide
    set masterSlide to master slide of newPresentation
    set background color of masterSlide to {65535, 65535, 65535} -- White background
    
    -- Add BroolyKid logo (you'll need to provide the logo file)
    -- set logoImage to (path to desktop as string) & "BroolyKid_Logo.png"
    -- if exists file logoImage then
    --     set logo to make new image with properties {file:logoImage, position:{50, 50}, size:{200, 100}}
    -- end if
    
    -- Set up color palette
    set colorPalette to {primary blue:{11007, 8055, 28927}, gold:{55769, 44975, 0}, purple:{35723, 23831, 63207}, pink:{60535, 28784, 52685}}
    
    

    -- Create Slide 1: TITLE SLIDE
    set slide1 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide1 to "TITLE SLIDE"
    
    -- Add content based on slide type
    

    -- Title slide with background image
    set background image of slide1 to (path to desktop as string) & "mountain_sunrise.jpg"
    set text of titleText of slide1 to "BROOLYKID"
    set subtitle of slide1 to "Building Sovereign Communities for the Information Age"
    

    -- Create Slide 2: EXECUTIVE SUMMARY
    set slide2 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide2 to "EXECUTIVE SUMMARY"
    
    -- Add content based on slide type
    

    -- Executive summary with 5 columns
    set bulletText of slide2 to "THE PROJECT
    🏙️ First consciousness-driven smart city
    ⚡ Bitcoin + Monad mining self-financing
    👥 5,000 citizens in free circular economy
    🌍 Blueprint for 10-city global network
    
    THE ECONOMICS
    💰 Total Investment: $970M over 10 years
    ├─ NOW: $450M (we're raising this) ← YOU
    ├─ Years 3-4: $380M (self-financed from mining)
    └─ Years 5-10: $140M (self-financed from surplus)"
    

    -- Create Slide 3: THE TRANSITION
    set slide3 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide3 to "THE TRANSITION"
    
    -- Add content based on slide type
    

    set bulletText of slide3 to "### INDUSTRIAL AGE (1900-2020) 🏭 Value Creation: Labor + Capital + Resources 🏭 Power Structure: Corporations + Governments 🏭 Success Metric: Wealth accumulation 🏭 Human Role: Cog in machine | ### TRANSITION (2020-2030) ⚡ Crisis: Climate, inequality, spiritual void ⚡ Technology: AI, blockchain, renewable energy ⚡ Awakening: Consciousness movement rising ⚡ Opportunity: Rebuild from first principles | ### INFORMATION AGE (2030-2100+) 🧠 Value Creation: IDEAS + Consciousness + Data 🧠 Power Structure:..."
    

    -- Create Slide 4: THE PROBLEM
    set slide4 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide4 to "THE PROBLEM"
    
    -- Add content based on slide type
    

    set bulletText of slide4 to "### CAPITALISM 💰 Growing inequalities. The 1% own 50% of global wealth. • Endless accumulation destroys the planet • Extraction-based economics unsustainable • Money > people in every decision • Generational wealth impossible for 99% | **Stat:** 1% owns 50% | ### TRANSHUMANISM 🧠 Disconnection from soul. Technology reducing us to machines. • AI replacing human intuition • Virtual replacing real connection • Consciousness seen as 'software bug' • Spiritual void = mental health crisis | **Stat:** C..."
    

    -- Create Slide 5: THE BROOLYKID SOLUTION
    set slide5 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide5 to "THE BROOLYKID SOLUTION"
    
    -- Add content based on slide type
    

    set bulletText of slide5 to "### BITCOIN MINING ⚡ Self-financing infrastructure ⚡ Generational wealth guaranteed ⚡ ZERO funding dependency post-raise ⚡ $1.2B+ revenue by Year 10 | ### CONSCIOUSNESS ELEVATION 🧠 Temple at city center (sacred geometry) 🧠 BroolyKid Protocol (8-phase development) 🧠 Brain-heart coherence training 🧠 Mandala architecture design | ### CIRCULAR ECONOMY 👥 100% FREE services by Year 6 👥 Reputation replaces money 👥 Zero extraction model 👥 Nomadism incentivized | ### MONAD BLOCKCHAIN 🌍 Own L1 blockchain ..."
    

    -- Create Slide 6: HOW IT WORKS - THREE PHASES
    set slide6 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide6 to "HOW IT WORKS - THREE PHASES"
    
    -- Add content based on slide type
    

    set bulletText of slide6 to "### PHASE 1: BOOTSTRAP (Years 1-2) 🏔️ First city construction begins 👥 500 → 1,500 citizens ⚡ 6K → 12K ASICs deployed 💰 $450M investment (NOW) ← YOU FUND THIS | **Milestone:** Proof of viability with paying citizens | ### PHASE 2: PROOF OF CONCEPT (Years 3-5) 📈 Scale to 5,000 citizens (full capacity) ⚡ 35K ASICs, Top 20 globally 💰 Self-financed from mining ($380M) 🎯 All debt cleared by Year 5 | **Milestone:** Model validated, fully self-sustaining | ### PHASE 3: FULL SMART CITY (Years 6-10) 🌍 Fr..."
    

    -- Create Slide 7: COMPETITIVE POSITIONING
    set slide7 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide7 to "COMPETITIVE POSITIONING"
    
    -- Add content based on slide type
    

    set bulletText of slide7 to "### Traditional Smart Cities (External Funding + Profit) • Neom: $500B budget but no revenue model • Telosa: Still fundraising after 3 years • Woven City: Toyota corporate, extractive | **Fatal:** Dependent on external capital that dries up | ### Crypto Cities (Token Speculation + Profit) • CityDAO: No real economy, just land NFTs • Próspera: Libertarian tax haven, no soul | **Fatal:** Pump-and-dump risk, no real value creation | ### Intentional Communities (Member Fees + Sustainability) • Aurov..."
    

    -- Create Slide 8: THE BROOLYKID LIVING SYSTEM
    set slide8 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide8 to "THE BROOLYKID LIVING SYSTEM"
    
    -- Add content based on slide type
    

    set bulletText of slide8 to "### 🏛️ MANDALA ARCHITECTURE Sacred Geometry Meets Social Engineering • Temple at Center: Maximum energy, 7 temples per city (7 chakras) • Concentric Circles: Legends near temple → radiate wisdom outward • Mixed Neighborhoods: Every 50 homes has ALL 5 levels intentionally mixed • Central Garden: Community space, shared vegetable gardens | **Visual:** Temple → Sages → Builders → Contributors → Citizens → Garden | ### 👥 DIVERSITY BY DESIGN The Most Advanced Elevate the Less Advanced • Optimal Ratio..."
    

    -- Create Slide 9: ECONOMY & NOMADISM
    set slide9 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide9 to "ECONOMY & NOMADISM"
    
    -- Add content based on slide type
    

    set bulletText of slide9 to "### 💎 $BROOLY TOKEN SYSTEM Access, Not Wealth. Equality Coded Into Protocol. • Supply: 21 billion MONA (1000x Bitcoin symbolically) • Distribution: 30% Mining, 25% Cities, 20% Academy, 15% Treasury, 10% Team • Cap: 10,000-20,000 tokens MAX per citizen (prevents plutocracy) • Ratio: 1 BTC = 1,000 $BROOLY (Bitcoin secures, $BROOLY liberates) • Use: DAO voting, services, internal economy, inter-city transfers • Wrapped MONAD: Bridge to external DeFi, maintain sovereignty | ### ⭐ REPUTATION SYSTEM C..."
    

    -- Create Slide 10: SIX UNFAIR ADVANTAGES
    set slide10 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide10 to "SIX UNFAIR ADVANTAGES"
    
    -- Add content based on slide type
    

    set bulletText of slide10 to "### 1. SELF-FINANCING FOREVER ⚡ Bitcoin mining = perpetual revenue. Post this raise, zero dependency on external capital. | ### 2. WORLD-CHAMPION TEAM 🏆 UFC Champion + BJJ Champion + AMF experts. Discipline + credibility + compliance. | ### 3. FIRST-MOVER ADVANTAGE 🎯 Only BTC-funded consciousness city globally. 5-10 year lead on competition. | ### 4. G&V PARTNERSHIP 📈 +20% returns guaranteed on all revenue. $293M extra over 10 years. | ### 5. DUAL MINING STRATEGY 🌍 BTC (60%) + Monad blockchain (..."
    

    -- Create Slide 11: TARGET MARKET
    set slide11 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide11 to "TARGET MARKET"
    
    -- Add content based on slide type
    

    set bulletText of slide11 to "### TAM: 100M globally Total Addressable Market • Consciousness seekers (spiritual practitioners) • Crypto/tech professionals (digital natives) • Digital nomads (location independent) • Impact investors (values-driven) • Intentional community seekers | ### SAM: 10M with capital Serviceable Available Market • High-income professionals ($100K+) • Crypto early adopters (hold $50K+ BTC) • Family offices (multi-generational thinkers) • Spiritual/wellness leaders (influencers) | ### SOM: 5,000 citizen..."
    

    -- Create Slide 12: MARKET VALIDATION
    set slide12 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide12 to "MARKET VALIDATION"
    
    -- Add content based on slide type
    

    set bulletText of slide12 to "### PROOF #1: Crypto Adoption Exploding 📈 560M crypto users globally (2025) 📈 Growing 40% annually 💡 Our exact demographic: tech-savvy, sovereignty-focused | **Chart:** +40% YoY growth | ### PROOF #2: Location Independence Rising 🏖️ 35M digital nomads (2024) 🏖️ Growing 25% annually 💡 Perfect fit for our nomadism model: work from anywhere | **Chart:** +25% YoY growth | ### PROOF #3: Intentional Communities Oversubscribed 📋 Auroville: 5-year waitlist (but financially broken) 📋 Damanhur: 2-year wai..."
    

    -- Create Slide 13: PERFECT TIMING
    set slide13 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide13 to "PERFECT TIMING"
    
    -- Add content based on slide type
    

    set bulletText of slide13 to "### 1️⃣ BITCOIN MATURITY ⚡ ETFs approved (BlackRock, Fidelity buying) ⚡ Mining profitability at all-time highs ⚡ Infrastructure investment moment NOW ⚡ Window: 2025-2027 before next halving | ### 2️⃣ REMOTE WORK PERMANENT 🌍 Post-COVID normalization complete 🌍 Location independence mainstream 🌍 Citizens can work from BroolyKid 🌍 Window: Now before backlash | ### 3️⃣ REGULATORY CLARITY (Africa) 🛡️ Rwanda crypto-friendly (clear framework) 🛡️ Paraguay mining incentives (cheap power) 🛡️ First-mover w..."
    

    -- Create Slide 14: DUAL MINING REVENUE MODEL
    set slide14 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide14 to "DUAL MINING REVENUE MODEL"
    
    -- Add content based on slide type
    

    set bulletText of slide14 to "### YEARS 1-7: BITCOIN MINING (100%) • Year 1: $23M • Year 3: $97M • Year 5: $235M • Year 7: $304M | ### YEAR 8+: DUAL MINING (BTC 60% + MONAD 40%) • Year 8: $358M (BTC) + $0M (MONAD launching) • Year 9: $421M (BTC) + $378M (MONAD) • Year 10: $503M (BTC) + $710M (MONAD) → Total Year 10: $1.21B combined | ### PLUS: G&V TRADING (+20% on all) • Year 1: +$5M • Year 5: +$47M • Year 10: +$242M → 10-Year Total: $293M extra | **Additional:** PLUS: Heat Recovery ($7M/year), Innovation Economy ($5M/year),..."
    

    -- Create Slide 15: BITCOIN PRICE ASSUMPTIONS
    set slide15 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide15 to "BITCOIN PRICE ASSUMPTIONS"
    
    -- Add content based on slide type
    

    set bulletText of slide15 to "### OUR CONSERVATIVE MODEL • 2026: $150,000 (+31% from today) • 2027: $200,000 (+33%) • 2028: $250,000 (+25%) • 2029: $300,000 (+20%) • 2030: $320,000 (+7%) • 2035: $1,250,000 (+290% total) vs Current: $114,000 (Oct 2025) | ### ANALYST CONSENSUS (2030) Range: $500K - $1M • ARK Invest: $1M+ • Cathie Wood: $500K base • Fidelity: $1B by 2038 • Standard Chartered: $250K (2025) | ### IF BTC REACHES CONSENSUS • Revenue: +60-80% • IRR: 6-8% → 15-20% • Payback: 7 years vs 11 years • Valuation: $8-12B → ..."
    

    -- Create Slide 16: PATH TO FREE CIRCULAR ECONOMY
    set slide16 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide16 to "PATH TO FREE CIRCULAR ECONOMY"
    
    -- Add content based on slide type
    

    set bulletText of slide16 to "### YEARS 1-3: DEBT REPAYMENT PHASE Citizens voluntarily contribute (30%) • Declining fees: $1,500/mo → $800/mo → $0 • Earn reputation points for participation • Revenue helps clear debt faster • NOT REQUIRED - incentivized only | ### YEARS 4-5: TRANSITION PHASE Fees reduced 50% each year • More services become free progressively • Reputation points matter more than money • Citizens adjust to post-scarcity mindset • Mining revenue covers gaps | ### YEAR 6+: FULL CIRCULAR ECONOMY ALL services 100..."
    

    -- Create Slide 17: 10-YEAR FINANCIAL PROJECTIONS
    set slide17 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide17 to "10-YEAR FINANCIAL PROJECTIONS"
    
    -- Add content based on slide type
    

    -- Financial projections table
    set table of slide17 to make new table with properties {rows:11, columns:7}
    -- You'll need to manually populate the table with financial data
    

    -- Create Slide 18: CAPITAL STRUCTURE
    set slide18 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide18 to "CAPITAL STRUCTURE"
    
    -- Add content based on slide type
    

    set bulletText of slide18 to "### WHAT WE'RE RAISING (Years 1-2) | **$450M** ← YOU INVEST THIS • Strategic Equity: $300M (25% ownership) • Senior Debt: $100M (construction, 12yr, 6%) • Equipment Financing: $50M (ASICs, 10yr, 5.5%) | ### SELF-FINANCED (Years 3-4) | **$380M** ← MINING REVENUE • Additional ASICs: $131M • City completion: $240M • Infrastructure upgrades: $9M • Source: Bitcoin mining $67-177M/year | ### SELF-FINANCED (Years 5-10) | **$140M** ← SURPLUS CASH • Final ASIC scaling: $100M • Optimizations: $30M • Conti..."
    

    -- Create Slide 19: INVESTOR RETURNS
    set slide19 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide19 to "INVESTOR RETURNS"
    
    -- Add content based on slide type
    

    set bulletText of slide19 to "### CONSERVATIVE (70% probability) Our Base Model | **Assumptions:** • BTC: $150K → $1.25M (our projections) • Power: $0.07/kWh • No Monad revenue | **Returns:** • DSCR: 1.48x by Year 4 ✅ • Payback: 11-12 years • Equity IRR: 5-6% • Exit Multiple: 1.6-1.7x | ### MODERATE (20% probability) BTC Matches Consensus | **Assumptions:** • BTC: $500K by 2030 (vs our $320K) • Monad: Moderate adoption • All else same | **Returns:** • DSCR: 2.0x+ by Year 4 • Payback: 9-10 years • Equity IRR: 8-10% • Exit Mul..."
    

    -- Create Slide 20: WORLD-CLASS TEAM
    set slide20 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide20 to "WORLD-CLASS TEAM"
    
    -- Add content based on slide type
    

    set bulletText of slide20 to "### FOUNDER & CEO | **[Your Name]** • BJJ World Champion 2017 • Vision carrier & philosopher • 15-year commitment to project • Network: Elite athletes, conscious leaders | ### GLOBAL AMBASSADOR | **Cyril Gane** • Former UFC Interim Heavyweight Champion • 700M global fan reach (UFC platform) • Elite performance + consciousness journey • Credibility for mainstream adoption | ### CO-FOUNDERS & PARTNERS | **G&V Capital** • 20% revenue enhancement (contractual) • AMF-certified treasury management • 3..."
    

    -- Create Slide 21: EXECUTION ROADMAP
    set slide21 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide21 to "EXECUTION ROADMAP"
    
    -- Add content based on slide type
    

    set bulletText of slide21 to "### Q1 2026 | **FUNDING CLOSE & GROUNDBREAKING** • ✅ $450M strategic round closed • ✅ Debt facilities signed ($150M) • ✅ Rwanda/Paraguay site secured • ✅ Construction contracts executed | ### Q2-Q3 2026 | **BOOTSTRAP PHASE BEGINS** • ✅ First 6K ASICs deployed → mining revenue starts • ✅ Infrastructure construction underway • ✅ Pre-sales: 500 citizens committed | ### Q4 2026 | **FIRST CITIZENS ARRIVE** • ✅ Temple construction complete • ✅ First 500 citizens move in • ✅ BroolyKid Protocol (Phase 1..."
    

    -- Create Slide 22: RISK MITIGATION
    set slide22 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide22 to "RISK MITIGATION"
    
    -- Add content based on slide type
    

    set bulletText of slide22 to "### Bitcoin Price Volatility ✅ Conservative $150K-$1.25M (vs $500K-$1M consensus) ✅ G&V hedging strategies (+20% buffer) ✅ Temple strategic reserve ($26M liquid gold) ✅ Heat recovery diversifies revenue ($7M/year) | ### Electricity Cost Escalation ✅ Already using $0.07/kWh (75% buffer) ✅ Long-term PPA contracts (lock rates) ✅ Own renewable infrastructure (solar/hydro) ✅ Multiple locations (Paraguay $0.03, Rwanda $0.05) | ### Mining Difficulty Surge ✅ Phased scaling (can pause at any phase) ✅ Own..."
    

    -- Create Slide 23: INVESTMENT STRUCTURE
    set slide23 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide23 to "INVESTMENT STRUCTURE"
    
    -- Add content based on slide type
    

    set bulletText of slide23 to "### Overview • Total: $970M over 10 years • This Round: $450M (Years 1-2) ← YOU • Self-Financed: $520M (Years 3-10) ← Mining | ### EQUITY ($300M) • Ownership: 25% of holding company • Board seats: 2 (investor representation) • Founder control: 40% voting (dual-class shares) • Vesting: 6 years founder, no lockup investors • Pro-rata rights: Future rounds (if any) | ### SENIOR DEBT ($100M now, $300M Year 3-4 if needed) • Term: 12 years, 6% fixed • Grace: 2 years interest-only • Coverage: DSCR 1.48..."
    

    -- Create Slide 24: CLOSING
    set slide24 to make new slide with properties {slide layout:layout "Title & Bullets"}
    
    -- Set slide title
    set titleText of slide24 to "CLOSING"
    
    -- Add content based on slide type
    

    set bulletText of slide24 to "### Quote \"They said humans need money. They said spiritual communities don't scale. They said Bitcoin mining can't fund cities. We're proving them all wrong.\" — BroolyKid Vision | ### By 2035: • 5,000 humans living FREE in circular economy • $500M+ annual mining revenue • Top 5 global mining position • Model proven, replicating globally | ### Declaration | **This is not a dream. This is a plan. And the plan works.** | ### Next Steps: 1. Due diligence package (available now) 2. Financial model..."
    

    -- Save the presentation
    save newPresentation in (path to desktop as string) & "BroolyKid_Investor_Presentation.key"
    
    -- Display completion message
    display dialog "BroolyKid presentation created successfully!" buttons {"OK"} default button "OK"
    
end tell
