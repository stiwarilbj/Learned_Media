import type { TopicSeed } from "./topic-catalog";

type BranchSeed = { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): BranchSeed => ({ label, children, aliases });

const EARTHQUAKES: TopicSeed[] = [
  branch("Megathrust and Subduction Earthquakes", [
    branch("Deadliest and Most Influential Incidents", ["1960 Valdivia Earthquake", "1964 Alaska Earthquake", "2004 Indian Ocean Earthquake", "2011 Tōhoku Earthquake", "1700 Cascadia Earthquake", "1755 Lisbon Earthquake", "1908 Messina Earthquake", "2010 Maule Earthquake"]),
    branch("Other Major Incidents", ["869 Sanriku Earthquake", "1896 Sanriku Earthquake", "1946 Aleutian Earthquake", "1965 Rat Islands Earthquake", "2005 Nias-Simeulue Earthquake", "2010 Mentawai Earthquake", "2021 Kermadec Earthquake"])
  ]),
  branch("Shallow Crustal Earthquakes", [
    branch("Deadliest and Most Influential Incidents", ["1556 Shaanxi Earthquake", "1920 Haiyuan Earthquake", "1976 Tangshan Earthquake", "2008 Sichuan Earthquake", "2023 Turkey–Syria Earthquakes", "1999 İzmit Earthquake", "2003 Bam Earthquake", "2015 Nepal Earthquake"]),
    branch("Other Major Incidents", ["1755 Nepal–Bihar Earthquake", "1906 San Francisco Earthquake", "1923 Great Kantō Earthquake", "1966 Tashkent Earthquake", "1988 Spitak Earthquake", "1990 Manjil–Rudbar Earthquake", "2011 Christchurch Earthquake", "2023 Morocco Earthquake"])
  ]),
  branch("Earthquake-Triggered Tsunamis and Landslides", ["1929 Grand Banks Earthquake and Tsunami", "1946 Hilo Tsunami", "1964 Alaska Tsunami", "1970 Ancash Earthquake and Avalanche", "1998 Papua New Guinea Tsunami", "2004 Indian Ocean Tsunami", "2018 Sulawesi Earthquake and Tsunami", "2022 Hunga Tonga Tsunami"]),
  branch("Earthquake Types and Effects", ["Strike-Slip Earthquakes", "Normal-Fault Earthquakes", "Reverse-Fault Earthquakes", "Intraplate Earthquakes", "Induced Seismicity", "Liquefaction", "Earthquake Fires", "Earthquake Landslides", "Earthquake Ground Rupture"]),
  "Other Major Earthquakes"
];

const VOLCANIC_ERUPTIONS: TopicSeed[] = [
  branch("Explosive Plinian Eruptions", ["79 Vesuvius Eruption", "1815 Mount Tambora Eruption", "1883 Krakatoa Eruption", "1902 Mount Pelée Eruption", "1912 Novarupta Eruption", "1991 Mount Pinatubo Eruption", "2022 Hunga Tonga Eruption", "Other Plinian Eruptions"]),
  branch("Caldera and Supereruptions", ["Toba Eruption", "Lake Taupō Oruanui Eruption", "Campanian Ignimbrite Eruption", "Yellowstone Lava Creek Eruption", "Long Valley Bishop Tuff Eruption", "Aira Caldera Eruption", "Santorini Minoan Eruption", "Other Caldera Eruptions"]),
  branch("Lava, Ash, and Fissure Eruptions", ["1783 Laki Eruption", "1783–1784 Lakagígar Famine", "1961 Mount Agung Eruption", "2010 Eyjafjallajökull Eruption", "2018 Kīlauea Eruption", "2021 Cumbre Vieja Eruption", "2022 Mauna Loa Eruption", "Other Lava and Ash Eruptions"]),
  branch("Pyroclastic Flows and Lahars", ["1902 Mount Pelée Pyroclastic Flow", "1919 Kelud Lahars", "1929 Santiaguito Eruption", "1985 Nevado del Ruiz Lahar", "1991 Mount Pinatubo Lahars", "2010 Merapi Eruption", "2014 Mount Ontake Eruption", "Other Pyroclastic-Flow Disasters"]),
  branch("Volcanic Eruptions and Famine", ["1815 Tambora and the Year Without a Summer", "1783 Laki and the Haze Famine", "1600 Huaynaputina Eruption and Famine", "1257 Samalas Eruption and Climate Shock", "939 Eldgjá Eruption and Famine", "536 Volcanic Climate Shock", "1452 Kuwae Eruption", "Other Eruption-Driven Famines"]),
  "Other Major Volcanic Eruptions"
];

