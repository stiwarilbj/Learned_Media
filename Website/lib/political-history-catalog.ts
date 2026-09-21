import type { TopicSeed } from "./topic-catalog";

type BranchSeed = { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): BranchSeed => ({ label, children, aliases });

const ordinal = (value: number): string => {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] || "th");
  return `${value}${suffix}`;
};

const range = (start: number, end: number, step: number): number[] => {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
};

const CONGRESS_LABELS = range(1, 119, 1).map((number) => {
  const start = 1789 + (number - 1) * 2;
  return `${ordinal(number)} Congress (${start}–${start + 2})`;
});

// The House's official list records occasional mid-Congress changes. Keeping
// the office holder after the Congress label makes the topic about the period
// of the Congress rather than creating a person-centered branch.
const HOUSE_SPEAKERS_BY_CONGRESS = [
  "Frederick A. C. Muhlenberg", "Jonathan Trumbull Jr.", "Frederick A. C. Muhlenberg", "Jonathan Dayton", "Jonathan Dayton", "Theodore Sedgwick",
  "Nathaniel Macon", "Nathaniel Macon", "Nathaniel Macon", "Joseph Bradley Varnum", "Joseph Bradley Varnum", "Henry Clay",
  "Henry Clay / Langdon Cheves", "Henry Clay", "Henry Clay", "Henry Clay / John W. Taylor", "Philip Pendleton Barbour", "Henry Clay",
  "John W. Taylor", "Andrew Stevenson", "Andrew Stevenson", "Andrew Stevenson", "Andrew Stevenson / John Bell", "James K. Polk",
  "James K. Polk", "Robert M. T. Hunter", "John White", "John Winston Jones", "John Wesley Davis", "Robert Charles Winthrop", "Howell Cobb",
  "Linn Boyd", "Linn Boyd", "Nathaniel P. Banks", "James L. Orr", "William Pennington", "Galusha Grow", "Schuyler Colfax", "Schuyler Colfax",
  "Schuyler Colfax / Theodore Pomeroy", "James G. Blaine", "James G. Blaine", "James G. Blaine", "Michael C. Kerr / Samuel Randall", "Samuel Randall",
  "Samuel Randall", "Joseph W. Keifer", "John G. Carlisle", "John G. Carlisle", "John G. Carlisle", "Thomas B. Reed", "Charles F. Crisp",
  "Charles F. Crisp", "Thomas B. Reed", "Thomas B. Reed", "David B. Henderson", "David B. Henderson", "Joseph G. Cannon", "Joseph G. Cannon",
  "Joseph G. Cannon", "Joseph G. Cannon", "Champ Clark", "Champ Clark", "Champ Clark", "Champ Clark", "Frederick H. Gillett", "Frederick H. Gillett",
  "Frederick H. Gillett", "Nicholas Longworth", "Nicholas Longworth", "Nicholas Longworth", "John Nance Garner", "Henry T. Rainey", "Joseph W. Byrns / William B. Bankhead",
  "William B. Bankhead", "William B. Bankhead / Sam Rayburn", "Sam Rayburn", "Sam Rayburn", "Sam Rayburn", "Joseph W. Martin Jr.", "Sam Rayburn",
  "Sam Rayburn", "Joseph W. Martin Jr.", "Sam Rayburn", "Sam Rayburn", "Sam Rayburn", "Sam Rayburn / John W. McCormack", "John W. McCormack",
  "John W. McCormack", "John W. McCormack", "John W. McCormack", "Carl Albert", "Carl Albert", "Carl Albert", "Tip O'Neill", "Tip O'Neill",
  "Tip O'Neill", "Tip O'Neill", "Tip O'Neill", "Jim Wright", "Jim Wright / Thomas Foley", "Thomas Foley", "Thomas Foley", "Newt Gingrich",
  "Newt Gingrich", "Dennis Hastert", "Dennis Hastert", "Dennis Hastert", "Dennis Hastert", "Nancy Pelosi", "Nancy Pelosi", "John Boehner",
  "John Boehner", "John Boehner / Paul Ryan", "Paul Ryan", "Nancy Pelosi", "Nancy Pelosi", "Kevin McCarthy / Mike Johnson", "Mike Johnson"
];

const PRESIDENTIAL_ELECTIONS = [1789, 1792, ...range(1796, 2024, 4)].map((year) => `Presidential Election ${year}`);
const ELECTION_CYCLES = range(1788, 2024, 2).map((year) => `Election Cycle ${year}–${year + 1}`);

