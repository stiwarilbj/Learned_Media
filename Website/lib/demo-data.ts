import type { FactCard, FeedSettings, TopicNode } from "./types";

export const DEFAULT_SETTINGS: FeedSettings = {
  obscurity: 4,
  displayMode: "picture-text",
  sentenceLength: 2,
  surpriseMe: true
};

export function createDefaultTopics(): TopicNode[] {
  return [
    {
      id: "history",
      label: "History",
      selected: true,
      expanded: true,
      weight: 30,
      children: [
        { id: "ancient-history", label: "Ancient History", selected: true, expanded: false, weight: 15 },
        { id: "medieval-history", label: "Medieval History", selected: true, expanded: false, weight: 10 },
        { id: "modern-history", label: "Modern History", selected: false, expanded: false, weight: 5 }
      ]
    },
    {
      id: "computer-science",
      label: "Computer Science",
      selected: true,
      expanded: true,
      weight: 25,
      children: [
        { id: "programming", label: "Programming", selected: true, expanded: false, weight: 15 },
        { id: "artificial-intelligence", label: "Artificial Intelligence", selected: false, expanded: false, weight: 5 },
        { id: "computing-history", label: "Computing History", selected: false, expanded: false, weight: 5 }
      ]
    },
    {
      id: "science",
      label: "Science",
      selected: true,
      expanded: true,
      weight: 25,
      children: [
        { id: "space", label: "Space", selected: true, expanded: false, weight: 10 },
        { id: "biology", label: "Biology", selected: true, expanded: false, weight: 10 },
        { id: "physics", label: "Physics", selected: false, expanded: false, weight: 5 }
      ]
    },
    {
      id: "geography",
      label: "Geography",
      selected: false,
      expanded: false,
      weight: 20,
      children: [
        { id: "mountains", label: "Mountains", selected: false, expanded: false, weight: 7 },
        { id: "rivers", label: "Rivers", selected: false, expanded: false, weight: 7 },
        { id: "cities", label: "Cities", selected: false, expanded: false, weight: 6 }
      ]
    }
  ];
}

const octopusImage = {
  url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Octopus2.jpg/330px-Octopus2.jpg",
  alt: "An octopus underwater",
  sourceTitle: "Octopus",
  sourceUrl: "https://en.wikipedia.org/wiki/Octopus",
  fileUrl: "https://upload.wikimedia.org/wikipedia/commons/5/57/Octopus2.jpg",
  filePageUrl: "https://commons.wikimedia.org/wiki/File:Octopus2.jpg",
  credit: "Wikimedia Commons"
} as const;

function demoCard(card: Omit<FactCard, "sources"> & { source: string; additionalSources?: string[] }) {
  const { source, additionalSources = [], ...rest } = card;
  const sourceTitles = [source, ...additionalSources];
  return { ...rest, sources: sourceTitles.map((title) => ({ title, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}` })) } satisfies FactCard;
}

export const DEMO_FACTS: FactCard[] = [
  {
    id: "octopus-hearts",
    hook: "Three hearts, one swimming problem",
    title: "Octopuses have three hearts, and two of them stop beating when they swim",
    body: "Two hearts pump blood to the gills, while the third pumps it to the rest of the body. When an octopus swims, the two gill hearts stop beating, which may be why these animals prefer to crawl.",
    topicPath: ["Science", "Biology"],
    sources: [{ title: "Octopus", url: "https://en.wikipedia.org/wiki/Octopus" }],
    image: octopusImage,
    obscurity: 4,
    accent: "mint",
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
    obscurity: 4,
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
    obscurity: 5,
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
    obscurity: 3,
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
    obscurity: 5,
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
    obscurity: 4,
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
    obscurity: 4,
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
    obscurity: 4,
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
    obscurity: 3,
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
    obscurity: 4,
    accent: "blue",
    createdAt: "3 days ago"
  })
];

export const EXPLORE_CATEGORIES = [
  { label: "History", description: "Forgotten inventions, turning points, and people.", tone: "blue", topics: ["Ancient History", "History of Technology", "U.S. History"] },
  { label: "Science", description: "Strange systems, hidden mechanisms, and the natural world.", tone: "mint", topics: ["Biology", "Space", "Physics"] },
  { label: "Computer Science", description: "The small ideas behind the systems we use every day.", tone: "lilac", topics: ["AI & Machine Learning", "Programming", "Computing History"] },
  { label: "Geography", description: "Unusual places, borders, landscapes, and cities.", tone: "sand", topics: ["Cities", "Rivers", "Biomes"] }
];