const TSUNAMIS: TopicSeed[] = [
  branch("Earthquake-Generated Tsunamis", ["1755 Lisbon Tsunami", "1896 Sanriku Tsunami", "1946 Aleutian Tsunami", "1960 Chilean Tsunami", "1964 Alaska Tsunami", "2004 Indian Ocean Tsunami", "2011 Tōhoku Tsunami", "2018 Sulawesi Tsunami", "2022 Hunga Tonga Tsunami"]),
  branch("Volcanic Tsunamis", ["1883 Krakatoa Tsunami", "1792 Unzen Tsunami", "1638 Komagatake Tsunami", "1888 Ritter Island Tsunami", "2022 Hunga Tonga Tsunami", "Other Volcanic Tsunamis"]),
  branch("Landslide-Generated Tsunamis", ["1929 Grand Banks Tsunami", "1998 Papua New Guinea Tsunami", "2017 Greenland Karrat Fjord Tsunami", "2018 Anak Krakatau Tsunami", "1958 Lituya Bay Megatsunami", "Other Landslide Tsunamis"]),
  branch("Tsunami Effects and Famine", ["Indian Ocean Coastal Famine After 2004", "Tōhoku Nuclear and Food-System Disruption", "Lisbon Earthquake, Fire, and Tsunami", "Sanriku Coastal Famine and Displacement", "Other Tsunami Humanitarian Crises"]),
  "Other Major Tsunamis"
];

const FLOODS: TopicSeed[] = [
  branch("River Floods", ["1931 China Floods", "1887 Yellow River Flood", "1938 Yellow River Flood", "1998 Yangtze River Floods", "2010 Pakistan Floods", "2022 Pakistan Floods", "2022 Henan Floods", "2023 Libya Floods", "Other Major River Floods"]),
  branch("Coastal Floods and Storm Surges", ["1953 North Sea Flood", "1970 Bhola Cyclone Storm Surge", "1991 Bangladesh Cyclone Storm Surge", "2005 Hurricane Katrina Storm Surge", "2008 Cyclone Nargis Storm Surge", "2013 Typhoon Haiyan Storm Surge", "2020 Cyclone Amphan Storm Surge", "Other Coastal Flood Disasters"]),
  branch("Flash Floods and Urban Floods", ["1976 Big Thompson Canyon Flood", "1998 Vargas Flash Floods", "2003 Bam Floods", "2010 Leh Cloudburst", "2013 Uttarakhand Floods", "2018 Kerala Floods", "2021 Western Europe Floods", "2022 Durban Floods", "Other Flash Floods"]),
  branch("Glacial Lake Outburst and Ice-Dam Floods", ["1941 Huaraz Glacial Lake Flood", "1985 Dig Tsho Glacial Lake Flood", "2013 Kedarnath Floods", "2016 Gongbatongsha Glacial Flood", "2021 Chamoli Flood", "Other Glacial Lake Floods"]),
  branch("Floods, Crop Failure, and Famine", ["1931 China Floods and Famine", "1876–1878 Global Drought and Famine", "1887 Yellow River Flood and Famine", "1938 Yellow River Flood and Displacement", "1959–1961 China Food Crisis", "2022 Pakistan Floods and Food Insecurity", "Other Flood-Driven Famines"]),
  "Other Major Floods"
];

const TROPICAL_CYCLONES: TopicSeed[] = [
  branch("Bay of Bengal Cyclones", ["1737 Calcutta Cyclone", "1876 Bengal Cyclone", "1881 Haiphong Typhoon", "1942 Bengal Cyclone", "1970 Bhola Cyclone", "1991 Bangladesh Cyclone", "2007 Cyclone Sidr", "2008 Cyclone Nargis", "2020 Cyclone Amphan", "Other Bay of Bengal Cyclones"]),
  branch("Western Pacific Typhoons", ["1881 Haiphong Typhoon", "1912 Hong Kong Typhoon", "1959 Miyakojima Typhoon", "1970 Typhoon Sening", "1991 Thelma Tropical Storm", "2013 Typhoon Haiyan", "2018 Typhoon Mangkhut", "Other Western Pacific Typhoons"]),
  branch("Atlantic Hurricanes", ["1780 Great Hurricane", "1900 Galveston Hurricane", "1928 Okeechobee Hurricane", "1935 Labor Day Hurricane", "1969 Hurricane Camille", "1998 Hurricane Mitch", "2005 Hurricane Katrina", "2017 Hurricane Maria", "2022 Hurricane Ian", "Other Atlantic Hurricanes"]),
  branch("Indian Ocean and Southern Hemisphere Cyclones", ["1892 Mauritius Cyclone", "1960 Cyclone of 1960", "1974 Cyclone Tracy", "1999 Odisha Cyclone", "2006 Cyclone Monica", "2016 Cyclone Winston", "2019 Cyclone Idai", "2023 Cyclone Freddy", "Other Southern Hemisphere Cyclones"]),
  branch("Storm Surges and Cyclone Famine", ["1970 Bhola Cyclone and Coastal Famine", "1991 Bangladesh Cyclone and Food Crisis", "2008 Nargis and Myanmar Food Crisis", "2013 Haiyan and Philippine Food Disruption", "2019 Idai and Mozambique Food Insecurity", "Other Cyclone-Driven Famines"]),
  "Other Major Tropical Cyclones"
];

