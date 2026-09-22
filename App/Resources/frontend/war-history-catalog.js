(function () {
  "use strict";

  function branch(label, children, aliases) {
    var result = { label: label, children: children };
    if (aliases && aliases.length) result.aliases = aliases;
    return result;
  }
  function grouped(label, sections) {
    return branch(label, sections.map(function (section) { return branch(section[0], section[1]); }));
  }
  var study = ["Origins and Causes", "Participants and Alliances", "Major Battles and Campaigns", "Civilian Life and Home Fronts", "Treaties and Outcomes", "Memory and Legacy"];
  function conflict(label, extra) { return branch(label, study.concat(extra || [])); }

  var ancientMediterranean = grouped("Ancient Mediterranean", [
    ["Greek and Persian Wars", ["Ionian Revolt", "Battle of Marathon", "Battle of Thermopylae", "Battle of Artemisium", "Battle of Salamis", "Battle of Plataea", "Battle of Mycale", "First Persian Invasion of Greece", "Second Persian Invasion of Greece"]],
    ["Greek Civil and Inter-Polis Wars", ["Peloponnesian War", "First Peloponnesian War", "Archidamian War", "Sicilian Expedition", "Decelean War", "Corinthian War", "Boeotian War", "Sacred War", "Third Sacred War", "Lamian War", "Social War"]],
    ["Macedonian and Hellenistic Wars", ["Macedonian Wars", "First Macedonian War", "Second Macedonian War", "Third Macedonian War", "Fourth Macedonian War", "Wars of the Diadochi", "Syrian Wars", "Macedonian–Spartan Wars"]],
    ["Roman Conquests and Civil Wars", ["Roman–Samnite Wars", "Latin War", "Pyrrhic War", "Punic Wars", "First Punic War", "Second Punic War", "Third Punic War", "Roman–Seleucid War", "Gallic Wars", "Roman Civil Wars", "Caesar's Civil War", "Liberators' Civil War", "Year of the Four Emperors", "Crisis of the Third Century", "Jewish–Roman Wars", "Great Jewish Revolt", "Bar Kokhba Revolt", "Boudican Revolt", "Dacian Wars", "Marcomannic Wars", "Roman–Persian Wars"]]
  ]);

  var roses = branch("Wars of the Roses", ["Lancastrian and Yorkist Factions", "First Battle of St Albans", "Battle of Blore Heath", "Battle of Ludford Bridge", "Battle of Northampton", "Battle of Wakefield", "Battle of Mortimer's Cross", "Second Battle of St Albans", "Battle of Towton", "Battle of Hedgeley Moor", "Battle of Hexham", "Battle of Edgecote Moor", "Battle of Losecoat Field", "Battle of Barnet", "Battle of Tewkesbury", "Battle of Bosworth Field", "Battle of Stoke Field", "The Princes in the Tower", "Richard III and the Yorkists", "Henry VII and the Tudor Settlement"], ["War of the Roses"]);
  var frenchWars = branch("French Wars", [
    branch("French Wars and External Campaigns", ["Frankish Wars", "Merovingian Civil Wars", "Carolingian Civil Wars", "Albigensian Crusade", "Hundred Years' War", "Italian Wars", "French–Habsburg Wars", "Thirty Years' War", "War of Devolution", "Franco-Dutch War", "Nine Years' War", "War of the Spanish Succession", "War of the Austrian Succession", "Seven Years' War", "French Revolutionary Wars", "Napoleonic Wars", "Peninsular War", "Franco-Prussian War", "First Indochina War", "Algerian War", "Suez Crisis", "French Resistance"]),
    branch("French Civil Wars", [
      branch("French Wars of Religion", ["First French War of Religion", "Second French War of Religion", "Third French War of Religion", "Fourth French War of Religion", "Fifth French War of Religion", "Sixth French War of Religion", "Seventh French War of Religion", "Eighth French War of Religion", "Huguenot Rebellions", "St. Bartholomew's Day Massacre", "Battle of Dreux", "Battle of Jarnac", "Battle of Moncontour", "Siege of La Rochelle", "War of the Three Henrys"]),
      conflict("Fronde", [branch("Fronde Episodes", ["Parliamentary Fronde", "Princes' Fronde", "Siege of Paris", "Battle of Rethel"])]),
      branch("French Revolution Civil Conflicts", ["Revolt of Lyon Against the National Convention", "War in the Vendée", "Chouannerie", "Federalist Revolts", "Siege of Toulon", "White Terror", "French Revolutionary Civil War"]),
      conflict("Paris Commune", ["Bloody Week", "Communards and Versailles", "Paris Commune Memory"]),
      "Resistance and Collaboration in France", "Corsican Conflict", "French Colonial Rebellions"
    ]),
    branch("Wars in French Colonial Territories", ["Haitian Revolution", "Saint-Domingue Expedition", "Madagascar Expeditions", "Moroccan Crises", "Cameroon Campaign", "Syrian Revolt", "Franco-Siamese War", "French–Vietnamese Wars"])
  ]);
  var britishIsles = branch("British Isles and Ireland", [
    grouped("Early and Medieval Britain", [
      ["Roman and Post-Roman Conflicts", ["Roman Invasion of Britain", "Boudican Revolt", "Roman Conquest of Wales", "Pictish Wars", "Saxon Wars in Britain"]],
      ["Anglo-Saxon and Viking Wars", ["Mercian Wars", "Viking Invasions of England", "Great Heathen Army", "Viking Invasions of Ireland", "Alfred the Great's Wars", "Danelaw Wars", "Battle of Brunanburh"]],
      ["Norman and Angevin Wars", ["Norman Conquest", "Harrying of the North", "Anarchy", "Welsh Wars of Edward I", "Scottish Wars of Independence", "First War of Scottish Independence", "Second War of Scottish Independence"]]
    ]),
    roses,
    branch("British Civil and Constitutional Wars", [conflict("Bishops' Wars"), conflict("British Civil Wars", [branch("Key Engagements", ["Battle of Edgehill", "Battle of Marston Moor", "Battle of Naseby", "Battle of Preston", "Battle of Dunbar", "Battle of Worcester"])]), "First English Civil War", "Second English Civil War", "Third English Civil War", "Irish Confederate Wars", "Scottish Civil War", "Wars of the Three Kingdoms", "Glorious Revolution", "Jacobite Rising of 1689", "Jacobite Rising of 1715", "Jacobite Rising of 1745", "Irish Rebellion of 1798", "Irish War of Independence", "Irish Civil War", "The Troubles", "Easter Rising"]),
    branch("Anglo-French and European Wars", ["Hundred Years' War", "Armagnac–Burgundian Civil War", "Nine Years' War", "War of the Spanish Succession", "Seven Years' War", "Napoleonic Wars", "Crimean War", "First World War", "Second World War", "Falklands War"]),
    branch("Colonial and Overseas Wars", ["King Philip's War", "Queen Anne's War", "King George's War", "French and Indian War", "American Revolutionary War", "Anglo-Zulu War", "First Boer War", "Second Boer War", "Mau Mau Uprising", "Malayan Emergency", "Suez Crisis", "Falklands War"])
  ]);
  var europe = branch("Europe", [
    ancientMediterranean, britishIsles, frenchWars,
    grouped("Iberian Peninsula", [["Reconquista and Medieval Iberia", ["Umayyad Conquest of Hispania", "Reconquista", "Portuguese Reconquista", "Castilian Civil War", "Granada War"]], ["Modern Iberian Wars", ["War of the Portuguese Succession", "Portuguese Restoration War", "War of the Spanish Succession", "Peninsular War", "Carlist Wars", "First Carlist War", "Second Carlist War", "Third Carlist War", "Spanish Civil War", "Portuguese Colonial War", "Spanish–American War"]]]),
    grouped("Italy and the Mediterranean", [["Italian Wars", ["Sicilian Vespers", "War of the Sicilian Vespers", "War of the Eight Saints", "Venetian–Genoese Wars", "War of the League of Cambrai"]], ["Italian and Mediterranean Civil Conflicts", ["Italian Wars of Independence", "First Italian War of Independence", "Second Italian War of Independence", "Third Italian War of Independence", "Italian Civil War", "Years of Lead", "Greek Civil War", "Cyprus Conflict"]]]),
    grouped("Central Europe", [["Dynastic and Religious Wars", ["Thirty Years' War", "Schmalkaldic War", "War of the Austrian Succession", "Seven Years' War", "Napoleonic Wars", "Revolutions of 1848"]], ["World War Conflicts", ["Franco-Prussian War", "First World War", "Second World War"]]]),
    branch("Eastern Europe and the Balkans", ["Mongol Invasion of Europe", "Polish–Teutonic Wars", "Northern Crusades", "Deluge", "Khmelnytsky Uprising", "Great Northern War", "Partitions of Poland", "Kościuszko Uprising", "November Uprising", "January Uprising", "Russo-Turkish Wars", "Crimean War", "Caucasian War", "Russo-Japanese War", "Russian Civil War", "Finnish Civil War", "Balkan Wars", "First Balkan War", "Second Balkan War", "Greek–Turkish War", "Yugoslav Wars", "Bosnian War", "Kosovo War", "Russo-Ukrainian War", "Russo-Georgian War", "Transnistria War", "Nagorno-Karabakh Conflict"]),
    branch("Nordic and Baltic Conflicts", ["Kalmar War", "Northern Seven Years' War", "Torstenson War", "Scanian War", "Great Northern War", "Finnish War", "Dano-Swedish Wars", "Norwegian Campaign", "Winter War", "Continuation War", "Lapland War", "Estonian War of Independence", "Latvian War of Independence"])
  ]);

  var middleEast = branch("Middle East and North Africa", [
    branch("Ancient Near East", ["Sumerian Wars", "Akkadian Conquests", "Egyptian–Hittite Wars", "Battle of Kadesh", "Assyrian Wars", "Babylonian–Egyptian Wars", "Achaemenid Conquests", "Greco-Persian Wars"]),
    branch("Arabian and Islamic Conquests", ["Ridda Wars", "Arab Conquest of Persia", "Arab Conquest of Egypt", "Arab–Byzantine Wars", "Umayyad Civil Wars", "Abbasid Revolution", "Fitna", "Zanj Rebellion"]),
    branch("Crusades and Levantine Wars", ["First Crusade", "Second Crusade", "Third Crusade", "Fourth Crusade", "Fifth Crusade", "Sixth Crusade", "Seventh Crusade", "Mongol Invasions of the Levant", "Mamluk–Crusader Wars"]),
    branch("Ottoman, Persian, and Arabian Wars", ["Ottoman–Persian Wars", "Ottoman–Mamluk War", "Ottoman–Habsburg Wars", "Ottoman–Venetian Wars", "Wahhabi War", "Egyptian–Ottoman War", "Mahdist War", "Arab Revolt", "Saudi–Rashidi Wars", "North Yemen Civil War"]),
    branch("Modern Middle Eastern Conflicts", ["Turkish War of Independence", "Iranian Revolution", "Iran–Iraq War", "Arab–Israeli War", "1948 Palestine War", "Suez Crisis", "Six-Day War", "War of Attrition", "Yom Kippur War", "Lebanese Civil War", "First Intifada", "Second Intifada", "Gulf War", "Iraq War", "Syrian Civil War", "Yemeni Civil War", "Libyan Civil War", "War in Afghanistan"]),
    branch("North African Wars", ["Numidian Wars", "Punic Wars", "Barbary Wars", "Algerian War", "Tunisian Revolution", "Libyan–Chadian Conflict", "Western Sahara War", "Darfur War", "Egyptian Revolution", "Sinai Insurgency"])
  ]);
  var africa = branch("Africa", [
    branch("West and Central Africa", ["Ashanti Wars", "Anglo-Ashanti Wars", "Sokoto Jihad", "Fulani War", "Maji Maji Rebellion", "Biafran War", "Nigerian Civil War", "First Liberian Civil War", "Second Liberian Civil War", "Sierra Leone Civil War", "Central African Republic Civil War", "Chadian Civil War", "First Congo War", "Second Congo War"]),
    branch("East and Horn of Africa", ["Ethiopian–Adal War", "Mahdist War", "Ethiopian–Egyptian War", "First Italo-Ethiopian War", "Second Italo-Ethiopian War", "Eritrean War of Independence", "Ethiopian Civil War", "Somali Civil War", "Ogaden War", "Rwandan Civil War", "Rwandan Genocide", "Ugandan Bush War", "Lord's Resistance Army Insurgency"]),
    branch("Southern Africa", ["Xhosa Wars", "Anglo-Zulu War", "Basotho Wars", "First Boer War", "Second Boer War", "Herero Wars", "Mfecane", "Rhodesian Bush War", "Mozambican Civil War", "Angolan Civil War", "South African Border War", "Namibian War of Independence"]),
    branch("Anti-Colonial and Independence Wars", ["Algerian War", "Kenya Emergency", "Mau Mau Uprising", "Angolan War of Independence", "Mozambican War of Independence", "Guinea-Bissau War of Independence", "Zimbabwean War of Liberation", "South African Border War", "Namibian Independence War"]),
    branch("African Wars and Humanitarian Crises", ["Darfur Conflict", "Kivu Conflict", "Somali Famine and War", "Sudanese Civil Wars", "South Sudanese Civil War", "Mali War", "Boko Haram Insurgency", "Sahel Conflicts", "Tigray War", "Insurgency in Cabo Delgado"])
  ]);
  var southAsia = branch("South Asia", [
    branch("Ancient and Medieval South Asia", ["Kalinga War", "Mauryan Wars", "Indo-Greek Wars", "Kushan Wars", "Chola Invasions", "Chola–Srivijaya War", "Delhi Sultanate Wars", "Mughal Conquests", "Mughal–Rajput Wars", "Mughal–Maratha Wars", "Ahom–Mughal Wars", "Anglo-Afghan Wars"]),
    branch("Indian Regional and Colonial Wars", ["Anglo-Mysore Wars", "Anglo-Maratha Wars", "Anglo-Sikh Wars", "Pindari War", "Santal Rebellion", "Sepoy Rebellion", "Indian Rebellion of 1857", "Moplah Rebellion", "Ghadar Movement", "Royal Indian Navy Mutiny"]),
    branch("Partition and South Asian States", ["Partition of India", "Indo-Pakistani War of 1947", "Indo-Pakistani War of 1965", "Indo-Pakistani War of 1971", "Kargil War", "Bangladesh Liberation War", "Sri Lankan Civil War", "Nepalese Civil War", "Balochistan Conflicts"]),
    branch("Afghanistan and Himalayan Conflicts", ["First Anglo-Afghan War", "Second Anglo-Afghan War", "Third Anglo-Afghan War", "Soviet–Afghan War", "Afghan Civil War", "War in Afghanistan", "Kashmir Conflict", "Sino-Indian War", "Doklam Standoff"])
  ]);
  var eastAsia = branch("East Asia", [
    branch("Chinese Dynastic and Civil Wars", ["Spring and Autumn Wars", "Warring States Period", "Qin Wars of Unification", "Chu–Han Contention", "Three Kingdoms Wars", "War of the Eight Princes", "An Lushan Rebellion", "Five Dynasties and Ten Kingdoms Wars", "Song–Liao Wars", "Song–Jin Wars", "Mongol Conquest of China", "Red Turban Rebellion", "Ming–Qing Transition", "Three Feudatories Rebellion", "Taiping Rebellion", "Dungan Revolt", "Nian Rebellion", "Boxer Rebellion", "Chinese Civil War"]),
    branch("Korean Peninsula", ["Three Kingdoms of Korea Wars", "Goguryeo–Sui War", "Goryeo–Khitan Wars", "Mongol Invasions of Korea", "Imjin War", "First Manchu Invasion of Korea", "Second Manchu Invasion of Korea", "Korean War", "Korean Demilitarized Zone Conflict"]),
    branch("Japan and Ryukyu", ["Genpei War", "Mongol Invasions of Japan", "Nanboku-chō Wars", "Ōnin War", "Sengoku Period Wars", "Toyotomi Hideyoshi's Invasions of Korea", "Shimabara Rebellion", "Boshin War", "Satsuma Rebellion", "Russo-Japanese War", "Pacific War"]),
    branch("Modern East Asian Wars", ["First Sino-Japanese War", "Second Sino-Japanese War", "Soviet–Japanese War", "Chinese Civil War", "Korean War", "Vietnam War", "Sino-Indian War", "Sino-Soviet Border Conflict", "Sino-Vietnamese War", "Taiwan Strait Crises"]),
    branch("Tibetan, Mongolian, and Steppe Wars", ["Xiongnu–Han War", "Göktürk Civil Wars", "Mongol Conquests", "Timurid Wars", "Dzungar–Qing War", "Mongolian Revolution", "Tibetan–Ladakh War", "Soviet Invasion of Mongolia"])
  ]);
  var southeastAsia = branch("Southeast Asia", [
    branch("Mainland Southeast Asia", ["Khmer–Champa Wars", "Pagan–Mongol War", "Burmese–Siamese Wars", "Toungoo Wars", "Konbaung–Siam Wars", "Anglo-Burmese Wars", "Siamese–French War", "First Indochina War", "Vietnam War", "Cambodian Civil War", "Cambodian–Vietnamese War", "Laotian Civil War", "Myanmar Civil War"]),
    branch("Maritime Southeast Asia", ["Majapahit Wars", "Aceh War", "Java War", "Padri War", "Philippine–American War", "Philippine Revolution", "Indonesian National Revolution", "Malayan Emergency", "Brunei Revolt", "Konfrontasi", "East Timor Conflict", "Papua Conflict"]),
    branch("Anti-Colonial Wars", ["Philippine Revolution", "Vietnamese Declarations of Independence", "Indonesian War of Independence", "Burma Campaign", "Malayan Emergency", "Laotian Independence War", "Cambodian Independence Movement"])
  ]);
  var centralAsia = branch("Central Asia and the Steppe", ["Scythian Wars", "Saka Wars", "Xiongnu Wars", "Turkic Khaganate Wars", "Arab Conquest of Transoxiana", "Mongol Conquests", "Golden Horde Wars", "Timurid Wars", "Kazakh–Dzungar Wars", "Dzungar Genocide", "Russian Conquest of Central Asia", "Basmachi Revolt", "Soviet Central Asian Conflicts", "Tajikistani Civil War", "Kyrgyz Revolution", "Afghanistan–Central Asia Conflicts"]);
  var northAmerica = branch("North America", [
    branch("Indigenous and Colonial Wars", ["Beaver Wars", "Pequot War", "King Philip's War", "Tuscarora War", "Yamasee War", "Queen Anne's War", "King George's War", "French and Indian War", "Pontiac's War", "Dunmore's War", "Chickamauga Wars", "Seminole Wars", "Black Hawk War", "Navajo Wars", "Apache Wars", "Sioux Wars", "Modoc War", "Wounded Knee and the Ghost Dance Wars"]),
    branch("United States Revolutionary and Constitutional Wars", ["American Revolutionary War", "Whiskey Rebellion", "Northwest Indian War", "Quasi-War", "Barbary Wars", "War of 1812", "Texas Revolution", "Mexican–American War", "Utah War", "Bleeding Kansas", "American Civil War", "Reconstruction Conflicts"]),
    branch("United States Overseas Wars", ["Spanish–American War", "Philippine–American War", "Banana Wars", "Mexican Border War", "World War I", "World War II", "Korean War", "Vietnam War", "Gulf War", "War in Afghanistan", "Iraq War", "War on Terror"]),
    branch("Canada and Mexico", ["Lower Canada Rebellion", "Upper Canada Rebellion", "North-West Rebellion", "Red River Resistance", "Mexican War of Independence", "Pastry War", "Reform War", "French Intervention in Mexico", "Mexican Revolution", "Cristero War", "Zapatista Uprising"]),
    branch("Caribbean and Central America", ["Haitian Revolution", "Cuban War of Independence", "Spanish–American War", "Banana Wars", "Nicaraguan Civil War", "Salvadoran Civil War", "Guatemalan Civil War", "Costa Rican Civil War", "Dominican Civil War", "Grenada Invasion", "Honduran–Salvadoran War"])
  ]);
  var southAmerica = branch("South America and the Southern Cone", [
    branch("Wars of Independence", ["South American Wars of Independence", "Bolívar's Campaigns", "Argentine War of Independence", "Chilean War of Independence", "Peruvian War of Independence", "Brazilian War of Independence", "Uruguayan War of Independence", "Ecuadorian War of Independence"]),
    branch("Brazil and the Río de la Plata", ["Cisplatine War", "Ragamuffin War", "Balaiada", "Cabanagem", "Sabinada", "War of the Triple Alliance", "Paraguayan War", "Federalist Revolution", "Contestado War", "Brazilian Revolution of 1930"]),
    branch("The War of the Triple Alliance", ["Paraguay and the Triple Alliance", "Uruguayan Civil War and Intervention", "Brazilian Campaign in Paraguay", "Argentine Campaign in Paraguay", "Battle of Riachuelo", "Battle of Tuyutí", "Battle of Curupayty", "Battle of Humaitá", "Battle of Cerro Corá", "Paraguayan Demographic Collapse", "War Memory and Regional Legacy"]),
    branch("Pacific and Andean Wars", ["War of the Confederation", "War of the Pacific", "Ecuadorian–Peruvian War", "Colombian–Peruvian War", "Chaco War", "Leticia Incident", "Cenepa War", "Peruvian Civil Wars", "Bolivian Civil War"]),
    branch("Revolutions and Civil Wars", ["Colombian Civil War", "Thousand Days' War", "La Violencia", "Colombian Conflict", "Venezuelan Federal War", "Venezuelan Crisis and Conflict", "Argentine Civil Wars", "Uruguayan Civil War", "Chilean Civil War of 1891", "Peruvian Civil War", "Bolivian National Revolution"])
  ]);
  var oceania = branch("Oceania and the Pacific", [
    branch("Australia and New Zealand", ["Australian Frontier Wars", "Black War", "New Zealand Wars", "Musket Wars", "Battle of Gallipoli", "Pacific War", "East Timor Intervention"]),
    branch("Pacific Island Conflicts", ["Fiji Coups and Conflicts", "Bougainville Civil War", "Guadalcanal Campaign", "Solomon Islands Civil Conflict", "Vanuatu Coconut War", "Tonga Civil Conflicts", "New Caledonian Revolt", "Pacific Nuclear Testing and Resistance"]),
    branch("Pacific Theater of World War II", ["Attack on Pearl Harbor", "Battle of Guadalcanal", "Battle of Midway", "Kokoda Track Campaign", "Battle of the Coral Sea", "Battle of Saipan", "Battle of Iwo Jima", "Battle of Okinawa", "Atomic Bombings of Hiroshima and Nagasaki"])
  ]);

  var worldWars = branch("World Wars and Global Conflicts", [
    conflict("World War I", [branch("Western Front", ["First Battle of the Marne", "Battle of Verdun", "Battle of the Somme", "Third Battle of Ypres", "Hundred Days Offensive"]), branch("Eastern and Northern Fronts", ["Battle of Tannenberg", "Brusilov Offensive", "Baltic Campaign", "Russian Revolution and Civil War"]), branch("Italian and Balkan Fronts", ["Italian Front", "Battles of the Isonzo", "Battle of Caporetto", "Salonika Front", "Gallipoli Campaign"]), branch("Middle Eastern and African Fronts", ["Mesopotamian Campaign", "Sinai and Palestine Campaign", "Arab Revolt", "East African Campaign", "South West Africa Campaign"]), branch("Naval and Global War", ["Battle of the Atlantic in World War I", "U-boat Campaign", "Blockade of Germany", "Convoy Battles"]), "United States Entry into World War I", "Armistice of 11 November 1918", "Treaty of Versailles", "World War I and the Influenza Pandemic"]),
    conflict("World War II", [branch("European Theater", ["Invasion of Poland", "Fall of France", "Battle of Britain", "Operation Barbarossa", "Siege of Leningrad", "Battle of Moscow", "Battle of Stalingrad", "Battle of Kursk", "D-Day", "Liberation of France", "Battle of the Bulge", "Fall of Berlin"]), branch("North African and Mediterranean Theaters", ["Western Desert Campaign", "Second Battle of El Alamein", "Tunisia Campaign", "Sicily Campaign", "Italian Campaign", "Battle of Monte Cassino"]), branch("Eastern and Pacific Theaters", ["Second Sino-Japanese War", "Attack on Pearl Harbor", "Battle of Midway", "Guadalcanal Campaign", "Burma Campaign", "New Guinea Campaign", "Island Hopping", "Battle of Leyte Gulf", "Battle of Iwo Jima", "Battle of Okinawa", "Atomic Bombings"]), branch("Resistance, Occupation, and Genocide", ["French Resistance", "Warsaw Ghetto Uprising", "Warsaw Uprising", "Yugoslav Partisan War", "Greek Resistance", "Holocaust", "Nazi Occupation of Europe", "Soviet Partisan Movement", "Chinese Resistance"]), "Battle of the Atlantic", "Arctic Convoys", "Lend-Lease", "Soviet–Japanese War", "End of World War II"]),
    branch("Cold War Conflicts", ["Greek Civil War", "Chinese Civil War", "Korean War", "First Indochina War", "Vietnam War", "Laotian Civil War", "Cambodian Civil War", "Soviet–Afghan War", "Angolan Civil War", "Mozambican Civil War", "Nicaraguan Revolution", "Cuban Revolution", "Cuban Missile Crisis", "Arab–Israeli Conflicts", "Iran–Iraq War", "Sino-Soviet Border Conflict", "Contra War", "Ogaden War", "Ethiopian Civil War"]),
    branch("Post-Cold War and Twenty-First-Century Conflicts", ["Gulf War", "Yugoslav Wars", "Rwandan Civil War", "First Congo War", "Second Congo War", "Kosovo War", "War in Afghanistan", "Iraq War", "War on Terror", "Syrian Civil War", "Libyan Civil War", "Yemeni Civil War", "Russo-Ukrainian War", "Tigray War", "Nagorno-Karabakh Conflict", "Myanmar Civil War", "Sahel Conflicts"])
  ]);

  var periods = grouped("Wars by Period", [
    ["Prehistoric and Early State Wars", ["Tribal Warfare", "Neolithic Warfare", "Egyptian–Hittite Wars", "Late Bronze Age Wars"]],
    ["Ancient and Classical Wars", ["Greek and Persian Wars", "Peloponnesian War", "Macedonian Wars", "Punic Wars", "Roman Civil Wars", "Han–Xiongnu War"]],
    ["Late Antique Wars", ["Gothic Wars", "Vandalic War", "Byzantine–Sasanian War", "Arab–Byzantine Wars", "Lombard Wars"]],
    ["Early and High Medieval Wars", ["Viking Invasions", "Norman Conquest", "Crusades", "Mongol Conquests", "Reconquista", "Scottish Wars of Independence", "Hundred Years' War"]],
    ["Late Medieval Wars", ["Wars of the Roses", "Hussite Wars", "Ottoman Wars in Europe", "Italian Wars", "Muscovite–Lithuanian Wars"]],
    ["Early Modern Wars", ["Thirty Years' War", "English Civil Wars", "French Wars of Religion", "Great Northern War", "War of the Spanish Succession", "Seven Years' War"]],
    ["Revolutionary and Napoleonic Wars", ["American Revolutionary War", "French Revolutionary Wars", "Haitian Revolution", "Napoleonic Wars", "Latin American Wars of Independence"]],
    ["Nineteenth-Century Wars", ["Crimean War", "American Civil War", "War of the Triple Alliance", "War of the Pacific", "Franco-Prussian War", "Meiji Restoration Wars", "Taiping Rebellion"]],
    ["World War and Interwar Conflicts", ["World War I", "Russian Civil War", "Spanish Civil War", "Second Sino-Japanese War", "World War II", "Chinese Civil War"]],
    ["Cold War and Contemporary Wars", ["Korean War", "Vietnam War", "Soviet–Afghan War", "Iran–Iraq War", "Gulf War", "Yugoslav Wars", "War in Afghanistan", "Russo-Ukrainian War"]]
  ]);
  var types = grouped("Wars by Type", [
    ["International Wars", ["Punic Wars", "Hundred Years' War", "Seven Years' War", "Napoleonic Wars", "First World War", "Second World War"]],
    ["Civil Wars", ["Roman Civil Wars", "English Civil War", "French Civil Wars", "American Civil War", "Russian Civil War", "Spanish Civil War", "Chinese Civil War", "Syrian Civil War"]],
    ["Rebellions and Uprisings", ["Boudican Revolt", "Taiping Rebellion", "Sepoy Rebellion", "Maji Maji Rebellion", "Boxer Rebellion", "Warsaw Ghetto Uprising", "Easter Rising"]],
    ["Wars of Succession", ["War of the Castilian Succession", "War of the Spanish Succession", "War of the Austrian Succession", "Wars of the Roses", "Ming–Qing Transition"]],
    ["Religious Wars", ["Crusades", "French Wars of Religion", "Thirty Years' War", "Hussite Wars", "Taiping Rebellion", "Mahdist War"]],
    ["Revolutionary and Independence Wars", ["American Revolutionary War", "Haitian Revolution", "Latin American Wars of Independence", "Greek War of Independence", "Indonesian National Revolution", "Algerian War"]],
    ["Colonial and Anti-Colonial Wars", ["French and Indian War", "Anglo-Zulu War", "Mau Mau Uprising", "Vietnam War", "Algerian War", "Angolan War of Independence"]],
    ["Proxy and Ideological Wars", ["Spanish Civil War", "Korean War", "Vietnam War", "Angolan Civil War", "Soviet–Afghan War", "Contra War"]],
    ["Guerrilla and Insurgency Wars", ["Peninsular War", "Malayan Emergency", "Irish War of Independence", "Afghan War", "Iraq Insurgency"]],
    ["Naval and Maritime Wars", ["Punic Wars", "Anglo-Dutch Wars", "Battle of the Atlantic", "Pacific War", "Russo-Japanese War", "War of the Pacific"]],
    ["Sieges and Urban Warfare", ["Siege of Troy", "Siege of Jerusalem", "Siege of Constantinople", "Siege of Orleans", "Siege of Vienna", "Siege of La Rochelle", "Siege of Leningrad", "Siege of Sarajevo"]],
    ["Border and Resource Wars", ["War of the Pacific", "Chaco War", "Cod Wars", "War of the Triple Alliance", "Ecuadorian–Peruvian War", "Sino-Soviet Border Conflict"]]
  ]);
  var countries = grouped("Wars by Country and State", [
    ["United States", ["American Revolutionary War", "War of 1812", "Mexican–American War", "American Civil War", "Indian Wars", "Spanish–American War", "World War I", "World War II", "Korean War", "Vietnam War", "Gulf War", "War in Afghanistan", "Iraq War"]],
    ["United Kingdom", ["Norman Conquest", "Hundred Years' War", "Wars of the Roses", "English Civil Wars", "Jacobite Risings", "Seven Years' War", "Napoleonic Wars", "Crimean War", "World War I", "World War II", "Falklands War"]],
    ["France", ["French Wars of Religion", "French Revolutionary Wars", "Napoleonic Wars", "Franco-Prussian War", "French Resistance", "First Indochina War", "Algerian War"]],
    ["Russia and the Soviet Union", ["Russo-Turkish Wars", "Great Northern War", "Crimean War", "Russian Civil War", "Soviet–Polish War", "World War II", "Soviet–Afghan War", "Russo-Ukrainian War"]],
    ["China", ["Warring States Period", "Mongol Conquest of China", "Taiping Rebellion", "Boxer Rebellion", "Second Sino-Japanese War", "Chinese Civil War", "Sino-Indian War", "Sino-Vietnamese War"]],
    ["India and South Asia", ["Mauryan Wars", "Mughal–Maratha Wars", "Anglo-Mysore Wars", "Indian Rebellion of 1857", "Partition of India", "Indo-Pakistani Wars", "Bangladesh Liberation War", "Sri Lankan Civil War"]],
    ["Japan", ["Genpei War", "Sengoku Period Wars", "Boshin War", "First Sino-Japanese War", "Russo-Japanese War", "Second Sino-Japanese War", "Pacific War"]],
    ["Paraguay and the Southern Cone", ["War of the Triple Alliance", "Paraguayan War", "War of the Pacific", "Chaco War", "Uruguayan Civil War"]]
  ]);
  var militaryStudies = branch("Military Campaigns and Battles", [
    branch("Ancient Battles", ["Battle of Marathon", "Battle of Thermopylae", "Battle of Salamis", "Battle of Cannae", "Battle of Zama", "Battle of Actium"]),
    branch("Medieval Battles", ["Battle of Hastings", "Battle of Tours", "Battle of Manzikert", "Battle of Hattin", "Battle of Crécy", "Battle of Agincourt", "Battle of Towton"]),
    branch("Early Modern Battles", ["Battle of Lepanto", "Battle of White Mountain", "Battle of Breitenfeld", "Battle of Naseby", "Battle of Blenheim", "Battle of Poltava", "Battle of Waterloo"]),
    branch("Modern Battles", ["Battle of Gettysburg", "Battle of Verdun", "Battle of the Somme", "Battle of Stalingrad", "Battle of Midway", "Battle of Dien Bien Phu", "Battle of Khe Sanh", "Battle of Mogadishu"]),
    branch("Sieges and Fortified Cities", ["Siege of Troy", "Siege of Jerusalem", "Siege of Constantinople", "Siege of Orleans", "Siege of Vienna", "Siege of La Rochelle", "Siege of Leningrad", "Siege of Sarajevo"])
  ]);
  var warHistory = branch("War History", [
    branch("Wars by Region", [europe, middleEast, africa, southAsia, eastAsia, southeastAsia, centralAsia, northAmerica, southAmerica, oceania]),
    periods,
    types,
    worldWars,
    branch("Civil Wars, Rebellions, and Insurgencies", [branch("Europe", ["French Civil Wars", "British Civil Wars", "Wars of the Roses", "Russian Civil War", "Spanish Civil War", "Greek Civil War", "Yugoslav Wars", "Irish Civil War"]), branch("Africa", ["Nigerian Civil War", "Ethiopian Civil War", "Rwandan Civil War", "First Congo War", "Second Congo War", "Angolan Civil War", "Mozambican Civil War", "Sudanese Civil Wars"]), branch("Asia", ["Chinese Civil War", "Korean War", "Cambodian Civil War", "Laotian Civil War", "Sri Lankan Civil War", "Nepalese Civil War", "Myanmar Civil War"]), branch("The Americas", ["American Civil War", "Mexican Revolution", "Colombian Civil War", "Uruguayan Civil War", "Nicaraguan Civil War", "Salvadoran Civil War", "Guatemalan Civil War"])]),
    branch("French Wars and Civil Conflicts", [frenchWars, branch("French Civil Wars: Quick Index", ["French Wars of Religion", "Fronde", "War in the Vendée", "Chouannerie", "Paris Commune"])]),
    branch("Wars of the Roses and English Succession", [roses, "Anarchy", "English Civil Wars", "Jacobite Risings", "Glorious Revolution"]),
    branch("War of the Triple Alliance and South American Conflicts", ["War of the Triple Alliance", "Paraguayan War", "War of the Pacific", "Chaco War", "War of the Confederation", "South American Wars of Independence"]),
    countries,
    militaryStudies,
    branch("War, Society, and Memory", ["Military Technology", "Arms and Armor", "Naval Technology", "Air Power", "Logistics and Supply", "Conscription", "Mercenaries", "Women and War", "Children and War", "War and Disease", "War and Famine", "War Refugees", "Prisoners of War", "War Crimes", "Genocide and Mass Violence", "Peace Treaties", "War Reparations", "War Memorials", "Veterans and Disability", "Archaeology of War", "War Correspondents"]),
    "Other Wars and Conflicts"
  ]);
  var catalog = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  var history = catalog.find(function (item) { return item && item.label === "History"; });
  if (history && history.children && !history.children.some(function (item) { return item && item.label === "War History"; })) history.children.push(warHistory);
})();