const PRESIDENTIAL_TERMS = [
  "George Washington (1789–1797)", "John Adams (1797–1801)", "Thomas Jefferson (1801–1809)",
  "James Madison (1809–1817)", "James Monroe (1817–1825)", "John Quincy Adams (1825–1829)",
  "Andrew Jackson (1829–1837)", "Martin Van Buren (1837–1841)", "William Henry Harrison (1841)",
  "John Tyler (1841–1845)", "James K. Polk (1845–1849)", "Zachary Taylor (1849–1850)",
  "Millard Fillmore (1850–1853)", "Franklin Pierce (1853–1857)", "James Buchanan (1857–1861)",
  "Abraham Lincoln (1861–1865)", "Andrew Johnson (1865–1869)", "Ulysses S. Grant (1869–1877)",
  "Rutherford B. Hayes (1877–1881)", "James A. Garfield (1881)", "Chester A. Arthur (1881–1885)",
  "Grover Cleveland (1885–1889)", "Benjamin Harrison (1889–1893)", "Grover Cleveland (1893–1897)",
  "William McKinley (1897–1901)", "Theodore Roosevelt (1901–1909)", "William Howard Taft (1909–1913)",
  "Woodrow Wilson (1913–1921)", "Warren G. Harding (1921–1923)", "Calvin Coolidge (1923–1929)",
  "Herbert Hoover (1929–1933)", "Franklin D. Roosevelt (1933–1945)", "Harry S. Truman (1945–1953)",
  "Dwight D. Eisenhower (1953–1961)", "John F. Kennedy (1961–1963)", "Lyndon B. Johnson (1963–1969)",
  "Richard Nixon (1969–1974)", "Gerald Ford (1974–1977)", "Jimmy Carter (1977–1981)",
  "Ronald Reagan (1981–1989)", "George H. W. Bush (1989–1993)", "Bill Clinton (1993–2001)",
  "George W. Bush (2001–2009)", "Barack Obama (2009–2017)", "Donald Trump (2017–2021)",
  "Joe Biden (2021–2025)", "Donald Trump (2025–present)"
];

const VICE_PRESIDENT_TERMS = [
  "John Adams (1789–1797)", "Thomas Jefferson (1797–1801)", "Aaron Burr (1801–1805)",
  "George Clinton (1805–1812)", "Elbridge Gerry (1813–1814)", "Daniel D. Tompkins (1817–1825)",
  "John C. Calhoun (1825–1832)", "Martin Van Buren (1833–1837)", "Richard Mentor Johnson (1837–1841)",
  "John Tyler (1841)", "Millard Fillmore (1849–1850)", "William R. King (1853)",
  "John C. Breckinridge (1857–1861)", "Hannibal Hamlin (1861–1865)", "Andrew Johnson (1865)",
  "Schuyler Colfax (1869–1873)", "Henry Wilson (1873–1875)", "William A. Wheeler (1877–1881)",
  "Chester A. Arthur (1881)", "Thomas A. Hendricks (1885)", "Levi P. Morton (1889–1893)",
  "Adlai E. Stevenson I (1893–1897)", "Garret Hobart (1897–1899)", "Theodore Roosevelt (1901–1909)",
  "Charles W. Fairbanks (1905–1909)", "James S. Sherman (1909–1912)", "Thomas R. Marshall (1913–1921)",
  "Calvin Coolidge (1921–1923)", "Charles G. Dawes (1925–1929)", "Charles Curtis (1929–1933)",
  "John Nance Garner (1933–1941)", "Henry A. Wallace (1941–1945)", "Harry S. Truman (1945)",
  "Alben W. Barkley (1949–1953)", "Richard Nixon (1953–1961)", "Lyndon B. Johnson (1961–1963)",
  "Hubert Humphrey (1965–1969)", "Spiro Agnew (1969–1973)", "Gerald Ford (1973–1974)",
  "Nelson Rockefeller (1974–1977)", "Walter Mondale (1977–1981)", "George H. W. Bush (1981–1989)",
  "Dan Quayle (1989–1993)", "Al Gore (1993–2001)", "Dick Cheney (2001–2009)",
  "Joe Biden (2009–2017)", "Mike Pence (2017–2021)", "Kamala Harris (2021–2025)",
  "J. D. Vance (2025–present)"
];