const DROUGHTS_AND_FAMINES: TopicSeed[] = [
  branch("Multiyear Droughts", ["4.2-Kiloyear Event", "Late Antique Little Ice Age Droughts", "Medieval Megadroughts", "Ming Dynasty Droughts", "1876–1878 Great Drought", "1930s Dust Bowl Drought", "1950s Great Plains Drought", "2011–2016 California Drought", "Other Multiyear Droughts"]),
  branch("Monsoon Failure and South Asian Famines", ["Great Bengal Famine of 1770", "Agra Famine of 1837–1838", "Upper Doab Famine of 1860–1861", "Indian Famine of 1876–1878", "Indian Famine of 1896–1897", "Indian Famine of 1899–1900", "Bengal Famine of 1943", "1972 Maharashtra Drought", "Other South Asian Famines"]),
  branch("Chinese Famines and Food-System Collapse", ["1630s Ming Famine", "1876–1879 Northern Chinese Famine", "1928–1930 Chinese Famine", "1936 Sichuan Famine", "1959–1961 Great Chinese Famine", "1970s Sahel-Linked Food Crisis", "Other Chinese Famines"]),
  branch("European and Eurasian Famines", ["Great Famine of 1315–1317", "Russian Famine of 1601–1603", "Great Famine of Ireland", "Russian Famine of 1891–1892", "Persian Famine of 1917–1919", "Soviet Famine of 1932–1933", "Dutch Famine of 1944–1945", "North Korean Famine", "Other European and Eurasian Famines"]),
  branch("African Famines and Sahel Droughts", ["Ethiopian Famine of 1888–1892", "Sahel Drought of 1910–1915", "Ethiopian Famine of 1973–1974", "Sahel Drought of 1968–1974", "Ethiopian Famine of 1983–1985", "Sudan Famine of 1984–1985", "Somalia Famine of 2011", "Horn of Africa Drought of 2020–2023", "Other African Famines"]),
  branch("Middle Eastern and American Drought Crises", ["Persian Famine of 1917–1919", "Levant Famine of World War I", "Dust Bowl", "1930s Canadian Prairies Drought", "1950s Texas Drought", "2010 Russian Drought and Heatwave", "Other Drought Crises"]),
  branch("Desertification and Land Degradation", ["Dust Bowl Soil Erosion", "Sahel Desertification", "Aral Sea Shrinkage", "Great Chinese Dust Storms", "Mongolian Zud and Rangeland Loss", "Soviet Virgin Lands Erosion", "Other Desertification Crises"]),
  "Other Major Droughts and Famines"
];

const WILDFIRES: TopicSeed[] = [
  branch("Forest and Crown Fires", ["1871 Peshtigo Fire", "1894 Great Hinckley Fire", "1910 Great Fire", "1939 Black Friday Bushfires", "1952 Escuminac Fire", "1988 Yellowstone Fires", "2009 Black Saturday Bushfires", "2019–2020 Australian Bushfires", "Other Forest Fire Disasters"]),
  branch("Grassland and Peat Fires", ["1871 Great Michigan Fires", "1930s Dust Bowl Fires", "1950s Great Plains Fires", "1997 Indonesian Peat Fires", "2015 Indonesian Fires", "2023 Canadian Wildfires", "Other Grassland and Peat Fires"]),
  branch("Urban and Firestorm Disasters", ["1906 San Francisco Fire", "1945 Tokyo Firebombing Firestorm", "1943 Hamburg Firestorm", "1945 Dresden Firestorm", "1988 Yellowstone Firestorm", "2018 Camp Fire", "2023 Maui Wildfires", "Other Urban Wildfires"]),
  branch("Wildfire Smoke and Famine", ["1815 Tambora Ash and Crop Failure", "1910 Great Fire Smoke Crisis", "1997 Southeast Asian Haze and Food Disruption", "2019–2020 Australian Fire Season and Agriculture", "2023 Canadian Smoke Season", "Other Smoke and Food-System Crises"]),
  "Other Major Wildfires"
];

const LANDSLIDES_AND_AVALANCHES: TopicSeed[] = [
  branch("Earthquake-Induced Landslides", ["1920 Haiyuan Landslides", "1970 Ancash Earthquake Avalanche", "2005 Kashmir Landslides", "2008 Sichuan Landslides", "2015 Nepal Landslides", "2023 Turkey–Syria Landslides", "Other Earthquake Landslides"]),
  branch("Mudflows and Debris Flows", ["1985 Armero Tragedy", "1999 Vargas Tragedy", "2010 Zhouqu Mudslide", "2014 Oso Mudslide", "2017 Freetown Mudslide", "2021 Atami Mudslide", "2023 Derna Debris Flow", "Other Mudflows"]),
  branch("Rockfalls and Mountain Collapses", ["1963 Vajont Landslide", "1980 Mount St. Helens Debris Avalanche", "2008 Frank Slide-Style Mountain Failures", "2014 Mount Ontake Debris Flows", "2017 Xinmo Landslide", "2021 Chamoli Rock and Ice Avalanche", "Other Mountain Collapses"]),
  branch("Snow and Ice Avalanches", ["1916 White Friday Avalanches", "1954 Blons Avalanche", "1970 Huascarán Avalanche", "1999 Galtür Avalanche", "2010 Afghanistan Avalanches", "2015 Panjshir Avalanches", "Other Deadly Avalanches"]),
  "Other Landslides and Avalanches"
];

