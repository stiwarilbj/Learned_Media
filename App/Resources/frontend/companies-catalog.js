(function () {
  "use strict";

  function branch(label, children) { return { label: label, children: children }; }
  function sector(label, categories, enterprises) {
    return branch(label, [branch("General Categories", categories), branch("Notable Companies and Enterprises", enterprises)]);
  }
  function period(label, sectors, largest) {
    return branch(label, sectors.concat([branch("Largest Companies and Enterprises of the Period", largest)]));
  }

  var companies = branch("Companies", [
    branch("By Time Period", [
      period("Ancient and Classical Economies", [
        sector("Agriculture and Food", ["Estate farming", "Grain merchants", "Olive oil and wine trade"], ["Roman latifundia", "Ptolemaic grain estates", "Athenian olive-oil merchants"]),
        sector("Trade and Finance", ["Long-distance merchants", "Tax farming", "State monopolies"], ["Roman publicani", "Phoenician merchant houses", "Han salt and iron monopolies"]),
        sector("Mining, Metals, and Manufacturing", ["Silver mining", "Metalworking workshops", "Shipbuilding yards"], ["Laurion silver mines", "Roman mining contractors", "Han iron foundries"]),
        sector("Transport and Infrastructure", ["Merchant fleets", "Port operations", "Road and bridge contracts"], ["Athenian naval suppliers", "Alexandrian port enterprises", "Roman road contractors"])
      ], ["Roman publicani", "Roman latifundia", "Han salt and iron monopolies", "Ptolemaic state enterprises", "Phoenician merchant houses", "Laurion silver mines"]),
      period("Medieval and Early Commercial Economies", [
        sector("Agriculture and Landholding", ["Manorial estates", "Plantation estates", "Agricultural rents"], ["Cistercian granges", "English manorial estates", "Mamluk iqta estates"]),
        sector("Merchant Trade and Banking", ["Trade fairs", "Merchant banking", "Bills of exchange"], ["Medici Bank", "Fugger family firms", "Venetian merchant houses", "Hanseatic League trading houses"]),
        sector("Mining and Craft Production", ["Silver mines", "Textile workshops", "Arms production"], ["Kutná Hora silver mines", "Florentine wool guilds", "Toledo sword workshops"]),
        sector("Shipping and Overseas Trade", ["Caravan trade", "Port commerce", "Ship-owning partnerships"], ["Venetian spice merchants", "Genoese trading houses", "Swahili city-state merchants"])
      ], ["Medici Bank", "Fugger family firms", "Hanseatic League trading houses", "Venetian merchant houses", "Cistercian granges"]),
      period("Early Modern and Mercantile Era (1500–1799)", [
        sector("Colonial Trade and Chartered Companies", ["Chartered monopolies", "Colonial commodities", "Trading posts"], ["Dutch East India Company", "English East India Company", "French East India Company", "Hudson's Bay Company"]),
        sector("Banking, Insurance, and Credit", ["Public debt", "Marine insurance", "Merchant credit"], ["Bank of Amsterdam", "Lloyd's of London", "Rothschild banking house"]),
        sector("Plantations and Commodity Processing", ["Sugar plantations", "Tobacco cultivation", "Textile processing"], ["Caribbean sugar estates", "Virginia tobacco companies", "Lancashire cotton merchants"]),
        sector("Mining, Manufacturing, and Transport", ["Coal mining", "Ironworks", "Canal building"], ["Newcomen engine works", "Crown mining enterprises", "Bridgewater Canal Company"])
      ], ["Dutch East India Company", "English East India Company", "Hudson's Bay Company", "Bank of Amsterdam", "Lloyd's of London", "Rothschild banking house"]),
      period("Industrial Revolution and Victorian Era (1800–1914)", [
        sector("Railways and Heavy Industry", ["Railway networks", "Steel production", "Industrial machinery"], ["Pennsylvania Railroad", "Great Western Railway", "Krupp", "Bethlehem Steel"]),
        sector("Oil, Mining, and Energy", ["Coal mining", "Oil refining", "Electric utilities"], ["Standard Oil", "Royal Dutch Petroleum", "De Beers", "General Electric"]),
        sector("Banking, Insurance, and Finance", ["Commercial banks", "Life insurance", "Stock exchanges"], ["J.P. Morgan & Co.", "Barings Bank", "Prudential Assurance", "Credit Suisse"]),
        sector("Manufacturing and Consumer Goods", ["Textile factories", "Food processing", "Department stores"], ["Singer Corporation", "Ford Motor Company", "Coca-Cola", "Sears", "Lever Brothers"]),
        sector("Telegraph, Shipping, and Communications", ["Telegraph networks", "Steamship lines", "International cables"], ["Western Union", "Marconi Company", "Cunard Line", "Hamburg America Line"])
      ], ["Standard Oil", "U.S. Steel", "Pennsylvania Railroad", "General Electric", "Ford Motor Company", "Singer Corporation", "De Beers"]),
      period("Early Twentieth Century and Interwar Era (1914–1945)", [
        sector("Automobiles and Mass Production", ["Assembly lines", "Passenger cars", "Commercial trucks"], ["Ford Motor Company", "General Motors", "Chrysler", "Fiat"]),
        sector("Oil, Chemicals, and Industrial Materials", ["Petroleum refining", "Synthetic chemicals", "Industrial gases"], ["Standard Oil of New Jersey", "DuPont", "IG Farben", "Imperial Chemical Industries"]),
        sector("Banking, Insurance, and Retail", ["Consumer credit", "Insurance groups", "Mail-order retail"], ["National City Bank", "Allianz", "Macy's", "Montgomery Ward"]),
        sector("Aviation, Radio, and Film", ["Airlines", "Broadcasting", "Film studios"], ["Pan American World Airways", "RCA", "Paramount Pictures", "Metro-Goldwyn-Mayer"]),
        sector("Food, Tobacco, and Household Brands", ["Packaged food", "Tobacco manufacturing", "Household products"], ["Kellogg's", "Philip Morris", "Procter & Gamble", "Nestlé"])
      ], ["General Motors", "Ford Motor Company", "Standard Oil of New Jersey", "RCA", "DuPont", "IG Farben", "Pan American World Airways"]),
      period("Postwar and Late Twentieth Century (1945–1999)", [
        sector("Automotive and Aerospace", ["Global car production", "Commercial aircraft", "Defense aerospace"], ["Toyota", "Volkswagen", "Boeing", "Airbus", "General Motors"]),
        sector("Oil, Energy, and Telecommunications", ["Integrated oil companies", "Electric utilities", "Telephone networks"], ["Exxon", "Royal Dutch Shell", "AT&T", "British Telecommunications", "Enron"]),
        sector("Computers and Electronics", ["Mainframe computers", "Personal computers", "Consumer electronics"], ["IBM", "Microsoft", "Apple", "Intel", "Sony", "Samsung Electronics"]),
        sector("Finance, Retail, and Consumer Brands", ["Credit cards", "Investment banking", "Big-box retail"], ["Citigroup", "Visa", "Walmart", "Berkshire Hathaway", "McDonald's", "Nike"]),
        sector("Media, Entertainment, and Pharmaceuticals", ["Television networks", "Recorded music", "Pharmaceutical research"], ["The Walt Disney Company", "Time Warner", "Sony Music", "Pfizer", "Merck & Co."])
      ], ["IBM", "Microsoft", "General Electric", "Toyota", "Walmart", "Exxon", "The Walt Disney Company", "Berkshire Hathaway", "AT&T"]),
      period("Modern Day (2000–present)", [
        sector("Software, Cloud, and Enterprise Platforms", ["Operating systems", "Enterprise software", "Cloud infrastructure", "Developer tools", "Business automation"], ["Microsoft", "Oracle", "SAP", "Salesforce", "Adobe", "ServiceNow", "Intuit", "Atlassian", "Palantir"]),
        sector("Semiconductors and Chip Equipment", ["Chip design", "Logic chips", "Memory", "Foundries", "Lithography and fabrication equipment"], ["NVIDIA", "TSMC", "Intel", "AMD", "Samsung Electronics", "Broadcom", "Qualcomm", "ASML", "Applied Materials", "Micron"]),
        sector("Internet Search, Social Networks, and Digital Advertising", ["Search engines", "Social networks", "Digital advertising", "Online identity and messaging"], ["Alphabet", "Meta Platforms", "Tencent", "Baidu", "ByteDance", "Snap", "Pinterest"]),
        sector("E-Commerce and Digital Marketplaces", ["Online retail", "Travel marketplaces", "Online auctions", "Food delivery"], ["Amazon", "Alibaba", "JD.com", "Mercado Libre", "eBay", "Booking Holdings", "DoorDash"]),
        sector("Finance, Banking, Payments, and Asset Management", ["Commercial banking", "Investment banking", "Card networks", "Digital payments", "Asset management"], ["JPMorgan Chase", "Bank of America", "Goldman Sachs", "Visa", "Mastercard", "PayPal", "BlackRock", "Berkshire Hathaway", "Stripe"]),
        sector("Pharmaceuticals and Biotechnology", ["Prescription medicines", "Vaccines", "Biologic drugs", "Gene and cell therapy", "Diabetes and obesity medicines"], ["Eli Lilly", "Novo Nordisk", "Johnson & Johnson", "Pfizer", "Roche", "Novartis", "Merck & Co.", "AbbVie", "AstraZeneca", "Moderna"]),
        sector("Medical Devices, Health Services, and Insurance", ["Medical devices", "Hospital systems", "Health insurance", "Pharmacy services", "Diagnostics"], ["UnitedHealth Group", "CVS Health", "Medtronic", "Abbott Laboratories", "Stryker", "Siemens Healthineers"]),
        sector("Energy, Oil, Gas, and Renewables", ["Integrated oil and gas", "National oil companies", "Electric utilities", "Solar and wind power", "Battery storage"], ["Saudi Aramco", "ExxonMobil", "Chevron", "Shell", "BP", "TotalEnergies", "NextEra Energy", "Ørsted"]),
        sector("Automotive, Electric Vehicles, and Mobility", ["Mass-market vehicles", "Luxury vehicles", "Electric vehicles", "Batteries", "Ride-hailing and shared mobility"], ["Toyota", "Volkswagen", "Tesla", "BYD", "Mercedes-Benz", "General Motors", "Ford", "Uber", "Rivian"]),
        sector("Telecommunications and Wireless Networks", ["Mobile carriers", "Broadband providers", "Network equipment", "Data centers", "Undersea cables"], ["China Mobile", "Verizon", "AT&T", "Deutsche Telekom", "T-Mobile", "Cisco", "Huawei", "Nokia", "Ericsson"]),
        sector("Aerospace, Defense, and Space", ["Commercial aircraft", "Defense systems", "Launch vehicles", "Satellites", "Space services"], ["Boeing", "Airbus", "Lockheed Martin", "RTX", "Northrop Grumman", "SpaceX", "GE Aerospace"]),
        sector("Retail, Grocery, and Consumer Goods", ["Supermarkets", "Big-box retail", "Luxury goods", "Household products", "Beverages and packaged food"], ["Walmart", "Costco", "Home Depot", "LVMH", "Procter & Gamble", "Unilever", "Nestlé", "Coca-Cola", "PepsiCo"]),
        sector("Media, Streaming, Gaming, and Entertainment", ["Film studios", "Streaming video", "Recorded music", "Video games", "Live entertainment"], ["The Walt Disney Company", "Comcast", "Netflix", "Sony", "Warner Bros. Discovery", "Nintendo", "Electronic Arts", "Tencent"]),
        sector("Logistics, Shipping, and Delivery", ["Parcel delivery", "Freight forwarding", "Container shipping", "Warehousing", "Last-mile delivery"], ["UPS", "FedEx", "DHL", "Maersk", "COSCO Shipping", "DP World", "JD Logistics"]),
        sector("Industrial Machinery, Engineering, and Automation", ["Factory automation", "Construction equipment", "Industrial software", "Electrical systems", "Robotics"], ["Siemens", "Honeywell", "Caterpillar", "ABB", "Schneider Electric", "Hitachi", "Fanuc"]),
        sector("Construction, Real Estate, and Infrastructure", ["Building construction", "Commercial property", "Data-center real estate", "Infrastructure funds", "Property services"], ["Vinci", "ACS Group", "Brookfield", "Prologis", "CBRE", "Turner Construction"]),
        sector("Agriculture, Food Production, and Restaurants", ["Agribusiness", "Grain trading", "Meat processing", "Fast food", "Coffee and casual dining"], ["Cargill", "Archer Daniels Midland", "Tyson Foods", "McDonald's", "Starbucks", "Yum! Brands"])
      ], ["Apple", "Microsoft", "Saudi Aramco", "Alphabet", "Amazon", "NVIDIA", "Berkshire Hathaway", "Meta Platforms", "TSMC", "Eli Lilly", "Broadcom", "JPMorgan Chase", "Tencent", "Visa", "Walmart", "ExxonMobil", "UnitedHealth Group", "Tesla", "Johnson & Johnson", "The Walt Disney Company"])
    ])
  ]);

  var catalog = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  var history = catalog.find(function (item) { return item && item.label === "History"; });
  if (history && history.children && !history.children.some(function (item) { return item && item.label === "Companies"; })) history.children.push(companies);
})();