const FAMOUS_SENATORS = [
  "Daniel Webster", "Henry Clay", "John C. Calhoun", "Charles Sumner", "Thaddeus Stevens", "Stephen A. Douglas",
  "Jefferson Davis", "Robert M. La Follette", "Hiram Johnson", "Idaho William Borah", "George Norris", "Huey Long",
  "Robert A. Taft", "Arthur Vandenberg", "Margaret Chase Smith", "Estes Kefauver", "Richard Russell Jr.",
  "Lyndon B. Johnson", "Hubert Humphrey", "Everett Dirksen", "Mike Mansfield", "Jacob K. Javits", "Edward M. Kennedy",
  "Barry Goldwater", "Daniel Patrick Moynihan", "Howard Baker", "George Mitchell", "Robert C. Byrd", "Sam Nunn",
  "John McCain", "Ted Kennedy", "Dianne Feinstein", "Barbara Mikulski", "John Lewis", "Bernie Sanders",
  "Elizabeth Warren", "John F. Kerry", "Cory Booker", "Tammy Duckworth", "Lisa Murkowski", "Susan Collins",
  "Ronald Reagan", "Richard Nixon", "Joe Biden", "Kamala Harris", "Daniel Inouye", "Pat Moynihan"
];

const FAMOUS_HOUSE_MEMBERS = [
  "Frederick A. C. Muhlenberg", "Jonathan Dayton", "Nathaniel Macon", "Henry Clay", "John Quincy Adams", "Davy Crockett",
  "Thaddeus Stevens", "James G. Blaine", "Thomas Brackett Reed", "William Jennings Bryan", "Joseph Gurney Cannon",
  "Jeannette Rankin", "Fiorello La Guardia", "Sam Rayburn", "Joseph Martin Jr.", "John W. McCormack", "Gerald Ford",
  "Tip O'Neill", "Jim Wright", "Thomas P. O'Neill Jr.", "Newt Gingrich", "Nancy Pelosi", "John Boehner", "Paul Ryan",
  "Steny Hoyer", "Barbara Jordan", "Shirley Chisholm", "John Lewis", "Constance Baker Motley", "Bella Abzug",
  "Alexandria Ocasio-Cortez", "Cynthia McKinney", "Adam Clayton Powell Jr.", "Elijah Cummings", "John Dingell",
  "Henry Waxman", "Ronald Dellums", "Robert La Follette Jr.", "Emanuel Celler", "Hakeem Jeffries"
];

const POLITICAL_PARTIES = [
  "Federalist Party", "Democratic-Republican Party", "National Republican Party", "Whig Party", "Democratic Party",
  "Republican Party", "American Party and Know-Nothing Movement", "People's Party", "Progressive Party",
  "States' Rights Democratic Party", "Socialist Party of America", "Libertarian Party", "Green Party",
  "Constitution Party", "Independent and Third-Party Movements", "Political Realignment and Party Coalitions"
];

const SUPREME_COURT_TENURES = [
  "Court During the Jay Tenure (1789–1795)", "Court During the Rutledge Tenure (1795)", "Court During the Ellsworth Tenure (1796–1800)",
  "Court During the Marshall Tenure (1801–1835)", "Court During the Taney Tenure (1836–1864)", "Court During the Chase Tenure (1864–1873)",
  "Court During the Morrison R. Waite Tenure (1874–1888)", "Court During the Melville Fuller Tenure (1888–1910)",
  "Court During the Edward D. White Tenure (1910–1921)", "Court During the William Howard Taft Tenure (1921–1930)",
  "Court During the Charles Evans Hughes Tenure (1930–1941)", "Court During the Harlan Fiske Stone Tenure (1941–1946)",
  "Court During the Fred Vinson Tenure (1946–1953)", "Court During the Earl Warren Tenure (1953–1969)",
  "Court During the Warren Burger Tenure (1969–1986)", "Court During the William Rehnquist Tenure (1986–2005)",
  "Court During the John Roberts Tenure (2005–present)"
];

const SUPREME_COURT_ERAS = [
  "Founding Court", "Marshall Court", "Taney Court", "Civil War and Reconstruction Court", "Gilded Age Court",
  "Progressive Era Court", "New Deal Court", "Warren Court", "Burger Court", "Rehnquist Court", "Roberts Court"
];