const EXTREME_WEATHER: TopicSeed[] = [
  branch("Extreme Heat", ["1540 European Drought and Heat", "1936 North American Heat Wave", "1995 Chicago Heat Wave", "2003 European Heat Wave", "2010 Russian Heat Wave", "2015 Indian Heat Wave", "2021 Pacific Northwest Heat Dome", "2022 European Heat Waves", "2023 Global Heat Extremes", "Other Deadly Heat Waves"]),
  branch("Extreme Cold and Blizzards", ["1888 Great Blizzard", "1899 Great Blizzard", "1921 Iran Blizzard", "1941–1942 Soviet Winter", "1972 Iran Blizzard", "1985 North American Cold Wave", "2010 East Asian Cold Wave", "2021 Texas Cold Wave", "Other Deadly Cold Waves"]),
  branch("Hail, Lightning, and Downbursts", ["1972 Moradabad Hailstorm", "1986 Bangladesh Hailstorm", "1999 Sydney Hailstorm", "2011 India Lightning Disaster", "2017 Bangladesh Lightning Disaster", "2020 Bihar Lightning Disaster", "Other Severe Convective Storms"]),
  branch("Weather-Driven Crop Failures", ["1816 Year Without a Summer", "1876–1878 Global Famine", "1930s Dust Bowl", "1943 Bengal Famine Weather Shock", "1959–1961 China Food Crisis", "2010 Russian Heatwave and Grain Crisis", "Other Weather Crop Failures"]),
  "Other Extreme Weather Events"
];

const TORNADOES_AND_STORMS: TopicSeed[] = [
  branch("Tornado Outbreaks", ["1925 Tri-State Tornado", "1936 Tupelo–Gainesville Tornado Outbreak", "1974 Super Outbreak", "1989 Daulatpur–Saturia Tornado", "1999 Oklahoma Tornado Outbreak", "2011 Super Outbreak", "2011 Joplin Tornado", "2013 Moore Tornado", "Other Deadly Tornadoes"]),
  branch("Severe Thunderstorm Outbreaks", ["1927 Great Mississippi Flood Storms", "1974 Super Outbreak", "1980 United States Derecho", "2009 Southern India Storms", "2010 China Severe Storms", "2019 Southern Plains Storms", "Other Severe Thunderstorm Outbreaks"]),
  branch("Winter Storms and Ice Storms", ["1998 North American Ice Storm", "2008 Afghanistan Winter Storm", "2010 European Winter Storms", "2014 North American Polar Vortex", "2021 Texas Winter Storm", "Other Winter Storm Disasters"]),
  "Other Major Tornadoes and Storms"
];

const SPACE_WEATHER: TopicSeed[] = [
  branch("Geomagnetic Storms", ["1859 Carrington Event", "1872 Chapman–Silverman Storm", "1921 New York Railroad Storm", "1989 Quebec Geomagnetic Storm", "2003 Halloween Solar Storms", "2012 Near-Miss Solar Storm", "2024 Mother's Day Geomagnetic Storm", "Other Geomagnetic Storms"]),
  branch("Solar Flares and Radiation Storms", ["1859 Carrington Solar Flare", "1972 Solar Proton Event", "1989 Solar Storm", "2003 Halloween Solar Flares", "2017 Solar Storm", "Other Solar Radiation Events"]),
  "Other Space-Weather Events"
];

const NATURAL_DISASTER_TOPIC: TopicSeed = branch("Natural Disasters", [
  branch("Earthquakes", EARTHQUAKES),
  branch("Volcanic Eruptions", VOLCANIC_ERUPTIONS),
  branch("Tsunamis", TSUNAMIS),
  branch("Floods", FLOODS),
  branch("Tropical Cyclones and Storm Surges", TROPICAL_CYCLONES),
  branch("Droughts, Famines, and Desertification", DROUGHTS_AND_FAMINES),
  branch("Wildfires", WILDFIRES),
  branch("Landslides, Mudflows, and Avalanches", LANDSLIDES_AND_AVALANCHES),
  branch("Extreme Heat, Cold, and Blizzards", EXTREME_WEATHER),
  branch("Tornadoes and Severe Storms", TORNADOES_AND_STORMS),
  branch("Space Weather", SPACE_WEATHER),
  branch("Natural Hazard Cascades", ["Earthquake–Tsunami Cascades", "Earthquake–Landslide Cascades", "Volcano–Lahar Cascades", "Volcano–Famine Cascades", "Cyclone–Flood Cascades", "Drought–Wildfire Cascades", "Heat–Drought Cascades", "Flood–Disease Cascades", "Other Compound Disasters"]),
  branch("Disaster Risk and Recovery", ["Early Warning Systems", "Disaster Preparedness", "Evacuation", "Emergency Shelters", "Search and Rescue", "Disaster Relief", "Reconstruction", "Disaster Memory", "Risk Reduction"]),
  "Other Natural Disasters"
]);

