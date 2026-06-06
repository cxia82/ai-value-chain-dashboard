/**
 * Replacement candidate pool for the weekly company refresh.
 *
 * When the scheduler detects that a company is no longer actively tradable
 * (e.g., 404 from market-data providers, delisted, acquired), it removes
 * that company and draws the next unused candidate from the sub-segment's
 * list below, in order.
 *
 * Rules:
 * - Every name here must be unique across the entire file.
 * - Candidates are checked against Yahoo/TradingView providers at refresh time;
 *   if a candidate itself has no quote it is skipped and the next one is tried.
 */

const pub = (name, ticker, exchange, notes) => ({
  rank: 0,
  name,
  isPublic: true,
  ticker,
  exchange,
  notes
});

const priv = (name, valuationUsdBn, valuationDate, notes) => ({
  rank: 0,
  name,
  isPublic: false,
  latestValuationUsdBn: valuationUsdBn,
  valuationDate,
  notes
});

export const replacementCandidates = {
  // ── Compute Infrastructure ─────────────────────────────────────────────────

  "training-accelerators-data-center": [
    priv("FuriosaAI", 0.9, "2026-03-01", "AI accelerator startup"),
    priv("Axelera AI", 0.7, "2026-02-01", "Edge and data center AI chips"),
    priv("SiMa.ai", 0.8, "2026-01-01", "Machine learning SoC"),
    priv("Untether AI", 0.6, "2025-11-01", "Energy-efficient inference chips"),
    priv("Blaize", 0.5, "2025-10-01", "AI compute platform company"),
    priv("Esperanto Technologies", 0.4, "2025-08-01", "RISC-V AI compute"),
    priv("NeuReality", 0.45, "2025-12-01", "Inference acceleration systems"),
    priv("MatX", 0.35, "2026-02-01", "AI accelerator hardware startup"),
    priv("Rain AI", 0.55, "2025-09-01", "Neuromorphic AI hardware"),
    priv("Rivos", 1.0, "2026-04-01", "Datacenter silicon startup")
  ],

  "inference-edge-ai-silicon": [
    pub("ACM Research", "ACMR", "NASDAQ", "Wafer cleaning and etch equipment"),
    pub("NAURA Technology", "002371.SZ", "SZSE", "Semiconductor process equipment"),
    pub("Ichor Holdings", "ICHR", "NASDAQ", "Fluid delivery subsystems"),
    pub("Cabot Microelectronics", "CCMP", "NASDAQ", "CMP slurries and polishing pads"),
    pub("Onto Innovation", "ONTO", "NYSE", "Process control and metrology"),
    pub("Amtech Systems", "ASYS", "NASDAQ", "Semiconductor thermal equipment"),
    priv("Cello Energy", 0.4, "2025-12-01", "Power delivery for semiconductor tools"),
    priv("Atotech", 1.5, "2026-01-01", "Specialty chemicals for advanced nodes"),
    priv("FSI International", 0.3, "2025-10-01", "Surface conditioning equipment"),
    priv("Axus Technology", 0.25, "2025-09-01", "CMP equipment supplier")
  ],

  "wafer-fabrication-equipment": [
    pub("DB HiTek", "000990.KS", "KRX", "Mixed-signal foundry"),
    priv("HHGrace", 2.0, "2026-03-01", "Specialty process foundry"),
    priv("Intel Foundry Services", 12.0, "2026-03-01", "Contract foundry operations"),
    priv("Sanan IC", 2.4, "2026-03-01", "Compound semiconductor foundry"),
    priv("SK keyfoundry", 1.3, "2025-12-01", "Specialty foundry services"),
    priv("TowerJazz Panasonic Semiconductor", 0.9, "2025-10-01", "Specialty process manufacturing"),
    priv("Nexchip Semiconductor", 2.3, "2025-12-01", "Display and specialty foundry"),
    priv("Magnachip Semiconductor", 1.0, "2025-12-01", "Power and display technologies"),
    priv("Silterra", 0.7, "2025-11-01", "Malaysia specialty foundry"),
    priv("Rapidus", 6.0, "2026-03-01", "Advanced logic foundry initiative")
  ],

  "dram-hbm-memory-makers": [
    pub("Everspin Technologies", "MRAM", "NASDAQ", "Persistent MRAM technology"),
    pub("ISSI", "ISSI", "NASDAQ", "Specialty memory products"),
    priv("ChangXin Memory Technologies", 8.0, "2026-03-01", "DRAM producer"),
    priv("Yangtze Memory Technologies", 7.0, "2026-01-01", "3D NAND manufacturer"),
    priv("GSI Technology", 0.5, "2026-03-01", "Specialty SRAM products"),
    priv("Longsys", 2.5, "2025-03-01", "Storage modules and NAND"),
    priv("ATP Electronics", 0.4, "2025-12-01", "Industrial memory manufacturer"),
    priv("Elite Semiconductor Memory Technology", 1.9, "2026-03-01", "Commodity and specialty DRAM"),
    priv("Powerchip Memory Solutions", 1.2, "2025-11-01", "DRAM manufacturing affiliate"),
    priv("Montage Technology Group", 3.3, "2026-03-01", "Memory interface chipsets")
  ],

  "networking-systems-platforms": [
    pub("Calix", "CALX", "NYSE", "Access and edge networking platforms"),
    pub("ADTRAN", "ADTN", "NASDAQ", "Telecom and network access systems"),
    pub("A10 Networks", "ATEN", "NYSE", "Application networking and security"),
    pub("NETSCOUT Systems", "NTCT", "NASDAQ", "Network performance management"),
    pub("Aviat Networks", "AVNW", "NASDAQ", "Wireless transport networking"),
    pub("Ribbon Communications", "RBBN", "NASDAQ", "Carrier network transformation"),
    pub("Sycamore Entertainment Group", "SYET", "OTC", "Network technology company"),
    priv("Arrcus", 0.6, "2025-12-01", "Cloud-native networking OS"),
    priv("Fungible", 0.9, "2025-11-01", "DPU-based data center networking"),
    priv("Pensando Systems", 1.0, "2025-10-01", "Distributed services platform")
  ],

  "datacenter-power-thermal": [
    pub("Bloom Energy", "BE", "NYSE", "Fuel-cell power systems for data centers"),
    pub("Cummins", "CMI", "NYSE", "Power generation equipment"),
    pub("Caterpillar", "CAT", "NYSE", "Backup generators and power systems"),
    pub("Mitsubishi Electric", "6503.T", "TSE", "Power and thermal systems"),
    pub("Fuji Electric", "6504.T", "TSE", "Industrial power electronics"),
    priv("Panduit", 3.2, "2026-03-01", "Data center power and cabling"),
    priv("Schweitzer Engineering Laboratories", 4.0, "2026-03-01", "Power protection systems"),
    priv("CoolIT Systems", 0.9, "2025-03-01", "Direct liquid cooling"),
    priv("LiquidStack", 1.0, "2025-06-01", "Immersion cooling systems"),
    priv("ZutaCore", 0.6, "2025-04-01", "Two-phase liquid cooling")
  ],

  // ── Cloud Platforms ─────────────────────────────────────────────────────────

  "global-hyperscale-ai-cloud": [
    pub("Infosys", "INFY", "NYSE", "Cloud services and AI consulting"),
    pub("Wipro", "WIT", "NYSE", "Hybrid cloud and AI services"),
    pub("HCL Technologies", "HCLTECH.NS", "NSE", "Cloud transformation services"),
    pub("Rackspace Technology", "RXT", "NASDAQ", "Managed hybrid cloud"),
    priv("Huawei Cloud", 25.0, "2026-03-01", "Global cloud and AI services"),
    priv("BytePlus Cloud", 3.5, "2026-03-01", "Cloud services arm of ByteDance"),
    priv("Kingsoft Cloud", 2.6, "2026-03-01", "China cloud infrastructure"),
    priv("NAVER Cloud", 6.0, "2026-03-01", "Korean hyperscale cloud"),
    priv("Yandex Cloud", 4.0, "2026-03-01", "Regional cloud platform"),
    priv("Salesforce Hyperforce", 15.0, "2026-03-01", "Enterprise cloud infrastructure")
  ],

  "gpu-neocloud-providers": [
    priv("Cudo Compute", 0.6, "2025-12-01", "GPU cloud compute platform"),
    priv("TensorDock", 0.35, "2025-10-01", "Cloud GPU hosting"),
    priv("Salad Technologies", 0.5, "2025-11-01", "Distributed GPU cloud"),
    priv("Hyperbolic", 0.3, "2025-10-01", "AI-focused GPU cloud provider"),
    priv("Shadeform", 0.25, "2025-09-01", "Multi-provider GPU cloud aggregator"),
    priv("JarvisLabs", 0.2, "2025-09-01", "On-demand GPU compute"),
    priv("Voltage Park", 0.8, "2026-01-01", "Large-scale AI GPU infrastructure"),
    priv("Prime Intellect", 0.35, "2025-10-01", "Decentralized GPU compute network"),
    priv("DataCrunch", 0.5, "2025-11-01", "European GPU cloud"),
    priv("Parasail", 0.4, "2025-10-01", "Distributed GPU cloud platform")
  ],

  "mlops-observability-governance": [
    pub("New Relic", "NR", "NYSE", "Observability and performance monitoring"),
    pub("Dynatrace", "DT", "NYSE", "AI-powered observability platform"),
    pub("Splunk", "SPLK", "NASDAQ", "Data platform and analytics"),
    pub("Informatica", "INFA", "NYSE", "Cloud data management"),
    priv("Arize AI", 1.4, "2026-03-01", "ML observability platform"),
    priv("WhyLabs", 0.5, "2025-12-01", "AI model monitoring"),
    priv("Comet ML", 0.6, "2025-11-01", "Experiment tracking and MLOps"),
    priv("Neptune.ai", 0.4, "2025-12-01", "ML metadata management"),
    priv("Evidently AI", 0.25, "2025-10-01", "Open-source ML monitoring"),
    priv("TruEra", 0.35, "2025-10-01", "AI quality and governance")
  ],

  // ── Foundation Models ───────────────────────────────────────────────────────

  "closed-frontier-model-labs": [
    priv("Safe Superintelligence", 5.0, "2026-03-01", "Frontier AI safety research company"),
    priv("DeepSeek", 4.0, "2026-03-01", "Frontier reasoning model company"),
    priv("Reflection AI", 1.2, "2026-01-01", "Advanced reasoning model startup"),
    priv("World Labs", 1.0, "2025-12-01", "Spatial intelligence model startup"),
    priv("Magic AI", 1.6, "2026-02-01", "Code-focused frontier models"),
    priv("Imbue", 1.1, "2025-12-01", "Agentic foundation model company"),
    priv("Runway", 3.0, "2026-03-01", "Generative video model company"),
    priv("Synthesia", 2.2, "2026-03-01", "Generative media platform"),
    priv("Harvey AI", 3.0, "2026-03-01", "Domain-specific frontier model company"),
    priv("G42", 18.0, "2026-03-01", "Sovereign-scale AI model developer")
  ],

  "model-serving-api-platforms": [
    priv("Clarifai", 1.3, "2026-03-01", "AI inference and API platform"),
    priv("Eden AI", 0.3, "2025-10-01", "Unified AI API aggregation platform"),
    priv("Fal", 0.6, "2025-12-01", "Fast model inference APIs"),
    priv("Banana Dev", 0.3, "2025-11-01", "Serverless model inference API"),
    priv("Cerebrium", 0.4, "2025-11-01", "Serverless AI model deployment"),
    priv("Modelbit", 0.6, "2025-12-01", "Production model deployment platform"),
    priv("Dify", 0.4, "2025-11-01", "LLM application serving platform"),
    priv("Flowise AI", 0.25, "2025-10-01", "Visual LLM workflow builder"),
    priv("Langfuse", 0.35, "2025-11-01", "LLM observability for agent apps"),
    priv("Superlinked", 0.2, "2025-09-01", "Retrieval and ranking toolkit")
  ],

  // ── Downstream Applications ─────────────────────────────────────────────────

  "ai-native-enterprise-apps": [
    // (already matched by this key)
    pub("Five9", "FIVN", "NASDAQ", "AI-powered contact center"),
    pub("Zendesk", "ZEN", "NYSE", "AI customer service platform"),
    pub("Verint", "VRNT", "NASDAQ", "Customer engagement AI"),
    pub("NICE Systems", "NICE", "NASDAQ", "AI-driven enterprise solutions"),
    priv("Intercom", 1.3, "2026-01-01", "AI customer support platform"),
    priv("Guru Technologies", 0.5, "2025-11-01", "AI knowledge management"),
    priv("Moveworks", 2.1, "2025-12-01", "Enterprise AI copilot"),
    priv("Samsara", 5.0, "2026-01-01", "Operations AI platform"),
    priv("Rippling", 13.5, "2026-01-01", "HR and IT AI automation"),
    priv("Gong", 7.25, "2025-11-01", "Revenue intelligence AI")
  ],

  "consumer-ai-assistants": [
    // (already matched by this key)
    pub("DuckDuckGo", "DUCK", "OTC", "Privacy-first AI search"),
    priv("Perplexity AI", 9.0, "2026-02-01", "AI answer engine"),
    priv("You.com", 1.0, "2024-12-01", "Personalized AI search"),
    priv("Phind", 0.3, "2024-08-01", "Developer AI search"),
    priv("Poe by Quora", 1.8, "2025-04-01", "Multi-model assistant hub"),
    priv("Replika", 0.3, "2025-03-01", "Companion AI products"),
    priv("Character Technologies", 5.0, "2025-08-01", "Consumer conversational models"),
    priv("Andi Search", 0.2, "2025-07-01", "Conversational AI search"),
    priv("Kagi Search", 0.15, "2025-06-01", "Premium AI-powered search"),
    priv("Arc Search", 0.4, "2025-09-01", "AI-native browser search")
  ],

  "autonomous-systems-robotics": [
    // (already matched by this key)
    pub("Joby Aviation", "JOBY", "NYSE", "Electric autonomous air taxi"),
    pub("Archer Aviation", "ACHR", "NYSE", "Urban air mobility platform"),
    pub("AgEagle Aerial Systems", "UAVS", "NYSE", "Commercial autonomous drones"),
    priv("Wayve", 1.05, "2025-10-01", "Embodied AI for autonomous vehicles"),
    priv("Gatik AI", 0.8, "2025-08-01", "Autonomous middle-mile trucking"),
    priv("Outrider", 0.7, "2025-07-01", "Autonomous yard operations"),
    priv("Relativity Space", 8.0, "2025-10-01", "AI-driven aerospace manufacturing"),
    priv("Sanctuary AI", 1.0, "2025-09-01", "General-purpose humanoid robots"),
    priv("Bright Machines", 0.8, "2025-08-01", "AI-first intelligent manufacturing"),
    priv("Plus AI", 1.2, "2025-11-01", "Autonomous trucking platform")
  ],

  "edge-ai-devices-oem": [
    // (already matched by this key)
    pub("Zebra Technologies", "ZBRA", "NASDAQ", "Edge AI scanning and IoT devices"),
    pub("Cognex", "CGNX", "NASDAQ", "Machine vision systems"),
    pub("Teledyne Technologies", "TDY", "NYSE", "Edge imaging and sensing"),
    pub("Himax Technologies", "HIMX", "NASDAQ", "Display and image sensing"),
    priv("Ouster", 0.8, "2025-12-01", "LiDAR for edge AI perception"),
    priv("Aeva Technologies", 0.5, "2025-10-01", "4D LiDAR platform"),
    priv("Samsara Networks", 0.7, "2025-11-01", "IoT edge connectivity"),
    priv("Edge Impulse", 0.4, "2025-10-01", "Embedded ML development platform"),
    priv("Hailo", 1.2, "2025-03-01", "Edge AI processors"),
    priv("GreenWaves Technologies", 0.25, "2025-10-01", "Ultra-low-power AI processors")
  ],

  "eda-test-yield-software": [
    pub("Keysight Technologies", "KEYS", "NYSE", "Electronic test and EDA software"),
    pub("National Instruments", "NATI", "NASDAQ", "Test and measurement systems"),
    pub("Cohu", "COHU", "NASDAQ", "Semiconductor test handlers"),
    pub("Photronics", "PLAB", "NASDAQ", "Photomask supplier"),
    priv("PDF Solutions", 1.6, "2026-03-01", "Yield analytics and process control"),
    priv("Empyrean Technology", 2.5, "2026-03-01", "China-based EDA vendor"),
    priv("Silvaco Group", 0.8, "2025-12-01", "Device simulation EDA tools"),
    priv("Aldec", 0.35, "2025-11-01", "FPGA simulation tools"),
    priv("OneSpin Solutions", 0.4, "2025-11-01", "Formal verification software"),
    priv("Cliosoft", 0.3, "2025-10-01", "Design data management software")
  ],

  "logic-specialty-foundries": [
    pub("Hua Hong Semiconductor", "1347.HK", "HKEX", "China specialty foundry"),
    pub("Vanguard International Semiconductor", "5347.TWO", "TWO", "Specialty wafer foundry"),
    pub("X-FAB", "XFAB.PA", "Euronext", "Analog and automotive foundry"),
    priv("DB HiTek", 2.2, "2026-03-01", "Mixed-signal foundry"),
    priv("Powerchip Semiconductor Manufacturing", 4.5, "2026-03-01", "Specialty memory foundry"),
    priv("HHGrace", 2.0, "2026-03-01", "Specialty process foundry"),
    priv("Sanan IC", 2.4, "2026-03-01", "Compound semiconductor foundry"),
    priv("SK keyfoundry", 1.3, "2025-12-01", "Specialty foundry services"),
    priv("Magnachip Semiconductor", 1.0, "2025-12-01", "Power process technologies"),
    priv("Rapidus", 6.0, "2026-03-01", "Advanced logic foundry initiative")
  ],

  "advanced-packaging-wafer-materials": [
    pub("JCET Group", "600584.SS", "SSE", "Advanced packaging and OSAT"),
    pub("Tongfu Microelectronics", "002156.SZ", "SZSE", "OSAT and advanced packaging"),
    pub("King Yuan Electronics", "2449.TW", "TWSE", "IC testing and packaging"),
    pub("ChipMOS Technologies", "8150.TW", "TWSE", "Semiconductor backend services"),
    priv("Unimicron", 8.5, "2026-03-01", "ABF substrate and PCB supplier"),
    priv("Ibiden", 5.8, "2026-03-01", "Advanced packaging substrate provider"),
    priv("Shinko Electric Industries", 4.6, "2026-03-01", "IC package substrates"),
    priv("Powertech Technology", 3.1, "2026-03-01", "Memory packaging and testing"),
    priv("Siliconware Precision Industries", 7.4, "2026-03-01", "OSAT and module integration"),
    priv("Nan Ya PCB", 2.6, "2026-03-01", "High-end IC substrate manufacturing")
  ],

  "nvm-storage-controllers": [
    pub("Pure Storage", "PSTG", "NYSE", "All-flash storage platforms"),
    pub("NetApp", "NTAP", "NASDAQ", "Enterprise storage systems"),
    pub("Phison Electronics", "8299.TW", "TWSE", "SSD controller provider"),
    pub("Silicon Motion", "SIMO", "NASDAQ", "NAND flash controllers"),
    priv("Solidigm", 6.0, "2026-03-01", "Enterprise SSD manufacturer"),
    priv("QNAP Systems", 1.1, "2025-12-01", "NAS and storage appliances"),
    priv("Synology", 2.5, "2025-12-01", "NAS and storage software"),
    priv("Innodisk", 1.8, "2026-03-01", "Industrial SSD and memory modules"),
    priv("Adata", 2.0, "2026-03-01", "SSD and memory products"),
    priv("Phison Memory Solutions", 0.9, "2026-01-01", "Custom SSD solutions")
  ],

  "optical-interconnect-components": [
    pub("Coherent", "COHR", "NYSE", "Laser and optical components"),
    pub("Lumentum", "LITE", "NASDAQ", "Optical communication components"),
    pub("Fabrinet", "FN", "NYSE", "Optoelectronic manufacturing"),
    pub("Viavi Solutions", "VIAV", "NASDAQ", "Optical test and network components"),
    priv("Innolight", 6.1, "2026-03-01", "High-speed optical transceivers"),
    priv("Source Photonics", 1.4, "2025-11-01", "Optical transceiver supplier"),
    priv("Eoptolink", 7.5, "2026-03-01", "Optical networking components"),
    priv("Accelink Technologies", 4.9, "2026-03-01", "Optical fiber communication"),
    priv("O-Net Technologies", 2.8, "2026-03-01", "Optical communication components"),
    priv("Ayar Labs", 1.2, "2025-12-01", "Optical I/O interconnect startup")
  ],

  "ai-server-oems-integrators": [
    pub("Lenovo Group", "0992.HK", "HKEX", "AI PC and server deployment"),
    pub("Dell Technologies", "DELL", "NYSE", "AI server and infrastructure"),
    pub("Hewlett Packard Enterprise", "HPE", "NYSE", "Enterprise AI servers"),
    pub("Super Micro Computer", "SMCI", "NASDAQ", "AI server systems"),
    priv("Quanta Computer", 35.0, "2026-03-01", "Cloud and AI server OEM"),
    priv("Wistron", 14.0, "2026-03-01", "Server manufacturing and integration"),
    priv("Inventec", 16.0, "2026-03-01", "Data center server OEM"),
    priv("Wiwynn", 8.0, "2026-03-01", "Hyperscale server platform builder"),
    priv("Inspur", 14.0, "2026-03-01", "AI server systems and integration"),
    priv("Gigabyte Technology", 10.0, "2026-03-01", "Server hardware and AI systems")
  ],

  "sovereign-regional-ai-cloud": [
    pub("OVHcloud", "OVH.PA", "Euronext", "European sovereign cloud provider"),
    priv("Scaleway", 1.2, "2026-03-01", "European cloud services"),
    priv("StackIT", 1.0, "2026-03-01", "German sovereign cloud"),
    priv("Aruba Cloud", 1.5, "2026-03-01", "Italian cloud infrastructure"),
    priv("T-Systems", 7.0, "2026-03-01", "European enterprise cloud services"),
    priv("Orange Business Cloud", 6.0, "2026-03-01", "Regional cloud and IT services"),
    priv("KT Cloud", 3.0, "2026-03-01", "Korean cloud platform"),
    priv("NTT Communications Cloud", 8.0, "2026-03-01", "Regional data center and cloud"),
    priv("Telstra Purple", 1.0, "2026-03-01", "Australian cloud integration"),
    priv("e& enterprise", 1.4, "2026-03-01", "Middle East sovereign cloud services")
  ],

  "developer-edge-managed-cloud": [
    pub("Fastly", "FSLY", "NYSE", "Edge cloud services"),
    pub("Cloudflare", "NET", "NYSE", "Edge compute and hosting"),
    pub("DigitalOcean", "DOCN", "NYSE", "Developer cloud platform"),
    pub("Akamai Technologies", "AKAM", "NASDAQ", "Edge and CDN cloud"),
    priv("Fly.io", 1.2, "2026-03-01", "Edge app deployment platform"),
    priv("Render", 1.5, "2026-03-01", "Managed cloud developer platform"),
    priv("Vercel", 4.5, "2026-03-01", "Frontend and edge deployment cloud"),
    priv("Netlify", 2.0, "2026-03-01", "Web app deployment platform"),
    priv("Railway", 0.8, "2026-03-01", "Developer cloud deployment platform"),
    priv("Heroku", 3.0, "2026-03-01", "Managed developer PaaS")
  ],

  "data-platforms-analytics-ai": [
    pub("Snowflake", "SNOW", "NYSE", "Data cloud and AI workloads"),
    pub("Elastic", "ESTC", "NYSE", "Search and vector retrieval platform"),
    pub("Confluent", "CFLT", "NASDAQ", "Streaming data platform"),
    pub("C3.ai", "AI", "NYSE", "Enterprise AI software platform"),
    priv("Databricks", 62.0, "2025-09-01", "Lakehouse and AI platform"),
    priv("Palantir AIP", 160.0, "2026-03-01", "Enterprise data operating systems"),
    priv("ThoughtSpot", 4.2, "2026-03-01", "AI analytics platform"),
    priv("Qlik Technologies", 8.0, "2026-03-01", "Data integration and analytics"),
    priv("Informatica Cloud", 11.0, "2026-03-01", "Cloud data management platform"),
    priv("Starburst Data", 3.5, "2026-03-01", "Data lakehouse query platform")
  ],

  "open-sovereign-frontier-labs": [
    pub("Baidu", "BIDU", "NASDAQ", "Chinese AI model and platform provider"),
    priv("Kyutai", 1.4, "2026-03-01", "Open and sovereign model research lab"),
    priv("Poolside", 2.0, "2026-03-01", "Code generation model company"),
    priv("H Company", 1.0, "2026-01-01", "European foundation model startup"),
    priv("SenseTime", 9.0, "2026-03-01", "Large-scale AI model platform"),
    priv("iFLYTEK AI", 18.0, "2026-03-01", "Language AI and model platform"),
    priv("4Paradigm", 3.8, "2026-03-01", "Enterprise AI platform and models"),
    priv("BenevolentAI", 1.6, "2026-03-01", "AI-first research company"),
    priv("Aleph Alpha", 1.2, "2026-03-01", "European sovereign AI lab"),
    priv("LightOn", 0.6, "2025-11-01", "European generative AI company")
  ],

  "agent-rag-developer-tooling": [
    priv("LangChain Inc", 0.2, "2025-03-01", "Application orchestration framework"),
    priv("LlamaIndex", 0.9, "2026-03-01", "RAG application framework"),
    priv("Pinecone", 1.9, "2026-03-01", "Vector database and retrieval platform"),
    priv("Weaviate", 1.1, "2026-03-01", "Vector search database company"),
    priv("Zilliz", 1.4, "2026-03-01", "Milvus vector database company"),
    priv("Chroma", 0.35, "2025-11-01", "Vector database for AI applications"),
    priv("deepset AI", 0.45, "2025-12-01", "RAG and search platform"),
    priv("Glean Technologies", 4.0, "2026-03-01", "Enterprise search and agent platform"),
    priv("Flowise AI", 0.25, "2025-10-01", "Visual LLM workflow builder"),
    priv("Langfuse", 0.35, "2025-11-01", "LLM observability for agent apps")
  ]
};
