import type { TopicNode } from "./types";

export const TOPIC_CATALOG_VERSION = 3;

type TopicSeed = string | { label: string; children: TopicSeed[] };

const branch = (label: string, children: TopicSeed[]): TopicSeed => ({ label, children });

const LITERATURE_SEED: TopicSeed = branch("Literature", [
  branch("Books", [
    branch("By time period", [
      branch("Ancient", ["The Epic of Gilgamesh", "The Iliad", "The Odyssey", "The Art of War"]),
      branch("Medieval", ["The Canterbury Tales", "The Divine Comedy", "Le Morte d'Arthur", "The Tale of Genji"]),
      branch("Renaissance", ["Don Quixote", "The Prince", "Utopia", "The Decameron"]),
      branch("Eighteenth century", ["Gulliver's Travels", "Candide", "Pamela", "The Sorrows of Young Werther"]),
      branch("Nineteenth century", ["Pride and Prejudice", "Jane Eyre", "Moby-Dick", "Middlemarch"]),
      branch("Modern", ["Mrs Dalloway", "The Great Gatsby", "One Hundred Years of Solitude", "Beloved"])
    ]),
    branch("By genre", [
      branch("Fantasy", ["The Lord of the Rings", "The Hobbit", "A Wizard of Earthsea", "The Chronicles of Narnia"]),
      branch("Science fiction", ["Frankenstein", "The Time Machine", "Dune", "The Left Hand of Darkness"]),
      branch("Mystery", ["The Murder of Roger Ackroyd", "The Big Sleep", "The Hound of the Baskervilles", "And Then There Were None"]),
      branch("Historical fiction", ["War and Peace", "The Name of the Rose", "Wolf Hall", "Things Fall Apart"]),
      branch("Literary fiction", ["Anna Karenina", "To the Lighthouse", "The Sound and the Fury", "The Remains of the Day"])
    ]),
    branch("By historical context", [
      branch("Slavery and abolition", ["Uncle Tom's Cabin", "Narrative of the Life of Frederick Douglass", "The Interesting Narrative of the Life of Olaudah Equiano", "Beloved"]),
      branch("Industrialization", ["Hard Times", "North and South", "The Jungle", "Sister Carrie"]),
      branch("Colonialism", ["Heart of Darkness", "A Passage to India", "Wide Sargasso Sea", "Things Fall Apart"]),
      branch("The world wars", ["All Quiet on the Western Front", "A Farewell to Arms", "The Book Thief", "Catch-22"])
    ])
  ]),
  branch("Poems", [
    branch("Epic poetry", ["The Epic of Gilgamesh", "The Iliad", "The Odyssey", "The Aeneid"]),
    branch("Sonnets", ["Shakespeare's Sonnets", "Astrophil and Stella", "Sonnets from the Portuguese", "The Sonnets of Gerard Manley Hopkins"]),
    branch("Lyric poetry", ["The Prelude", "Leaves of Grass", "Duino Elegies", "Ariel"]),
    branch("Narrative poetry", ["The Rime of the Ancient Mariner", "The Lady of the Lake", "The Waste Land", "The Faerie Queene"]),
    branch("Modern poetry", ["The Cantos", "Howl", "Ariel", "Twenty Love Poems and a Song of Despair"])
  ]),
  branch("Political Writings", [
    branch("Political philosophy", ["The Republic", "Leviathan", "The Social Contract", "On Liberty"]),
    branch("Rights and democracy", ["Two Treatises of Government", "The Federalist Papers", "A Vindication of the Rights of Woman", "Democracy in America"]),
    branch("Revolutions", ["Common Sense", "Reflections on the Revolution in France", "The Rights of Man", "The Communist Manifesto"]),
    branch("Social criticism", ["The Souls of Black Folk", "The Feminine Mystique", "Silent Spring", "The Wretched of the Earth"])
  ]),
  branch("Plays and Drama", [
    branch("Tragedy", ["Oedipus Rex", "Hamlet", "King Lear", "A Doll's House"]),
    branch("Comedy", ["The Comedy of Errors", "The Importance of Being Earnest", "The Cherry Orchard", "Waiting for Godot"]),
    branch("Historical plays", ["Henry V", "Richard III", "The Persians", "The Life and Adventures of Nicholas Nickleby"]),
    branch("Modern drama", ["A Streetcar Named Desire", "Death of a Salesman", "The Glass Menagerie", "The Crucible"])
  ]),
  branch("Essays and Speeches", [
    branch("Personal essays", ["Essays of Michel de Montaigne", "Confessions", "Walden", "The Diary of a Young Girl"]),
    branch("Literary essays", ["The Common Reader", "Tradition and the Individual Talent", "The Poetic Principle", "The Death of the Author"]),
    branch("Public speeches", ["Gettysburg Address", "I Have a Dream", "We Shall Fight on the Beaches", "The Gettysburg Address"])
  ]),
  branch("Myths and Folklore", [
    branch("Greek and Roman", ["Metamorphoses", "Theogony", "The Argonautica", "The Golden Ass"]),
    branch("Norse", ["Poetic Edda", "Prose Edda", "The Saga of the Volsungs", "Beowulf"]),
    branch("South Asian", ["Mahabharata", "Ramayana", "Panchatantra", "Jataka tales"]),
    branch("East Asian", ["Journey to the West", "Romance of the Three Kingdoms", "The Tale of Genji", "The Pillow Book"]),
    branch("African", ["Anansi stories", "Sunjata", "The Mwindo Epic", "The Ozidi Saga"]),
    branch("Indigenous traditions", ["Popol Vuh", "The Dreaming", "The Legend of the Seven Cities of Cibola", "Raven Tales"])
  ])
]);