const POPULATION_COLLAPSE_TOPIC: TopicSeed = branch("Population Collapse and Decline", [
  branch("Disease and Epidemic Declines", ["Plague of Athens", "Antonine Plague", "Plague of Cyprian", "Plague of Justinian", "Black Death", "Cocoliztli Epidemics", "Smallpox in the Americas", "Columbian Exchange Population Collapse", "1918 Influenza Pandemic", "HIV/AIDS Population Impact", "COVID-19 Population Impact", "Other Disease-Driven Declines"]),
  branch("Famine and Food-System Collapse", ["Great Famine of 1315–1317", "Great Bengal Famine of 1770", "Great Famine of Ireland", "Indian Famine of 1876–1878", "Persian Famine of 1917–1919", "Soviet Famine of 1932–1933", "Bengal Famine of 1943", "Great Chinese Famine of 1959–1961", "North Korean Famine", "Ethiopian Famine of 1983–1985", "Somalia Famine of 2011", "Other Famine-Driven Declines"]),
  branch("War and Political Catastrophe", ["An Lushan Rebellion Population Losses", "Mongol Conquests Population Losses", "Thirty Years' War Population Losses", "Taiping Rebellion Population Losses", "World War I and Influenza Population Shock", "World War II Population Losses", "Partition of India Population Displacement", "Cambodian Genocide", "Rwandan Genocide", "Other War-Driven Declines"]),
  branch("Climate and Environmental Shocks", ["4.2-Kiloyear Event", "Late Antique Little Ice Age", "Medieval Megadroughts", "Maya Droughts and Classic Collapse", "Cahokia Population Decline", "Greenland Norse Decline", "Ancestral Puebloan Population Changes", "Aral Sea Environmental Collapse", "Dust Bowl Migration", "Other Environmental Declines"]),
  branch("Ancient and Medieval Regional Collapses", ["Akkadian Empire Collapse", "Indus Valley Urban Decline", "Minoan Palatial Collapse", "Late Bronze Age Collapse", "Tiwanaku Decline", "Classic Maya Collapse", "Angkor Population Decline", "Cahokia Decline", "Norse Greenland Abandonment", "Rapa Nui Population Crisis", "Other Regional Collapses"]),
  branch("Modern Population Decline", ["Japan's Population Decline", "Italy's Population Decline", "Bulgaria's Population Decline", "Latvia's Population Decline", "Eastern Europe Population Decline", "China's Population Decline", "South Korea's Low Birth Rate", "Rural Depopulation", "Aging Populations", "Migration and Population Loss", "Other Modern Declines"]),
  branch("Human Population Bottlenecks", ["Late Pleistocene Human Bottlenecks", "Toba Bottleneck Hypothesis", "Y-Chromosome Bottleneck Hypothesis", "Founder Effects in Human Populations", "Small-Population Genetic Drift", "Other Bottleneck Hypotheses"]),
  "Other Population Collapses and Declines"
]);

const DINOSAURS_TRIASSIC = ["Eoraptor", "Herrerasaurus", "Coelophysis", "Plateosaurus", "Riojasaurus", "Saturnalia", "Mussaurus", "Thecodontosaurus", "Liliensternus", "Guaibasaurus", "Chindesaurus", "Staurikosaurus", "Panphagia", "Buriolestes", "Gnathovorax", "Nyasasaurus", "Tawa", "Zupaysaurus", "Coloradisaurus", "Pisanosaurus"];
const DINOSAURS_JURASSIC = ["Dilophosaurus", "Scelidosaurus", "Massospondylus", "Vulcanodon", "Megalosaurus", "Allosaurus", "Ceratosaurus", "Stegosaurus", "Brachiosaurus", "Diplodocus", "Apatosaurus", "Camarasaurus", "Compsognathus", "Archaeopteryx", "Ornitholestes", "Mamenchisaurus", "Supersaurus", "Torvosaurus", "Metriacanthosaurus", "Eustreptospondylus"];
const DINOSAURS_CRETACEOUS = ["Tyrannosaurus", "Triceratops", "Velociraptor", "Deinonychus", "Spinosaurus", "Giganotosaurus", "Ankylosaurus", "Parasaurolophus", "Hadrosaurus", "Iguanodon", "Utahraptor", "Carnotaurus", "Argentinosaurus", "Patagotitan", "Baryonyx", "Suchomimus", "Therizinosaurus", "Oviraptor", "Protoceratops", "Microraptor"];