const CABINET_POSITIONS = [
  "Secretary of State", "Secretary of the Treasury", "Secretary of Defense and Secretary of War", "Attorney General and Department of Justice",
  "Secretary of the Interior", "Secretary of Agriculture", "Secretary of Commerce", "Secretary of Labor",
  "Secretary of Health and Human Services", "Secretary of Housing and Urban Development", "Secretary of Transportation",
  "Secretary of Energy", "Secretary of Education", "Secretary of Veterans Affairs", "Secretary of Homeland Security",
  "White House Cabinet-Level Offices", "Independent Cabinet-Rank Agencies"
];

const PRESIDENTIAL_SCANDALS = [
  "Credit Mobilier", "Teapot Dome", "Watergate", "Iran–Contra Affair", "Whitewater", "Lewinsky Scandal", "Trump–Ukraine Impeachment",
  "January 6 and Presidential Accountability", "Campaign Finance and Patronage Scandals", "Other Presidential Scandals"
];
const CONGRESSIONAL_SCANDALS = [
  "Credit Mobilier", "Keating Five", "ABSCAM", "House Bank Scandal", "Congressional Post Office Scandal", "Mark Foley Scandal",
  "Congressional Insider Trading Questions", "Campaign Finance Scandals", "Other Congressional Scandals"
];
const CABINET_SCANDALS = [
  "Alexander Hamilton's Financial Conflicts", "Seward and the Alaska Purchase Debate", "Teapot Dome Cabinet Scandal",
  "Veterans Administration Scandals", "Iran–Contra Cabinet and National Security Scandal", "HUD and Housing Scandals",
  "Department of Interior Leasing Scandals", "Procurement and Contracting Scandals", "Other Cabinet Scandals"
];

const FAMOUS_COURT_CASES = [
  "Marbury v. Madison", "McCulloch v. Maryland", "Gibbons v. Ogden", "Dred Scott v. Sandford", "Civil Rights Cases",
  "Plessy v. Ferguson", "Lochner v. New York", "Schenck v. United States", "Gitlow v. New York", "Brown v. Board of Education",
  "Mapp v. Ohio", "Gideon v. Wainwright", "Miranda v. Arizona", "Loving v. Virginia", "Tinker v. Des Moines",
  "New York Times Co. v. United States", "Roe v. Wade", "United States v. Nixon", "Regents of the University of California v. Bakke",
  "Texas v. Johnson", "Planned Parenthood v. Casey", "United States v. Lopez", "Bush v. Gore", "Lawrence v. Texas",
  "District of Columbia v. Heller", "Citizens United v. Federal Election Commission", "Obergefell v. Hodges", "Dobbs v. Jackson Women's Health Organization",
  "Scopes Trial", "Katko v. Briney", "Ossian Sweet Trial", "Sacco and Vanzetti Trials", "The Chicago Seven Trial",
  "Famous State Constitutional Cases", "Famous Repeated Supreme Court Cases"
];

const STATEHOOD: Record<string, string> = {
  Delaware: "1787", Pennsylvania: "1787", "New Jersey": "1787", Georgia: "1788", Connecticut: "1788", Massachusetts: "1788",
  Maryland: "1788", "South Carolina": "1788", "New Hampshire": "1788", Virginia: "1788", NewYork: "1788", "North Carolina": "1789",
  RhodeIsland: "1790", Vermont: "1791", Kentucky: "1792", Tennessee: "1796", Ohio: "1803", Louisiana: "1812", Indiana: "1816",
  Mississippi: "1817", Illinois: "1818", Alabama: "1819", Maine: "1820", Missouri: "1821", Arkansas: "1836", Michigan: "1837",
  Florida: "1845", Texas: "1845", Iowa: "1846", Wisconsin: "1848", California: "1850", Minnesota: "1858", Oregon: "1859",
  Kansas: "1861", "West Virginia": "1863", Nevada: "1864", Nebraska: "1867", Colorado: "1876", "North Dakota": "1889",
  "South Dakota": "1889", Montana: "1889", Washington: "1889", Idaho: "1890", Wyoming: "1890", Utah: "1896", Oklahoma: "1907",
  "New Mexico": "1912", Arizona: "1912", Alaska: "1959", Hawaii: "1959"
};

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii",
  "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const statehoodYear = (state: string): string => STATEHOOD[state] ?? STATEHOOD[state.replace(/ /g, "")] ?? "statehood era";