const countries = [
  "United States", "Canada", "Mexico", "Guatemala", "Cuba", "Haiti", "Dominican Republic", "Jamaica",
  "Brazil", "Argentina", "Chile", "Peru", "Colombia", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay",
  "United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium",
  "Switzerland", "Austria", "Poland", "Czech Republic", "Hungary", "Romania", "Greece", "Sweden", "Norway", "Denmark", "Finland",
  "China", "Japan", "South Korea", "North Korea", "Mongolia", "India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Indonesia", "Malaysia", "Singapore", "Thailand", "Vietnam", "Philippines", "Cambodia", "Laos", "Myanmar",
  "Iran", "Iraq", "Turkey", "Saudi Arabia", "Israel", "Jordan", "Egypt", "Morocco", "Algeria", "Tunisia",
  "Nigeria", "Ghana", "Kenya", "Ethiopia", "Tanzania", "South Africa", "Democratic Republic of the Congo", "Australia", "New Zealand"
];

const TOPIC_SEEDS: TopicSeed[] = [
  branch("History", [
    branch("United States", [
      "Indigenous America", "Colonial America", "American Revolution", "Early United States",
      branch("U.S. Political History", ["Presidents", "Congress", "Elections", "Supreme Court History"]),
      "Civil War", "Reconstruction", "Gilded Age", "Progressive Era", "World War I Era", "Great Depression", "World War II Era",
      "Cold War", "Civil Rights Era", "Modern U.S. History", "U.S. Inventions", "American Technology", "American Industrial History",
      "Largest American Companies", "Famous American Companies", "Wealthiest Americans Through History", "Entrepreneurs",
      "Transportation History", "Infrastructure", "Military History", "Intelligence and Espionage", "Forgotten American Events",
      "Strange Political Events", "Everyday Life Through American History"
    ]),
    branch("World History", [
      "Ancient Civilizations", "Empires", "Kingdoms", "Trade Routes", "Exploration", "Migration", "Revolutions", "Wars",
      "Diplomacy", "Political Systems", "Economic History", "Everyday Life", "Lost Cities", "Archaeological Discoveries"
    ]),
    branch("Europe", [
      "Prehistoric Europe", "Ancient Greece", "Roman Republic", "Roman Empire", "Early Medieval", "High Medieval", "Late Medieval",
      "Renaissance", "Reformation", "Age of Exploration", "Enlightenment", "Revolutionary Period", "Industrial Revolution",
      "19th Century", "World War I", "Interwar Period", "World War II", "Cold War", "Contemporary Europe",
      branch("Countries", ["Britain", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Ireland", "Switzerland", "Austria", "Scandinavia"])
    ]),
    branch("Eastern Europe", [
      "Prehistoric Eastern Europe", "Ancient Eastern Europe", "Early Slavic History", "Byzantine Influence", "Medieval Kingdoms",
      "Polish-Lithuanian Commonwealth", "Russian Empire", "Ottoman Influence", "18th Century", "19th Century", "World War I",
      "Russian Revolution", "Interwar Period", "World War II", "Soviet Era", "Eastern Bloc", "Yugoslavia", "Fall of Communism",
      "Post-Soviet Era", "Modern Eastern Europe"
    ]),
    branch("East Asia", [
      "Ancient East Asia", "Imperial China", "Chinese Dynasties", "Ancient Korea", "Korean Kingdoms", "Ancient Japan", "Heian Japan",
      "Kamakura Period", "Mongol Era", "Ming China", "Joseon Korea", "Edo Japan", "Qing China", "Meiji Japan",
      "19th Century East Asia", "World War Era", "Communist Revolution in China", "Korean War", "Cold War East Asia",
      "Modern China", "Modern Japan", "Modern Korea", "Taiwan", "Mongolia"
    ]),
    branch("South Asia", [
      "Indus Valley Civilization", "Vedic Period", "Ancient Indian Kingdoms", "Maurya Empire", "Gupta Empire", "Medieval South Asia",
      "Delhi Sultanate", "Mughal Empire", "Regional Kingdoms", "European Trading Powers", "British Raj", "Independence Movement",
      "Partition", "Modern India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Bhutan", "Maldives"
    ]),
    branch("Middle East", [
      "Mesopotamia", "Sumer", "Babylon", "Assyria", "Ancient Persia", "Ancient Levant", "Early Islamic Era", "Islamic Golden Age",
      "Caliphates", "Crusades", "Mongol Era", "Ottoman Empire", "Safavid Persia", "18th Century", "19th Century", "World War I",
      "End of Ottoman Empire", "Interwar Middle East", "World War II", "Cold War Middle East", "Modern Middle East", "Iran", "Turkey",
      "Arabian Peninsula", "Levant", "Iraq"
    ]),
    branch("Southeast Asia", [
      "Ancient Southeast Asia", "Maritime Southeast Asia", "Khmer Empire", "Srivijaya", "Majapahit", "Vietnam", "Thailand", "Myanmar",
      "Philippines", "Indonesia", "Malaysia", "Singapore", "Brunei", "Cambodia", "Laos", "Timor-Leste", "Colonial Period",
      "World War II", "Decolonization", "Cold War", "Modern Southeast Asia"
    ]),
    branch("Central Asia and the Steppe", [
      "Central Asia", "Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Siberian History", "Caucasus History",
      "Himalayan History", "Steppe Peoples", "Scythians", "Turkic Peoples", "Mongol Peoples", "Silk Road Societies", "Nomadic Cultures"
    ]),
    branch("North America", [
      "Indigenous North America", "Canada", "United States", "Mexico", "Greenland", "Caribbean Connections", "European Colonization",
      "Fur Trade", "Exploration", "Border Changes", "Industrialization", "Migration", "World Wars", "Cold War", "Modern North America"
    ]),
    branch("Latin America", [
      "Pre-Columbian Americas", "Maya", "Aztec", "Inca", "Other Indigenous Civilizations", "Spanish Conquest", "Portuguese Colonization",
      "Colonial Latin America", "Independence Movements", "19th Century", "Mexican History", "Central America", "Caribbean", "Andes",
      "Brazilian History", "Southern Cone", "Revolutions", "Cold War", "Modern Latin America"
    ]),
    branch("Technology History", [
      "Ancient Engineering", "Medieval Technology", "Printing", "Navigation", "Clocks", "Industrial Revolution", "Engines", "Electricity",
      "Telegraph", "Telephone", "Photography", "Radio", "Television", "Transportation", "Aviation", "Rockets", "Computing", "Internet",
      "Semiconductors", "Robotics", "Artificial Intelligence", "Consumer Electronics"
    ]),
    branch("Inventions", [
      "Ancient Inventions", "Forgotten Inventions", "Accidental Inventions", "Medical Inventions", "Transportation", "Communication",
      "Computing", "Military Inventions", "Industrial Inventions", "Household Inventions", "Failed Inventions", "Inventions Ahead of Their Time"
    ]),
    branch("Human Origins and Evolution", [
      "Human Evolution", "Australopithecus", "Homo habilis", "Homo erectus", "Neanderthals", "Denisovans", "Early Homo sapiens",
      "Human Migration", "Stone Tools", "Fire", "Hunting", "Clothing", "Cave Art", "Ancient DNA", "Extinct Human Relatives"
    ]),
    branch("Earth History", ["Hadean", "Archean", "Proterozoic", "Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleocene", "Eocene", "Oligocene", "Miocene", "Pliocene", "Pleistocene", "Holocene"]),
    branch("Prehistoric and Extinct Life", [
      "Cambrian Animals", "Ancient Ocean Life", "Trilobites", "Early Fish", "Prehistoric Amphibians", "Prehistoric Reptiles", "Dinosaurs",
      "Pterosaurs", "Marine Reptiles", "Prehistoric Birds", "Prehistoric Mammals", "Ice Age Animals", "Megafauna", "Recently Extinct Animals",
      "Human-Caused Extinctions", "Island Extinctions", "Mass Extinction Events"
    ]),
    branch("Specialist Histories", [
      "Archaeology", "Lost Civilizations", "History of Medicine", "History of Money", "History of Food", "History of Transportation",
      "History of Warfare", "History of Espionage", "History of Exploration", "Maritime History", "Political History", "Economic History",
      "History of Cities", "Everyday Life in the Past", "Historical Mysteries", "Forgotten People", "Forgotten Events"
    ])
  ]),
  branch("Science", [
    branch("Chemistry", ["Atoms", "Elements", "Periodic Table", "Chemical Bonds", "Reactions", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Biochemistry", "Materials Chemistry", "Electrochemistry", "Nuclear Chemistry", "Strange Chemical Properties", "Everyday Chemistry"]),
    branch("Biology", ["Evolution", "Genetics", "DNA", "Cells", "Microbiology", "Bacteria", "Viruses", "Fungi", "Plants", "Animals", "Zoology", "Ecology", "Marine Biology", "Human Biology", "Anatomy", "Neuroscience", "Immunology", "Animal Behavior", "Extreme Organisms", "Symbiosis"]),
    branch("Physics", ["Mechanics", "Motion", "Gravity", "Electricity", "Magnetism", "Waves", "Sound", "Light", "Thermodynamics", "Fluid Mechanics", "Quantum Physics", "Particle Physics", "Nuclear Physics", "Relativity", "Strange Physical Phenomena"]),
    branch("Earth Science", ["Geology", "Plate Tectonics", "Volcanoes", "Earthquakes", "Minerals", "Rocks", "Oceans", "Atmosphere", "Weather", "Climate", "Paleontology", "Earth's Interior"]),
    branch("Technology", ["Electronics", "Computing", "Semiconductors", "Robotics", "Telecommunications", "Energy", "Transportation", "Manufacturing", "Materials", "Batteries", "Sensors", "Medical Technology", "Emerging Technology"]),
    branch("Space", [
      branch("Solar System", ["Sun", "Mercury", "Venus", branch("Earth", ["Moon"]), "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Dwarf Planets", "Asteroids", "Comets"]),
      "Stars", "Black Holes", "Neutron Stars", "Exoplanets", "Nebulae", "Galaxies", "Milky Way", "Cosmology", "Early Universe", "Space Telescopes", "Spacecraft", "Rockets", "Human Spaceflight", "Space Stations", "Strange Space Objects"
    ])
  ]),
  branch("Geography", [
    branch("Africa", [branch("North Africa", ["Egypt", "Morocco", "Algeria", "Tunisia", "Libya"]), branch("West Africa", ["Nigeria", "Ghana", "Senegal", "Mali", "Ivory Coast"]), branch("Central Africa", ["Cameroon", "Gabon", "Central African Republic", "Democratic Republic of the Congo"]), branch("East Africa", ["Kenya", "Ethiopia", "Tanzania", "Uganda", "Somalia"]), branch("Southern Africa", ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Mozambique", "Madagascar"])]),
    branch("North America", ["Canada", "United States", "Mexico", "Central America", "Caribbean", "Greenland"]),
    branch("South America", ["Northern South America", "Andes", "Amazon Basin", "Brazil", "Southern Cone", "Argentina", "Chile", "Peru", "Colombia", "Bolivia", "Ecuador", "Paraguay", "Uruguay"]),
    branch("Asia", ["East Asia", "South Asia", "Southeast Asia", "Central Asia", "West Asia", "North Asia", ...countries.filter((country) => ["China", "Japan", "South Korea", "India", "Pakistan", "Indonesia", "Thailand", "Vietnam", "Iran", "Turkey"].includes(country))]),
    branch("Europe", ["Western Europe", "Eastern Europe", "Northern Europe", "Southern Europe", "Central Europe", "Balkans", ...countries.filter((country) => ["United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Greece"].includes(country))]),
    branch("Oceania", ["Australia", "New Zealand", "Melanesia", "Micronesia", "Polynesia", "Pacific Islands"]),
    branch("Mountains", ["Himalayas", "Andes", "Rockies", "Alps", "Appalachians", "Caucasus", "Atlas", "Great Dividing Range", "Volcanoes", "Highest Mountains", "Unusual Mountains"]),
    branch("Rivers", ["Nile", "Amazon", "Mississippi", "Yangtze", "Yellow River", "Congo", "Ganges", "Danube", "Mekong", "Historic Rivers", "Strange River Systems"]),
    branch("Cities", ["Ancient Cities", "Megacities", "Capital Cities", "Planned Cities", "Port Cities", "Mountain Cities", "Desert Cities", "Abandoned Cities", "Underground Cities", "Strange Borders"]),
    branch("Biomes", ["Tropical Rainforest", "Temperate Rainforest", "Tropical Seasonal Forest", "Temperate Forest", "Boreal Forest / Taiga", "Savanna", "Temperate Grassland", "Desert", "Mediterranean", "Tundra", "Alpine", "Wetlands", "Freshwater", "Rivers", "Coral Reefs", "Coastal", "Open Ocean", "Deep Ocean", "Polar"]),
    branch("Other Geography", ["Islands", "Lakes", "Deserts", "Oceans", "Seas", "Borders", "Enclaves", "Exclaves", "Strange Borders", "Geographic Extremes", "Remote Places", "Caves", "Waterfalls", "Canyons", "Peninsulas", "Archipelagos", "Natural Wonders", "Human Geography", "Population", "Languages", "Migration", "Maps", "Cartography"])
  ]),
  branch("Computer Science", [
    branch("Programming Fundamentals", ["Variables", "Data Types", "Control Flow", "Functions", "Recursion", "Errors", "Memory", "OOP", "Functional Programming", "Async Programming", "Concurrency"]),
    branch("Programming Languages", ["Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Rust", "Go", "Swift", "Kotlin", "SQL", "Assembly", "Lisp", "Language History"]),
    branch("Data Structures", ["Arrays", "Linked Lists", "Stacks", "Queues", "Hash Tables", "Trees", "Binary Search Trees", "Heaps", "Tries", "Graphs", "Disjoint Sets"]),
    branch("Algorithms", ["Searching", "Sorting", "Recursion", "Dynamic Programming", "Greedy Algorithms", "Graph Algorithms", "String Algorithms", "Divide and Conquer", "Backtracking", "Randomized Algorithms", "Big O", "Time Complexity", "Space Complexity", "Amortized Analysis"]),
    branch("Artificial Intelligence", [
      branch("AI Fundamentals", ["AI History", "Search Algorithms", "Knowledge Representation", "Planning", "Reasoning"]),
      branch("Machine Learning", ["Supervised Learning", "Unsupervised Learning", "Semi-Supervised Learning", "Reinforcement Learning", "Classification", "Regression", "Clustering", "Feature Engineering", "Evaluation"]),
      branch("Deep Learning", ["Neural Networks", "Backpropagation", "CNNs", "RNNs", branch("Transformers", ["Attention"]), "Embeddings"]),
      branch("Generative AI", ["Large Language Models", "Tokens", "Context Windows", "Prompting", "Fine-Tuning", "RAG", "Vector Databases", "Embeddings", "AI Agents", "Tool Calling", "Multimodal AI", "Image Generation", "Video Generation"]),
      branch("Computer Vision", ["Image Classification", "Object Detection", "Segmentation", "Pose Estimation", "OCR", "Image Embeddings"]),
      branch("Natural Language Processing", ["Tokenization", "Language Models", "Sentiment Analysis", "Translation", "Speech Recognition", "Text Embeddings"]),
      branch("Recommendations", ["Collaborative Filtering", "Content-Based Recommendations", "Ranking Systems"])
    ]),
    branch("Networks", ["Internet Fundamentals", "IP Addresses", "IPv4", "IPv6", "TCP", "UDP", "DNS", "HTTP", "HTTPS", "TLS", "Routing", "Switching", "Wi-Fi", "Ethernet", "NAT", "VPNs", "CDNs", "Load Balancers", "Firewalls", "Network Security", "Internet Infrastructure", "Undersea Cables"]),
    branch("Hardware", ["CPUs", "Instruction Sets", "Registers", "Cache", "RAM", "Storage", "Buses", "Pipelining", "Branch Prediction", "Multicore CPUs", "GPUs", "ARM", "x86", "RISC", "CISC", "Motherboards", "Hardware History"]),
    branch("Operating Systems", ["Processes", "Threads", "Scheduling", "Virtual Memory", "Memory Management", "Filesystems", "System Calls", "Kernels", "Drivers", "Permissions", "Linux", "Windows", "macOS", "Mobile Operating Systems"]),
    branch("Systems and Architecture", ["Client-Server Architecture", "APIs", "REST", "RPC", "Databases", "Caching", "Load Balancing", "Replication", "Sharding", "Message Queues", "Event-Driven Systems", "Microservices", "Monoliths", "Distributed Systems", "Consistency", "Availability", "Fault Tolerance", "Scalability", "Rate Limiting"]),
    branch("Databases", ["SQL", "Relational Databases", "PostgreSQL", "MySQL", "SQLite", "NoSQL", "Document Databases", "Key-Value Databases", "Graph Databases", "Vector Databases", "Indexes", "Transactions", "ACID", "Query Planning", "Replication", "Database History"]),
    branch("Web Development", ["HTML", "CSS", "JavaScript", "Browsers", "DOM", "Frontend Development", "Backend Development", "React", "Web Servers", "APIs", "Authentication", "Cookies", "Sessions", "WebSockets", "Web Security", "Browser Engines"]),
    branch("Security", ["Cryptography", "Encryption", "Hashing", "Authentication", "Authorization", "Password Security", "Network Security", "Web Security", "Malware", "Phishing", "Vulnerabilities", "Security History", "Defensive Security"]),
    branch("Cloud and DevOps", ["Cloud Computing", "Virtual Machines", "Containers", "Docker", "Kubernetes", "Serverless", "Infrastructure", "CI/CD", "Observability", "Logging", "Monitoring", "Cloud Storage", "Distributed Computing"]),
    branch("Software Engineering", ["Git", "Version Control", "Testing", "Unit Testing", "Integration Testing", "Debugging", "Code Review", "Design Patterns", "Software Architecture", "Technical Debt", "Refactoring", "APIs", "Documentation", "Open Source"]),
    branch("Other Fields", ["Distributed Systems", "Compilers", "Programming Language Design", "Computer Graphics", "Game Development", "Human-Computer Interaction", "Mobile Development", "Embedded Systems", "Internet of Things", "Robotics", "Data Engineering", "Data Science", "Parallel Computing", "Quantum Computing", "Theory of Computation", "Information Theory", "Computer History", "Famous Computer Scientists", "Famous Software Bugs", "Early Internet History", "Computing Oddities"])
  ]),
  LITERATURE_SEED
];

function slug(value: string) {
  const normalized = value.toLowerCase().trim()
    .replace(/c\+\+/g, "c-plus-plus")
    .replace(/c#/g, "c-sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || "topic";
}

function nodeId(path: string[]) {
  return `topic-${path.map(slug).join("--")}`;
}

function buildNode(seed: TopicSeed, parentPath: string[], depth: number, rootIndex: number): TopicNode {
  const label = typeof seed === "string" ? seed : seed.label;
  const children = typeof seed === "string" ? undefined : seed.children;
  const path = [...parentPath, label];
  return {
    id: nodeId(path), label, selected: false, expanded: depth === 0,
    weight: depth === 0 ? ([30, 25, 20, 25][rootIndex] ?? 10) : 10,
    children: children?.map((child) => buildNode(child, path, depth + 1, rootIndex))
  };
}

export function createCatalogTopics(): TopicNode[] {
  return TOPIC_SEEDS.map((seed, index) => buildNode(seed, [], 0, index));
}

export function flattenTopics(nodes: TopicNode[], parentPath: string[] = []): Array<TopicNode & { path: string[] }> {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label];
    return [{ ...node, path }, ...(node.children ? flattenTopics(node.children, path) : [])];
  });
}

export type SelectionState = "selected" | "mixed" | "none";

function leafStats(node: TopicNode): { selected: number; total: number } {
  if (!node.children?.length) return { selected: node.selected ? 1 : 0, total: 1 };
  return node.children.reduce((stats, child) => {
    const next = leafStats(child);
    return { selected: stats.selected + next.selected, total: stats.total + next.total };
  }, { selected: 0, total: 0 });
}

export function selectionState(node: TopicNode): SelectionState {
  const stats = leafStats(node);
  return stats.selected === 0 ? "none" : stats.selected === stats.total ? "selected" : "mixed";
}

function setBranchSelected(node: TopicNode, selected: boolean): TopicNode {
  return { ...node, selected, children: node.children?.map((child) => setBranchSelected(child, selected)) };
}

function syncParentSelection(node: TopicNode): TopicNode {
  const children = node.children?.map(syncParentSelection);
  const next = children ? { ...node, children } : node;
  return { ...next, selected: selectionState(next) === "selected" };
}

export function toggleTopicSelection(nodes: TopicNode[], id: string): TopicNode[] {
  const visit = (list: TopicNode[]): TopicNode[] => list.map((node) => {
    if (node.id === id) return setBranchSelected(node, selectionState(node) !== "selected");
    return node.children ? { ...node, children: visit(node.children) } : node;
  }).map(syncParentSelection);
  return visit(nodes);
}

export function selectedLeafTopics(nodes: TopicNode[]) {
  return flattenTopics(nodes).filter((topic) => !topic.children?.length && topic.selected);
}

export function selectedLeafCount(nodes: TopicNode[]) {
  return selectedLeafTopics(nodes).length;
}

export function summarizeSelection(nodes: TopicNode[]) {
  const roots = nodes.filter((node) => selectionState(node) === "selected").map((node) => node.label);
  const leaves = selectedLeafTopics(nodes).map((topic) => topic.path.join(" / "));
  const visible = roots.length ? roots : leaves;
  if (!visible.length) return "No topics selected";
  return visible.slice(0, 3).join(" · ") + (visible.length > 3 ? ` +${visible.length - 3} more` : "");
}

export function selectWeightedTopicPaths(nodes: TopicNode[], limit = 10) {
  const pool = selectedLeafTopics(nodes).map((topic) => ({
    path: topic.path,
    weight: Math.max(1, Math.round(topic.path.reduce((total, label) => {
      const parent = flattenTopics(nodes).find((candidate) => candidate.path.join("\u0000") === [...topic.path.slice(0, topic.path.indexOf(label) + 1)].join("\u0000"));
      return total * ((parent?.weight ?? 10) / 10);
    }, 10)))
  }));
  const selected: Array<{ path: string[]; weight: number }> = [];
  while (pool.length && selected.length < limit) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    const index = pool.findIndex((item) => (cursor -= item.weight) <= 0);
    selected.push(pool.splice(index < 0 ? pool.length - 1 : index, 1)[0]);
  }
  return selected;
}

function updateById(nodes: TopicNode[], id: string, update: (node: TopicNode) => TopicNode): TopicNode[] {
  return nodes.map((node) => node.id === id
    ? update(node)
    : node.children ? { ...node, children: updateById(node.children, id, update) } : node);
}

export function migrateTopicTree(saved: TopicNode[] | undefined): TopicNode[] {
  if (!saved?.length) return createCatalogTopics();
  let next = createCatalogTopics();
  const fresh = flattenTopics(next);
  const byPath = new Map(fresh.map((topic) => [topic.path.join("\u0000").toLowerCase(), topic]));
  const byLabel = new Map<string, typeof fresh>();
  fresh.forEach((topic) => byLabel.set(topic.label.toLowerCase(), [...(byLabel.get(topic.label.toLowerCase()) ?? []), topic]));
  const missingCustom = new Map<string, TopicNode>();
  const selectedIds = new Set<string>();
  flattenTopics(saved).forEach((oldTopic) => {
    const key = oldTopic.path.join("\u0000").toLowerCase();
    const target = byPath.get(key) ?? (byLabel.get(oldTopic.label.toLowerCase())?.length === 1 ? byLabel.get(oldTopic.label.toLowerCase())?.[0] : undefined);
    if (target) {
      next = updateById(next, target.id, (node) => ({ ...node, weight: oldTopic.weight || node.weight, expanded: oldTopic.expanded }));
      if (oldTopic.selected) selectedIds.add(target.id);
      return;
    }
    if (oldTopic.custom || oldTopic.selected) {
      const customKey = oldTopic.label.toLowerCase();
      if (!missingCustom.has(customKey)) missingCustom.set(customKey, { id: `custom-${slug(oldTopic.label)}`, label: oldTopic.label, selected: oldTopic.selected, expanded: false, weight: oldTopic.weight || 10, custom: true });
    }
  });
  selectedIds.forEach((id) => { next = updateById(next, id, (node) => setBranchSelected(node, true)); });
  return [...next, ...Array.from(missingCustom.values())];
}