const EXTINCT_MAMMALS: TopicSeed[] = [
  branch("Proboscideans", ["Woolly Mammoth", "Columbian Mammoth", "Steppe Mammoth", "Palaeoloxodon", "Straight-Tusked Elephant", "American Mastodon", "Gomphotherium", "Deinotherium", "Cuvieronius", "Dwarf Elephants", "Other Extinct Proboscideans"]),
  branch("Ground Sloths", ["Megatherium", "Mylodon", "Eremotherium", "Nothrotheriops", "Megalonyx", "Other Ground Sloths"]),
  branch("Saber-Toothed Mammals", ["Smilodon", "Homotherium", "Megantereon", "Thylacosmilus", "Barbourofelis", "Other Saber-Toothed Mammals"]),
  branch("Marsupials and Australian Megafauna", ["Thylacine", "Diprotodon", "Procoptodon", "Thylacoleo", "Palorchestes", "Giant Short-Faced Kangaroo", "Genyornis", "Tasmanian Emu", "Other Australian Megafauna"]),
  branch("Hoofed Mammals", ["Irish Elk", "Quagga", "Aurochs", "Bluebuck", "Western Black Rhinoceros", "Woolly Rhinoceros", "Elasmotherium", "Sivatherium", "Tarpan", "Other Extinct Hoofed Mammals"]),
  branch("Extinct Carnivores", ["Cave Lion", "Cave Bear", "Falkland Islands Wolf", "Japanese Wolf", "Caribbean Monk Seal", "Arctodus", "American Cheetah", "Other Extinct Carnivores"]),
  branch("Extinct Primates and Rodents", ["Jamaican Monkey", "Caribbean Sloth", "Giant Beaver", "Josephoartigasia", "Hispaniolan Hutia", "Lesser Antillean Macaw", "Other Extinct Primates and Rodents"]),
  "Other Extinct Mammals"
];

const EXTINCT_BIRDS: TopicSeed[] = [
  branch("Island Birds", ["Dodo", "Rodrigues Solitaire", "Great Auk", "Moa", "Haast's Eagle", "Elephant Birds", "Hawaiian Crow", "Labrador Duck", "Chatham Rail", "Stephens Island Wren", "Other Extinct Island Birds"]),
  branch("Pigeons, Parrots, and Songbirds", ["Passenger Pigeon", "Carolina Parakeet", "Cuban Macaw", "Paradise Parrot", "Poʻouli", "Bachman's Warbler", "Hawaiian Mamo", "Seychelles Parakeet", "Other Extinct Birds"]),
  branch("Extinct Waterbirds and Seabirds", ["Finsch's Duck", "New Zealand Swan", "Jamaican Petrel", "Dusky Seaside Sparrow", "Alaotra Grebe", "Milford Sound Penguin", "Other Extinct Waterbirds"]),
  "Other Extinct Birds"
];

const EXTINCT_REPTILES_AMPHIBIANS: TopicSeed[] = [
  branch("Giant Tortoises and Turtles", ["Pinta Giant Tortoise", "Rodrigues Giant Tortoise", "Réunion Giant Tortoise", "Mauritius Giant Tortoise", "Cylindraspis Tortoises", "Giant Galápagos Tortoise Lineages", "Other Extinct Tortoises"]),
  branch("Extinct Lizards and Snakes", ["Jamaican Giant Galliwasp", "Rodrigues Giant Skink", "Cape Verde Giant Skink", "Waiheke Island Skink", "Other Extinct Reptiles"]),
  branch("Extinct Amphibians", ["Golden Toad", "Gastric-Brooding Frog", "Southern Gastric-Brooding Frog", "Lake Titicaca Water Frog Lineages", "Holdridge's Toad", "Other Extinct Amphibians"]),
  "Other Extinct Reptiles and Amphibians"
];

const EXTINCT_FISH_AQUATIC: TopicSeed[] = [
  branch("Extinct Freshwater Fish", ["Chinese Paddlefish", "Baiji", "Tecopa Pupfish", "Blue Walleye", "New Zealand Grayling", "Thicktail Chub", "Blackfin Cisco", "Other Extinct Freshwater Fish"]),
  branch("Prehistoric Fish", ["Dunkleosteus", "Megalodon", "Helicoprion", "Xiphactinus", "Bothriolepis", "Titanichthys", "Other Prehistoric Fish"]),
  branch("Marine Reptiles", ["Ichthyosaurs", "Plesiosaurs", "Pliosaurs", "Mosasaurs", "Thalattosaurs", "Placodonts", "Other Extinct Marine Reptiles"]),
  branch("Extinct Marine Mammals", ["Steller's Sea Cow", "Caribbean Monk Seal", "Japanese Sea Lion", "Other Extinct Marine Mammals"]),
  "Other Extinct Aquatic Animals"
];