const stateHistoryChildren = (state: string): TopicSeed[] => [
  `Statehood and Founding Government (${statehoodYear(state)})`,
  "Territorial and Constitutional Politics", "Civil War and Reconstruction Politics", "Progressive and New Deal Politics",
  "Civil Rights and Modern Politics", "Governors and Executive History", "State Parties and Elections", "Major State Political Events"
];

const worldCountries = [
  "Canada", "Mexico", "Guatemala", "Cuba", "Haiti", "Dominican Republic", "Jamaica", "Brazil", "Argentina", "Chile", "Peru",
  "Colombia", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay", "United Kingdom", "Ireland", "France", "Germany", "Italy",
  "Spain", "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Czech Republic", "Hungary", "Romania", "Greece",
  "Sweden", "Norway", "Denmark", "Finland", "China", "Japan", "South Korea", "North Korea", "Mongolia", "India", "Pakistan",
  "Bangladesh", "Sri Lanka", "Nepal", "Indonesia", "Malaysia", "Singapore", "Thailand", "Vietnam", "Philippines", "Cambodia", "Laos",
  "Myanmar", "Iran", "Iraq", "Turkey", "Saudi Arabia", "Israel", "Jordan", "Egypt", "Morocco", "Algeria", "Tunisia", "Nigeria",
  "Ghana", "Kenya", "Ethiopia", "Tanzania", "South Africa", "Democratic Republic of the Congo", "Australia", "New Zealand"
];

