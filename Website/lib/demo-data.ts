import type { FactCard, FeedSettings, TopicNode } from "./types";
import { createCatalogTopics } from "./topic-catalog";

export const DEFAULT_SETTINGS: FeedSettings = {
  obscurity: 10,
  displayMode: "picture-text",
  sentenceLength: 2,
  surpriseMe: true
};

export function createDefaultTopics(): TopicNode[] {
  return createCatalogTopics();
}

function demoCard(card: Omit<FactCard, "sources"> & { source: string; additionalSources?: string[] }) {
  const { source, additionalSources = [], ...rest } = card;
  const sourceTitles = [source, ...additionalSources];
  return { ...rest, sources: sourceTitles.map((title) => ({ title, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}` })) } satisfies FactCard;
}

export const DEMO_FACTS: FactCard[] = [
  {
    id: "roman-dodecahedron",
    hook: "A Roman object still has no agreed purpose",
    title: "Roman dodecahedra are hollow twelve-sided objects with no agreed purpose",
    body: "More than a hundred small Roman dodecahedra have been found across parts of Europe. They have twelve pentagonal faces and carefully shaped openings, but their original use remains uncertain.",
    topicPath: ["History", "Ancient History"],
    sources: [{ title: "Roman dodecahedron", url: "https://en.wikipedia.org/wiki/Roman_dodecahedron" }],
    difficulty: 10,
    accent: "sand",
    createdAt: "Today"
  },
  demoCard({
    id: "mouse-wood",
    hook: "The mouse began as a wooden box",
    title: "The first computer mouse was carved from wood",
    body: "Douglas Engelbart’s 1964 prototype used two wheels and a small wooden shell. The name “mouse” came later, inspired by the cord trailing behind the device.",
    topicPath: ["Computer Science", "Computing History"],
    source: "Computer mouse",
    additionalSources: ["Douglas Engelbart"],
    difficulty: 9,
    accent: "lilac",
    createdAt: "Today"
  }),
  demoCard({
    id: "roman-concrete",
    hook: "Seawater can help Roman concrete",
    title: "Some Roman concrete structures get stronger in seawater",
    body: "Researchers have found that seawater can trigger new mineral growth inside certain Roman concrete mixtures. Instead of only wearing the material down, the water can help reinforce it over time.",
    topicPath: ["History", "Ancient History"],
    source: "Roman concrete",
    difficulty: 9,
    accent: "sand",
    createdAt: "Yesterday"
  }),
  demoCard({
    id: "venus-day",
    hook: "Venus turns more slowly than it orbits",
    title: "A day on Venus is longer than its year",
    body: "Venus rotates so slowly that one turn takes about 243 Earth days, while one trip around the Sun takes about 225. Its solar day is shorter because of the planet’s unusual retrograde spin.",
    topicPath: ["Science", "Space"],
    source: "Venus",
    additionalSources: ["Planetary rotation"],
    difficulty: 7,
    accent: "coral",
    createdAt: "Yesterday"
  }),
  demoCard({
    id: "blue-banana",
    hook: "Europe has an economic banana",
    title: "The blue banana is a real geographic pattern, not a fruit",
    body: "The “Blue Banana” is a curved corridor of dense population and economic activity stretching across parts of western Europe. Its shape follows a chain of cities, industries, and transport links.",
    topicPath: ["Geography", "Cities"],
    source: "Blue Banana",
    difficulty: 8,
    accent: "blue",
    surprise: true,
    createdAt: "Yesterday"
  }),
  demoCard({
    id: "antarctic-dry-valleys",
    hook: "Antarctica has almost snowless valleys",
    title: "Antarctica has valleys where almost no snow falls",
    body: "The McMurdo Dry Valleys are among the driest places on Earth. Katabatic winds sweep down from the ice sheet and can evaporate or blow away most of the little snow that arrives.",
    topicPath: ["Geography", "Biomes"],
    source: "McMurdo Dry Valleys",
    difficulty: 8,
    accent: "blue",
    createdAt: "2 days ago"
  }),
  demoCard({
    id: "mantis-shrimp",
    hook: "Some shrimp see a hidden kind of light",
    title: "Mantis shrimp can see polarized light that humans cannot",
    body: "Their eyes detect different kinds of light, including polarization. This gives them a visual channel that is invisible to people and may help them communicate or spot prey.",
    topicPath: ["Science", "Biology"],
    source: "Stomatopoda",
    difficulty: 9,
    accent: "mint",
    createdAt: "2 days ago"
  }),
  demoCard({
    id: "paper-clip",
    hook: "A tiny office tool became a symbol",
    title: "The modern paper clip became popular through wartime resistance",
    body: "In occupied Norway during the Second World War, people wore paper clips as a quiet symbol of solidarity. The clip stood for holding things together without needing a spoken message.",
    topicPath: ["History", "Modern History"],
    source: "Paper clip",
    difficulty: 7,
    accent: "lilac",
    createdAt: "2 days ago"
  }),
  demoCard({
    id: "honey-never-spoils",
    hook: "Honey makes life difficult for microbes",
    title: "Honey can stay edible for thousands of years",
    body: "Its low water content, acidity, and natural hydrogen peroxide make honey hostile to many microbes. Archaeologists have found ancient honey that remained preserved in sealed containers.",
    topicPath: ["Science", "Biology"],
    source: "Honey",
    difficulty: 6,
    accent: "sand",
    createdAt: "3 days ago"
  }),
  demoCard({
    id: "fermi-paradox",
    hook: "The universe leaves us with a question",
    title: "The Fermi paradox starts with a simple question: where is everybody?",
    body: "The universe is vast and old enough for many technological civilizations to have arisen. The paradox asks why we have not seen clear evidence of them despite those seemingly favorable odds.",
    topicPath: ["Science", "Space"],
    source: "Fermi paradox",
    additionalSources: ["Drake equation", "Extraterrestrial life"],
    difficulty: 8,
    accent: "blue",
    createdAt: "3 days ago"
  }),
  demoCard({
    id: "antikythera-mechanism",
    hook: "A bronze machine tracked the ancient sky",
    title: "The Antikythera mechanism modeled repeating astronomical cycles",
    body: "The Antikythera mechanism is a heavily corroded Greek device with interlocking gears that represented lunar and solar cycles. Its precision and complexity make it one of the most surprising surviving examples of ancient mechanical technology.",
    topicPath: ["History", "Ancient History"],
    source: "Antikythera mechanism",
    difficulty: 10,
    accent: "sand",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "quipu",
    hook: "Knotted cords could preserve records",
    title: "Inca administrators used knotted cords to record information",
    body: "Quipu were arrangements of cords and knots used in the Andes for accounting and administration. The position, color, and type of knot carried structured information, although the full system is still not completely understood.",
    topicPath: ["History", "Ancient History"],
    source: "Quipu",
    difficulty: 9,
    accent: "lilac",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "tyrian-purple",
    hook: "An ancient dye came from sea snails",
    title: "Tyrian purple was made from secretions of sea snails",
    body: "The ancient purple dye known as Tyrian purple was produced from certain sea snails. Making a small amount required processing many mollusks, which helped make the color a luxury associated with power.",
    topicPath: ["History", "Ancient History"],
    source: "Tyrian purple",
    difficulty: 8,
    accent: "coral",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "mechanical-turk",
    hook: "A chess machine hid a human player",
    title: "The Mechanical Turk appeared to play chess by itself",
    body: "The Mechanical Turk was an eighteenth-century automaton presented as a chess-playing machine. It was eventually exposed as an elaborate illusion in which a human chess player operated inside the cabinet.",
    topicPath: ["Computer Science", "Computing History"],
    source: "The Turk",
    difficulty: 7,
    accent: "lilac",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "harvard-mark-ii-bug",
    hook: "A moth helped define a computer bug",
    title: "A moth trapped in the Harvard Mark II was logged as a computer bug",
    body: "In 1947, operators found a moth caught between relay contacts in the Harvard Mark II. They taped the insect into the logbook and described the debugging work, helping popularize the literal use of bug for a computer fault.",
    topicPath: ["Computer Science", "Computing History"],
    source: "Harvard Mark II",
    additionalSources: ["Computer bug"],
    difficulty: 8,
    accent: "mint",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "oklo-reactor",
    hook: "Earth once ran a natural nuclear reactor",
    title: "A uranium deposit in Oklo sustained natural fission",
    body: "About two billion years ago, conditions in parts of the Oklo uranium deposit allowed a natural nuclear fission reaction to operate. The site left behind evidence that can help scientists study how radioactive materials move through rock.",
    topicPath: ["Science", "Physics"],
    source: "Oklo",
    difficulty: 10,
    accent: "mint",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "lake-vostok",
    hook: "A huge lake hides beneath Antarctic ice",
    title: "Lake Vostok sits sealed beneath kilometers of Antarctic ice",
    body: "Lake Vostok is a large subglacial lake beneath the East Antarctic Ice Sheet. Its water has been isolated under ice for an extremely long time, making it a valuable setting for studying life in dark, sealed environments.",
    topicPath: ["Science", "Space"],
    source: "Lake Vostok",
    difficulty: 8,
    accent: "blue",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "axolotl-regeneration",
    hook: "One salamander can rebuild lost body parts",
    title: "Axolotls can regenerate limbs and parts of major organs",
    body: "Axolotls retain unusually strong regenerative abilities after reaching adulthood. They can regrow limbs and repair parts of organs, which has made them important subjects in developmental and regenerative biology.",
    topicPath: ["Science", "Biology"],
    source: "Axolotl",
    difficulty: 6,
    accent: "mint",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "ada-lovelace-notes",
    hook: "The first program was written for an idea",
    title: "Ada Lovelace described a machine that had not yet been built",
    body: "While translating a paper about Charles Babbage’s Analytical Engine, Ada Lovelace added notes that included an algorithm for calculating Bernoulli numbers. The machine was never completed, but the notes anticipated general-purpose computer programming.",
    topicPath: ["Computer Science", "Programming"],
    source: "Ada Lovelace",
    additionalSources: ["Analytical Engine"],
    difficulty: 7,
    accent: "coral",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "sagittarius-b2-alcohol",
    hook: "A space cloud contains complex alcohol",
    title: "The Sagittarius B2 molecular cloud contains large organic molecules",
    body: "Astronomers have detected molecules including ethyl formate and methanol in Sagittarius B2, a dense cloud near the center of the Milky Way. The chemistry offers a window into how complex molecules can form between stars.",
    topicPath: ["Science", "Space"],
    source: "Sagittarius B2",
    difficulty: 10,
    accent: "blue",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "brinicle",
    hook: "An underwater icicle can freeze the seafloor",
    title: "Brinicles form when salty water sinks as an underwater column of ice",
    body: "A brinicle is a hollow tube of ice that can form beneath sea ice when extremely cold, salty water drains downward. The descending brine freezes surrounding seawater and can create a delicate path across the seafloor.",
    topicPath: ["Science", "Biology"],
    source: "Brinicle",
    difficulty: 9,
    accent: "blue",
    createdAt: "4 days ago"
  }),
  demoCard({
    id: "volcanic-lightning",
    hook: "Volcanoes can make their own lightning",
    title: "Ash clouds can generate lightning during volcanic eruptions",
    body: "Volcanic lightning occurs when particles in an eruption plume collide and separate electrical charges. The charged ash cloud can then produce flashes much like an ordinary thunderstorm.",
    topicPath: ["Science", "Physics"],
    source: "Volcanic lightning",
    difficulty: 8,
    accent: "coral",
    createdAt: "4 days ago"
  })
];

export const EXPLORE_CATEGORIES = [
  { label: "History", description: "Forgotten inventions, turning points, and people.", tone: "blue", topics: ["Ancient History", "History of Technology", "U.S. History"] },
  { label: "Science", description: "Strange systems, hidden mechanisms, and the natural world.", tone: "mint", topics: ["Biology", "Space", "Physics"] },
  { label: "Computer Science", description: "The small ideas behind the systems we use every day.", tone: "lilac", topics: ["AI & Machine Learning", "Programming", "Computing History"] },
  { label: "Geography", description: "Unusual places, borders, landscapes, and cities.", tone: "sand", topics: ["Cities", "Rivers", "Biomes"] }
];