const EXTINCT_INVERTEBRATES: TopicSeed[] = [
  branch("Trilobites", ["Olenellus", "Paradoxides", "Asaphus", "Isotelus", "Calymene", "Other Trilobite Groups"]),
  branch("Ammonites and Belemnites", ["Ammonites", "Goniatites", "Baculites", "Scaphites", "Belemnites", "Other Extinct Cephalopods"]),
  branch("Eurypterids and Sea Scorpions", ["Jaekelopterus", "Pterygotus", "Eurypterus", "Megalograptus", "Other Eurypterids"]),
  branch("Other Extinct Invertebrates", ["Graptolites", "Rugose Corals", "Tabulate Corals", "Archaeocyathids", "Anomalocaris", "Opabinia", "Hallucigenia", "Other Extinct Invertebrates"])
];

const RECENT_EXTINCTIONS: TopicSeed[] = [
  branch("Declared Extinct or Extinct in the Wild Since 2006", ["Bramble Cay Melomys", "Christmas Island Pipistrelle", "Alaotra Grebe", "Pinta Giant Tortoise", "Chinese Paddlefish", "Other Recent Declared Extinctions"]),
  branch("Functionally Extinct, Presumed Extinct, or Extinct in the Wild", ["Baiji", "Poʻouli", "Bachman's Warbler", "Ivory-Billed Woodpecker", "Northern White Rhinoceros", "Yangtze Giant Softshell Turtle", "Spix's Macaw in the Wild", "Other Presumed or Functional Extinctions"]),
  branch("Recent Local and Island Extinctions", ["Christmas Island Skink", "Christmas Island Shrew", "Western Black Rhinoceros", "Pinta Giant Tortoise", "Hawaiian Crow in the Wild", "Other Recent Local Extinctions"]),
  "Other Recent Extinctions"
];

const SPECIFIC_EXTINCTION_EVENTS: TopicSeed[] = [
  branch("End-Ordovician Extinction", ["Trilobite Groups", "Graptolites", "Brachiopod Groups", "Conodont Groups", "Reef-Building Organisms", "Other End-Ordovician Losses"]),
  branch("Late Devonian Extinction", ["Dunkleosteus", "Titanichthys", "Bothriolepis", "Placoderm Groups", "Devonian Reef Builders", "Trilobite Groups", "Other Late Devonian Losses"]),
  branch("End-Permian Extinction", ["Gorgonopsians", "Dinocephalians", "Eurypterids", "Many Trilobite Groups", "Permian Ammonoids", "Rugose Corals", "Other End-Permian Losses"]),
  branch("End-Triassic Extinction", ["Phytosaurs", "Aetosaurs", "Postosuchus", "Placerias", "Triassic Ammonoids", "Many Conodonts", "Other End-Triassic Losses"]),
  branch("End-Cretaceous Extinction", ["Tyrannosaurus", "Triceratops", "Ankylosaurus", "Edmontosaurus", "Pachycephalosaurus", "Mosasaurus", "Pteranodon", "Ammonites", "Belemnites", "Other End-Cretaceous Losses"]),
  branch("Eocene–Oligocene Grande Coupure", ["Brontotheres", "Embolotherium", "Hyaenodonts", "Early Rhinocerotids", "Other Grande Coupure Losses"]),
  branch("Pleistocene Megafaunal Extinction", ["Woolly Mammoth", "Mastodon", "Megatherium", "Smilodon", "Irish Elk", "Cave Bear", "Diprotodon", "Procoptodon", "Moa", "Haast's Eagle", "Other Pleistocene Losses"]),
  branch("Holocene Island Extinction Waves", ["Dodo", "Rodrigues Solitaire", "Great Auk", "Passenger Pigeon", "Carolina Parakeet", "Pinta Giant Tortoise", "Steller's Sea Cow", "Thylacine", "Other Holocene Island Losses"]),
  branch("Current Biodiversity Loss and Anthropocene Extinction", ["Bramble Cay Melomys", "Chinese Paddlefish", "Christmas Island Pipistrelle", "Alaotra Grebe", "Poʻouli", "Bachman's Warbler", "Ivory-Billed Woodpecker", "Other Anthropocene Losses"]),
  "Other Specific Extinction Events"
];