const WORLD_LEADERS: Record<string, string[]> = {
  "United Kingdom": ["Benjamin Disraeli", "William Ewart Gladstone", "Marquess of Salisbury", "Arthur Balfour", "Henry Campbell-Bannerman", "H. H. Asquith", "David Lloyd George", "Bonar Law", "Stanley Baldwin", "Ramsay MacDonald", "Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden", "Harold Macmillan", "Alec Douglas-Home", "Harold Wilson", "Edward Heath", "James Callaghan", "Margaret Thatcher", "John Major", "Tony Blair", "Gordon Brown", "David Cameron", "Theresa May", "Boris Johnson", "Liz Truss", "Rishi Sunak", "Keir Starmer"],
  France: ["Adolphe Thiers", "Patrice de MacMahon", "Jules Grévy", "Sadi Carnot", "Félix Faure", "Émile Loubet", "Armand Fallières", "Raymond Poincaré", "Paul Deschanel", "Alexandre Millerand", "Gaston Doumergue", "Paul Doumer", "Albert Lebrun", "Charles de Gaulle", "René Coty", "Georges Pompidou", "Valéry Giscard d'Estaing", "François Mitterrand", "Jacques Chirac", "Nicolas Sarkozy", "François Hollande", "Emmanuel Macron"],
  Germany: ["Otto von Bismarck", "Leo von Caprivi", "Chlodwig zu Hohenlohe-Schillingsfürst", "Bernhard von Bülow", "Theobald von Bethmann Hollweg", "Friedrich Ebert", "Gustav Stresemann", "Heinrich Brüning", "Adolf Hitler", "Konrad Adenauer", "Ludwig Erhard", "Kurt Georg Kiesinger", "Willy Brandt", "Helmut Schmidt", "Helmut Kohl", "Gerhard Schröder", "Angela Merkel", "Olaf Scholz", "Friedrich Merz"],
  India: ["Warren Hastings", "Lord Cornwallis", "Lord Wellesley", "Lord Dalhousie", "Lord Canning", "Lord Curzon", "Mahatma Gandhi", "Jawaharlal Nehru", "Lal Bahadur Shastri", "Indira Gandhi", "Morarji Desai", "Rajiv Gandhi", "V. P. Singh", "P. V. Narasimha Rao", "Atal Bihari Vajpayee", "Manmohan Singh", "Narendra Modi"],
  Canada: ["John A. Macdonald", "Alexander Mackenzie", "John Abbott", "John Thompson", "Mackenzie Bowell", "Wilfrid Laurier", "Robert Borden", "Arthur Meighen", "William Lyon Mackenzie King", "R. B. Bennett", "Louis St. Laurent", "John Diefenbaker", "Lester B. Pearson", "Pierre Trudeau", "Joe Clark", "Brian Mulroney", "Kim Campbell", "Jean Chrétien", "Paul Martin", "Stephen Harper", "Justin Trudeau", "Mark Carney"],
  Australia: ["Edmund Barton", "Alfred Deakin", "George Reid", "Andrew Fisher", "Billy Hughes", "Stanley Bruce", "Joseph Lyons", "Robert Menzies", "John Curtin", "Ben Chifley", "Harold Holt", "John Gorton", "William McMahon", "Gough Whitlam", "Malcolm Fraser", "Bob Hawke", "Paul Keating", "John Howard", "Kevin Rudd", "Julia Gillard", "Tony Abbott", "Malcolm Turnbull", "Scott Morrison", "Anthony Albanese"],
  Japan: ["Itō Hirobumi", "Yamagata Aritomo", "Katsura Tarō", "Saionji Kinmochi", "Hara Takashi", "Takahashi Korekiyo", "Tanaka Giichi", "Inukai Tsuyoshi", "Fumimaro Konoe", "Hideki Tojo", "Shigeru Yoshida", "Shigeru Ishiba", "Hayato Ikeda", "Eisaku Satō", "Kakuei Tanaka", "Yasuhiro Nakasone", "Junichiro Koizumi", "Shinzo Abe", "Yoshihide Suga", "Fumio Kishida"],
  China: ["Sun Yat-sen", "Yuan Shikai", "Chiang Kai-shek", "Mao Zedong", "Deng Xiaoping", "Jiang Zemin", "Hu Jintao", "Xi Jinping"],
  Russia: ["Nicholas II", "Vladimir Lenin", "Joseph Stalin", "Nikita Khrushchev", "Leonid Brezhnev", "Mikhail Gorbachev", "Boris Yeltsin", "Vladimir Putin", "Dmitry Medvedev"],
  Mexico: ["Porfirio Díaz", "Francisco I. Madero", "Venustiano Carranza", "Álvaro Obregón", "Plutarco Elías Calles", "Lázaro Cárdenas", "Adolfo López Mateos", "Gustavo Díaz Ordaz", "Luis Echeverría", "José López Portillo", "Miguel de la Madrid", "Carlos Salinas", "Ernesto Zedillo", "Vicente Fox", "Felipe Calderón", "Enrique Peña Nieto", "Andrés Manuel López Obrador", "Claudia Sheinbaum"],
  Brazil: ["Deodoro da Fonseca", "Getúlio Vargas", "Juscelino Kubitschek", "João Goulart", "Ernesto Geisel", "João Figueiredo", "José Sarney", "Fernando Collor", "Fernando Henrique Cardoso", "Luiz Inácio Lula da Silva", "Dilma Rousseff", "Michel Temer", "Jair Bolsonaro"],
  Italy: ["Camillo Cavour", "Giovanni Giolitti", "Benito Mussolini", "Alcide De Gasperi", "Aldo Moro", "Giulio Andreotti", "Bettino Craxi", "Silvio Berlusconi", "Romano Prodi", "Matteo Renzi", "Giorgia Meloni"],
  Spain: ["Antonio Cánovas del Castillo", "Práxedes Mateo Sagasta", "Miguel Primo de Rivera", "Francisco Franco", "Adolfo Suárez", "Leopoldo Calvo-Sotelo", "Felipe González", "José María Aznar", "José Luis Rodríguez Zapatero", "Mariano Rajoy", "Pedro Sánchez"],
  "South Africa": ["Jan Smuts", "J. B. M. Hertzog", "Daniel Malan", "Hendrik Verwoerd", "John Vorster", "P. W. Botha", "F. W. de Klerk", "Nelson Mandela", "Thabo Mbeki", "Jacob Zuma", "Cyril Ramaphosa"]
};

const WORLD_EVENTS: Record<string, string[]> = {
  France: ["Dreyfus Affair", "French Revolution and Republican Government", "Paris Commune", "French Resistance", "Fifth Republic"],
  India: ["Sepoy Rebellion of 1857", "Indian National Congress and Independence", "Partition of India", "Emergency in India", "Economic Liberalization"],
  "United Kingdom": ["Reform Acts", "Irish Home Rule", "World War Elections", "Creation of the Welfare State", "Devolution", "Brexit and Constitutional Change"],
  Germany: ["German Unification", "Weimar Republic", "Nazi Dictatorship", "Division and Reunification", "European Integration"],
  Japan: ["Meiji Restoration", "Taishō Democracy", "Militarism and World War II", "Postwar Constitution", "Economic Miracle"],
  China: ["1911 Revolution", "Chinese Civil War", "Great Leap Forward", "Cultural Revolution", "Reform and Opening"],
  Russia: ["1905 Revolution", "Russian Revolution", "Soviet Union", "Dissolution of the Soviet Union", "Post-Soviet Politics"],
  "South Africa": ["Union of South Africa", "Apartheid", "Sharpeville", "Negotiated Transition", "Truth and Reconciliation Commission"]
};