const EXTINCTION_CAUSES: TopicSeed[] = [
  branch("Habitat Loss", ["Deforestation Extinctions", "Wetland Drainage Extinctions", "Island Habitat Loss", "Grassland Conversion", "Coral Reef Loss", "Other Habitat-Driven Extinctions"]),
  branch("Overhunting and Overfishing", ["Passenger Pigeon Hunting", "Great Auk Hunting", "Steller's Sea Cow Hunting", "Moa Hunting", "Megalodon Prey Collapse", "Other Overexploitation Extinctions"]),
  branch("Invasive Species", ["Island Bird Extinctions", "New Zealand Bird Losses", "Guam Bird Extinctions", "Snake-Driven Island Losses", "Introduced Mammal Impacts", "Other Invasive-Species Extinctions"]),
  branch("Disease and Pathogens", ["Amphibian Chytrid Extinctions", "Avian Malaria", "Tasmanian Devil Disease Risk", "Island Bird Disease", "Other Disease-Driven Extinctions"]),
  branch("Climate Change", ["Pleistocene Climate Change", "Coral Bleaching and Loss", "Sea-Level Change Extinctions", "Warming-Driven Range Loss", "Other Climate-Driven Extinctions"]),
  branch("Pollution and Environmental Change", ["Pesticide-Driven Declines", "Plastic and Marine Pollution", "Acid Rain Extinctions", "Toxic Mine Waste", "Other Pollution-Driven Extinctions"]),
  branch("Population Bottlenecks and Coextinction", ["Genetic Bottlenecks", "Inbreeding Depression", "Host-Dependent Extinctions", "Pollinator Loss", "Food-Web Collapse", "Other Ecological Extinctions"])
];

const EXTINCT_LIFE_TOPIC: TopicSeed = branch("Extinction Events and Extinct Life", [
  branch("Mass Extinction Events", ["End-Ordovician Extinction", "Late Devonian Extinction", "End-Permian Extinction", "End-Triassic Extinction", "End-Cretaceous Extinction", "Holocene Extinction", "Sixth Mass Extinction Debate", "Other Mass Extinctions"]),
  branch("Extinction Events by Earth History", [
    branch("Precambrian and Early Paleozoic", ["Great Oxidation Event", "Ediacaran Biota Decline", "Cambrian Extinction Events", "End-Ordovician Extinction", "Other Early Extinction Events"]),
    branch("Late Paleozoic", ["Late Devonian Extinction", "Carboniferous Rainforest Collapse", "End-Permian Extinction", "Other Paleozoic Extinction Events"]),
    branch("Mesozoic", ["End-Triassic Extinction", "Jurassic Marine Turnover", "Cretaceous Oceanic Anoxic Events", "End-Cretaceous Extinction", "Other Mesozoic Extinction Events"]),
    branch("Cenozoic", ["Paleocene–Eocene Thermal Maximum Turnover", "Eocene–Oligocene Grande Coupure", "Miocene Extinction Events", "Pliocene Marine Megafauna Loss", "Other Cenozoic Extinction Events"]),
    branch("Quaternary and Holocene", ["Pleistocene Megafaunal Extinction", "Holocene Island Extinction Waves", "Current Biodiversity Loss", "Other Quaternary Extinction Events"])
  ]),
  branch("Dinosaurs by Period", [
    branch("Triassic Dinosaurs", DINOSAURS_TRIASSIC),
    branch("Jurassic Dinosaurs", DINOSAURS_JURASSIC),
    branch("Cretaceous Dinosaurs", DINOSAURS_CRETACEOUS),
    branch("Other Dinosaur Taxa", ["Other Triassic Dinosaurs", "Other Jurassic Dinosaurs", "Other Cretaceous Dinosaurs"])
  ]),
  branch("Extinct Animals by Group", [
    branch("Extinct Mammals", EXTINCT_MAMMALS),
    branch("Extinct Birds", EXTINCT_BIRDS),
    branch("Extinct Reptiles and Amphibians", EXTINCT_REPTILES_AMPHIBIANS),
    branch("Extinct Fish and Aquatic Animals", EXTINCT_FISH_AQUATIC),
    branch("Extinct Invertebrates", EXTINCT_INVERTEBRATES),
    branch("Recent Extinctions", RECENT_EXTINCTIONS),
    "Other Extinct Animals"
  ]),
  branch("Specific Extinction Events and Their Animals", SPECIFIC_EXTINCTION_EVENTS),
  branch("Why Extinctions Happen", EXTINCTION_CAUSES),
  branch("Extinction Evidence and Recovery", ["Fossils", "Stratigraphy", "Ancient DNA", "Subfossils", "Lazarus Taxa", "De-Extinction Debate", "Rewilding", "Species Recovery", "Other Extinction Evidence"]),
  "Other Extinct Life"
]);

export function buildNaturalDisasterAndExtinctionTopics(): TopicSeed[] {
  return [NATURAL_DISASTER_TOPIC, POPULATION_COLLAPSE_TOPIC, EXTINCT_LIFE_TOPIC];
}

export const NATURAL_DISASTER_CATALOG_SOURCES = [
  "https://www.usgs.gov/mission-areas/natural-hazards",
  "https://www.usgs.gov/science/science-explorer/natural-hazards/studying-and-responding-to-disasters",
  "https://www.nps.gov/subjects/fossils/mass-extinctions-through-geologic-time.htm",
  "https://www.nhm.ac.uk/discover/when-did-dinosaurs-live.html",
  "https://repository.library.noaa.gov/view/noaa/48315"
] as const;