const genericWorldEvents = ["State Formation and Constitutional Change", "Major Wars and Political Crises", "Political Parties and Social Movements", "Decolonization and International Relations", "Modern Government and Elections"];

const politicalSubtopics = ["Institutions and Powers", "Major Events and Decisions", "Political Parties and Elections", "Scandals and Controversies", "Records and Firsts"];

export function buildUnitedStatesPoliticalHistory(): TopicSeed {
  const presidents = PRESIDENTIAL_TERMS.map((term) => branch(term, politicalSubtopics));
  const vicePresidents = VICE_PRESIDENT_TERMS.map((term) => branch(term, ["Vice-Presidential Duties", "Succession and Vacancy", "Major Initiatives and Controversies"]));
  const stateBranches = STATES.map((state) => branch(state, stateHistoryChildren(state)));
  const localBranches = STATES.map((state) => branch(state, [
    `Statehood and Constitutional Beginnings (${statehoodYear(state)})`,
    "Political Eras from Statehood to the Present", "State Elections and Political Parties", "Governors and Legislatures", "Major Local Political Events"
  ]));

  return branch("U.S. Political History", [
    branch("Presidents", [
      ...presidents,
      branch("Presidential Slogans and Campaigns", ["Campaign Slogans", "Inaugural Themes", "Reelection Campaigns", "Third-Party Presidential Campaigns"]),
      branch("Presidential Records", ["Longest Presidency", "Shortest Presidency", "Youngest and Oldest Presidents", "Presidential Elections and Popular Vote", "Presidential Firsts", "Presidential Libraries"]),
      branch("Presidential Corruption Scandals", PRESIDENTIAL_SCANDALS),
      branch("Other Presidential Scandals", ["Personal and Ethical Controversies", "Pardon and Patronage Controversies", "Executive Conflict of Interest", "Presidential Records and Transparency", "Other Presidential Scandals"])
    ]),
    branch("Vice Presidents", vicePresidents),
    branch("Elections", [
      branch("Presidential", PRESIDENTIAL_ELECTIONS),
      branch("Senate", ELECTION_CYCLES.map((cycle) => `Senate ${cycle}`)),
      branch("House", ELECTION_CYCLES.map((cycle) => `House ${cycle}`)),
      branch("General Elections", ELECTION_CYCLES.map((cycle) => `General ${cycle}`)),
      branch("Election Administration and Voting Rights", ["Expansion of Suffrage", "Voting Rights Act", "Electoral College", "Recounts and Contested Elections", "Campaign Finance"])
    ]),
    branch("Congress", [
      branch("Congresses and Sessions", CONGRESS_LABELS),
      branch("Senate", ["Senate Powers and Procedure", "Senate Committees", "Senate Advice and Consent"]),
      branch("House", ["House Powers and Procedure", "House Committees", "Appropriations and Revenue"]),
      branch("Joint Sessions and Constitutional Duties", ["State of the Union", "Electoral Count", "Impeachment Proceedings", "Constitutional Amendments"])
    ]),
    branch("Senate", [
      branch("Senate Eras", ["Early Senate", "Antebellum Senate", "Civil War and Reconstruction Senate", "Progressive Era Senate", "New Deal Senate", "Cold War Senate", "Modern Senate"]),
      branch("Famous Senators", FAMOUS_SENATORS),
      branch("Senate Elections and Representation", ELECTION_CYCLES.map((cycle) => `Senate ${cycle}`)),
      branch("Senate Committees and Leadership", ["Party Leaders", "Committee Chairs", "Filibuster and Cloture", "Advice and Consent"]),
      branch("Senate Corruption Scandals", CONGRESSIONAL_SCANDALS),
      branch("Other Senate Scandals", ["Personal Misconduct and Ethics Cases", "Lobbying and Influence", "Campaign Finance", "Other Senate Scandals"]),
      branch("Senate Records", ["Longest-Serving Senators", "Youngest Senators", "Senate Firsts", "Record Votes and Debates", "Historic Confirmations"])
    ]),
    branch("House", [
      branch("House Eras", ["Early House", "Antebellum House", "Civil War and Reconstruction House", "Progressive Era House", "New Deal House", "Civil Rights Era House", "Modern House"]),
      branch("Congresses During Each Speakership", CONGRESS_LABELS.map((label, index) => `${label} — ${HOUSE_SPEAKERS_BY_CONGRESS[index] ?? "Speakership"} Tenure`)),
      branch("Famous House Members", FAMOUS_HOUSE_MEMBERS),
      branch("House Elections and Representation", ELECTION_CYCLES.map((cycle) => `House ${cycle}`)),
      branch("House Corruption Scandals", CONGRESSIONAL_SCANDALS),
      branch("Other House Scandals", ["House Ethics Investigations", "Lobbying and Influence", "Campaign Finance", "Other House Scandals"]),
      branch("House Records", ["Longest-Serving Representatives", "Youngest Representatives", "House Firsts", "Historic Impeachments", "Historic Speeches"])
    ]),
    branch("Cabinet", [
      branch("History of the Cabinet", ["Washington's Cabinet", "Growth of the Executive Departments", "Cabinet Government and the Presidency", "Cabinet-Level Offices", "Modern Cabinet Appointments"]),
      ...CABINET_POSITIONS.map((position) => branch(position, ["Institutional History", "Secretaries and Leadership", "Major Decisions and Controversies"])),
      branch("Cabinet Corruption Scandals", CABINET_SCANDALS),
      branch("Other Cabinet Scandals", ["Conflicts of Interest", "Patronage and Appointments", "Procurement and Contracting", "Other Cabinet Scandals"]),
      branch("Cabinet Records", ["Longest-Serving Secretaries", "First Cabinet Officers", "Cabinet Vacancies and Succession", "Historic Cabinet Meetings"])
    ]),
    branch("Governors", stateBranches),
    branch("Supreme Court", [
      branch("Supreme Court Eras", SUPREME_COURT_ERAS),
      branch("Courts During Each Chief Justice Tenure", SUPREME_COURT_TENURES),
      branch("Justices and Court Membership", ["First Justices", "Women Justices", "Black Justices", "Court Expansion and Membership", "Judicial Conference"]),
      branch("Supreme Court Records", ["Longest-Serving Justices", "Youngest Justices", "Firsts on the Court", "Historic Opinions", "Court Procedures"]),
      branch("Supreme Court Scandals and Controversies", ["Ethics and Recusal", "Confirmation Controversies", "Court-Packing Debate", "Other Court Controversies"])
    ], ["Supreme Court History"]),
    branch("Famous Court Cases", FAMOUS_COURT_CASES),
    branch("Local Histories", localBranches),
    branch("Political Parties", POLITICAL_PARTIES),
    branch("Other Political Scandals", [
      "Petticoat Affair", "Whiskey Ring", "Star Route Scandal", "Mugwump Reform and Patronage", "Ballinger–Pinchot Controversy",
      "Teapot Dome", "Pecora Investigation", "Army–McCarthy Hearings", "Pentagon Papers and Executive Secrecy", "Savings and Loan Political Influence",
      "Jack Abramoff Lobbying Scandal", "Enron Political Connections", "Lobbying Disclosure Controversies", "Campaign Finance Investigations",
      "Executive Branch Ethics Investigations", "Other State and Local Political Scandals"
    ])
  ]);
}

export function buildWorldPoliticalHistory(): TopicSeed {
  return branch("World Political History", worldCountries.map((country) => {
    const leaders = WORLD_LEADERS[country] || ["Historical Leaders and Governments", "Modern National Leaders", "Short-Term and Transitional Leaders"];
    const events = WORLD_EVENTS[country] || genericWorldEvents;
    return branch(country, [branch("Leaders and Governments", leaders), branch("Major Political Events", events), branch("Political Institutions and Parties", ["Constitutional Development", "Political Parties and Elections", "Local and Regional Government", "International Relations"])])
  }));
}

export const POLITICAL_HISTORY_CATALOG_SOURCES = [
  "https://www.archives.gov/research/census/presidents",
  "https://www.senate.gov/about/officers-staff/vice-presidents.htm",
  "https://history.house.gov/People/Office/Speakers/",
  "https://www.senate.gov/artandhistory/history/resources/pdf/chronlist.pdf",
  "https://www.supremecourt.gov/visiting/highlightsbrochure_may2026.pdf"
] as const;
