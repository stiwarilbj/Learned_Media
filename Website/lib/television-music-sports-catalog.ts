import type { TopicSeed } from "./topic-catalog";

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): TopicSeed => ({ label, children, ...(aliases.length ? { aliases } : {}) });
const leaf = (label: string, aliases: string[] = []): TopicSeed => branch(label, [], aliases);
const leaves = (labels: string[]) => labels.map((label) => leaf(label));
const grouped = (label: string, groups: Array<[string, string[]]>): TopicSeed => branch(label, groups.map(([name, items]) => branch(name, leaves(items))));
const team = (label: string, periods: string[] = ["Founding and Early Years", "Defining Franchise Era", "Modern Era"]): TopicSeed => branch(label, leaves(periods));
const league = (label: string, teams: Array<[string, string[]]>, players: string[], awards: string[], history: string[]): TopicSeed => branch(label, [
  branch("History", leaves(history)),
  ...teams.map(([name, periods]) => team(name, periods)),
  branch("Best Players", leaves(players)),
  branch("Awards", leaves(awards))
]);

const TELEVISION_SHOWS = [
  "24", "30 Rock", "Alfred Hitchcock Presents", "Alias", "All in the Family", "American Idol", "The Americans", "The Andy Griffith Show", "Arrested Development", "Atlanta", "Band of Brothers", "Barry", "Battlestar Galactica", "Beavis and Butt-Head", "Better Call Saul", "Beverly Hills, 90210", "Black Mirror", "Boardwalk Empire", "The Bob Newhart Show", "BoJack Horseman", "Borgen", "Breaking Bad", "Buffy the Vampire Slayer", "The Carol Burnett Show", "Chappelle's Show", "Cheers", "Chernobyl", "Columbo", "Community", "The Cosby Show", "The Crown", "Curb Your Enthusiasm", "The Daily Show", "Dallas", "Deadwood", "Dexter", "The Dick Van Dyke Show", "Doctor Who", "Downton Abbey", "ER", "Fargo", "Fawlty Towers", "Firefly", "Fleabag", "Frasier", "Freaks and Geeks", "The Fresh Prince of Bel-Air", "Friday Night Lights", "Friends", "Futurama", "Game of Thrones", "Gilmore Girls", "Girls", "The Golden Girls", "The Good Place", "Good Times", "The Good Wife", "Grey's Anatomy", "Happy Days", "The Handmaid's Tale", "Hill Street Blues", "Homeland", "Homicide: Life on the Street", "The Honeymooners", "House", "House of Cards", "I Love Lucy", "I May Destroy You", "In Living Color", "It's Always Sunny in Philadelphia", "The Jeffersons", "Jeopardy!", "The Larry Sanders Show", "Late Night with David Letterman", "Law & Order", "The Leftovers", "Lost", "Louie", "M*A*S*H", "Mad Men", "The Mary Tyler Moore Show", "Modern Family", "Monty Python's Flying Circus", "The Muppet Show", "My So-Called Life", "Mystery Science Theater 3000", "NYPD Blue", "The Office", "The Oprah Winfrey Show", "Orange Is the New Black", "Oz", "Parks and Recreation", "Prime Suspect", "The Prisoner", "The Real World", "Rick and Morty", "Roots", "Roseanne", "Saturday Night Live", "Seinfeld", "Sesame Street", "Sex and the City", "Sherlock", "The Shield", "The Simpsons", "Six Feet Under", "The Sopranos", "South Park", "St. Elsewhere", "Star Trek: The Next Generation", "Star Trek: The Original Series", "Stranger Things", "Succession", "Survivor", "Taxi", "The Tonight Show Starring Johnny Carson", "True Detective", "The Twilight Zone", "Twin Peaks", "Veep", "Watchmen", "The West Wing", "Will & Grace", "The Wire", "The Wonder Years", "The X-Files", "Your Show of Shows"
];

const TELEVISION_GENRES: Array<[string, string[]]> = [
  ["Sitcoms", ["I Love Lucy", "The Dick Van Dyke Show", "Cheers", "Friends", "Frasier", "Seinfeld", "The Golden Girls", "The Office", "The Bob Newhart Show", "The Andy Griffith Show", "Community", "Modern Family", "Parks and Recreation", "Will & Grace", "30 Rock", "Arrested Development", "Curb Your Enthusiasm", "The Fresh Prince of Bel-Air", "The Jeffersons", "Good Times", "Happy Days", "Taxi"]],
  ["Soap Operas", ["General Hospital", "Days of Our Lives", "The Young and the Restless", "The Bold and the Beautiful", "Guiding Light", "As the World Turns", "One Life to Live", "All My Children", "Another World", "Dallas", "Dynasty", "Beverly Hills, 90210", "Succession", "The Crown"]],
  ["Crime and Detective Dramas", ["Columbo", "NYPD Blue", "Homicide: Life on the Street", "Law & Order", "The Shield", "Dexter", "The Wire", "The Sopranos", "Breaking Bad", "Better Call Saul", "Fargo", "True Detective", "Sherlock", "Prime Suspect", "Oz"]],
  ["Political and Historical Dramas", ["The West Wing", "House of Cards", "Borgen", "The Crown", "Boardwalk Empire", "Deadwood", "Band of Brothers", "Roots", "Chernobyl", "Mad Men", "The Americans", "The Handmaid's Tale", "Succession"]],
  ["Medical and Legal Dramas", ["ER", "Grey's Anatomy", "House", "St. Elsewhere", "The Good Wife", "Law & Order", "The Good Doctor", "The Practice", "Boston Legal"]],
  ["Teen and Coming-of-Age Dramas", ["My So-Called Life", "Freaks and Geeks", "Friday Night Lights", "Gilmore Girls", "Girls", "The Wonder Years", "Buffy the Vampire Slayer", "Stranger Things", "Orange Is the New Black"]],
  ["Science Fiction and Fantasy", ["Doctor Who", "Battlestar Galactica", "Firefly", "The X-Files", "The Twilight Zone", "Black Mirror", "Star Trek: The Original Series", "Star Trek: The Next Generation", "Game of Thrones", "Watchmen", "Lost", "The Prisoner", "The Leftovers"]],
  ["Animated Series", ["The Simpsons", "South Park", "Futurama", "Rick and Morty", "BoJack Horseman", "Beavis and Butt-Head", "In Living Color", "Mystery Science Theater 3000"]],
  ["Sketch, Variety, and Late Night", ["Saturday Night Live", "The Carol Burnett Show", "The Muppet Show", "Monty Python's Flying Circus", "Chappelle's Show", "The Daily Show", "The Larry Sanders Show", "Late Night with David Letterman", "The Tonight Show Starring Johnny Carson", "Your Show of Shows", "The Oprah Winfrey Show"]],
  ["Reality and Competition", ["American Idol", "Survivor", "The Real World", "Jeopardy!", "Sesame Street", "The Daily Show"]],
  ["Horror and Psychological Thriller", ["The Twilight Zone", "Twin Peaks", "The Haunting", "The Prisoner", "Hannibal", "The Returned", "Black Mirror", "Chernobyl", "The Leftovers"]],
  ["Documentary and Factual", ["Band of Brothers", "The Real World", "The Daily Show", "Mystery Science Theater 3000", "Alfred Hitchcock Presents"]],
  ["Children's and Family", ["Sesame Street", "The Muppet Show", "Doctor Who", "The Wonder Years", "The Andy Griffith Show", "The Simpsons", "Star Trek: The Original Series"]]
];

const TELEVISION_ERAS: Array<[string, string[]]> = [
  ["1950s and 1960s", ["I Love Lucy", "The Honeymooners", "The Twilight Zone", "The Dick Van Dyke Show", "The Andy Griffith Show", "The Carol Burnett Show", "Star Trek: The Original Series", "The Prisoner", "The Tonight Show Starring Johnny Carson"]],
  ["1970s", ["All in the Family", "M*A*S*H", "The Mary Tyler Moore Show", "The Bob Newhart Show", "Good Times", "The Jeffersons", "Happy Days", "The Muppet Show", "Roots", "Taxi", "Saturday Night Live"]],
  ["1980s", ["Cheers", "The Golden Girls", "The Cosby Show", "The Oprah Winfrey Show", "Hill Street Blues", "The Wonder Years", "The Simpsons", "The Fresh Prince of Bel-Air", "The X-Files"]],
  ["1990s", ["Seinfeld", "Friends", "ER", "The Sopranos", "The West Wing", "The Larry Sanders Show", "Buffy the Vampire Slayer", "The Real World", "Law & Order", "The Daily Show", "Sex and the City", "The X-Files"]],
  ["2000s", ["The Wire", "Lost", "The Office", "Arrested Development", "Deadwood", "The Shield", "Battlestar Galactica", "House", "Friday Night Lights", "Mad Men", "Futurama", "Survivor"]],
  ["2010s", ["Breaking Bad", "Game of Thrones", "Better Call Saul", "Fleabag", "Atlanta", "Chernobyl", "Black Mirror", "The Crown", "The Handmaid's Tale", "The Good Place", "BoJack Horseman", "Stranger Things", "Orange Is the New Black"]],
  ["2020s", ["Succession", "I May Destroy You", "Watchmen", "The Queen's Gambit", "The Last of Us", "Severance", "The Bear", "The White Lotus", "The Morning Show", "Ted Lasso"]]
];

function buildTelevisionTopic(): TopicSeed {
  return branch("Television", [
    branch("All-Time General List", leaves(TELEVISION_SHOWS)),
    grouped("By Type and Genre", TELEVISION_GENRES),
    grouped("By Era", TELEVISION_ERAS),
    branch("Daytime and Soap Operas", [
      branch("Daytime Soap Operas", leaves(["General Hospital", "Days of Our Lives", "The Young and the Restless", "The Bold and the Beautiful", "Guiding Light", "As the World Turns", "One Life to Live", "All My Children", "Another World", "Search for Tomorrow", "The Edge of Night"])),
      branch("Primetime Soap Operas", leaves(["Dallas", "Dynasty", "Knots Landing", "Falcon Crest", "Beverly Hills, 90210", "Melrose Place", "Succession", "The O.C.", "Desperate Housewives"])),
      branch("International Soap Operas", leaves(["EastEnders", "Coronation Street", "Emmerdale", "Neighbours", "Hollyoaks", "The Archers", "La Madrastra", "Yo soy Betty, la fea"]))
    ])
  ]);
}

const BEST_SELLING_ARTISTS: Array<[string, string[]]> = [
  ["The Beatles", ["Beatles"]], ["Michael Jackson", []], ["Elvis Presley", []], ["Madonna", []], ["Elton John", []], ["Queen", []], ["Led Zeppelin", []], ["Rihanna", []], ["Pink Floyd", []], ["Eminem", []], ["Mariah Carey", []], ["Whitney Houston", []], ["Taylor Swift", []], ["Beyoncé", ["Beyonce"]], ["Ed Sheeran", []], ["AC/DC", ["AC DC"]], ["Eagles", []], ["Celine Dion", []], ["The Rolling Stones", ["Rolling Stones"]], ["Drake", []], ["Garth Brooks", []], ["U2", []], ["Kanye West", []], ["Coldplay", []], ["Billy Joel", []], ["Katy Perry", []], ["Justin Bieber", []], ["Bruno Mars", []], ["Britney Spears", []], ["Metallica", []], ["Bruce Springsteen", []], ["Aerosmith", []], ["Phil Collins", []], ["Barbra Streisand", []], ["ABBA", []], ["Julio Iglesias", []], ["Frank Sinatra", []], ["Chris Brown", []], ["Jay-Z", []], ["Lady Gaga", []], ["Lil Wayne", []], ["Maroon 5", []], ["Adele", []], ["Red Hot Chili Peppers", []], ["Bon Jovi", []], ["Fleetwood Mac", []], ["Rod Stewart", []], ["Bee Gees", []], ["Dire Straits", []], ["Roberto Carlos", []], ["Nicki Minaj", []], ["Linkin Park", []], ["George Strait", []], ["Journey", []], ["Pink", []], ["Christina Aguilera", []], ["Guns N' Roses", []], ["Shania Twain", []], ["B'z", ["B-Z"]], ["Backstreet Boys", []], ["Eric Clapton", []], ["Neil Diamond", []], ["Prince", []], ["Paul McCartney", []], ["Janet Jackson", []], ["Kenny Rogers", []], ["The Doors", []], ["Santana", []], ["Simon & Garfunkel", []], ["The Beach Boys", []], ["George Michael", []], ["Foreigner", []], ["Bob Dylan", []], ["Chicago", []], ["Cher", []], ["Meat Loaf", []], ["The Carpenters", []], ["Earth, Wind & Fire", []], ["David Bowie", []], ["Def Leppard", []], ["Stevie Wonder", []], ["Genesis", []], ["Gloria Estefan", []], ["Tina Turner", []], ["James Taylor", []], ["Olivia Newton-John", []], ["Linda Ronstadt", []], ["Donna Summer", []], ["Diana Ross", []], ["The Supremes", []], ["Shakira", []], ["Ariana Grande", []], ["Alicia Keys", []], ["Tim McGraw", []], ["Lionel Richie", []], ["Andrea Bocelli", []], ["Johnny Cash", []], ["Justin Timberlake", []], ["Pearl Jam", []], ["R.E.M.", ["REM"]], ["Kelly Clarkson", []], ["Post Malone", []], ["Flo Rida", []], ["Usher", []], ["The Black Eyed Peas", []], ["Van Halen", []], ["Ayumi Hamasaki", []], ["Tom Petty", []], ["Johnny Hallyday", []], ["The Weeknd", []], ["Imagine Dragons", []], ["Luke Bryan", []], ["Tupac Shakur", ["2Pac"]], ["Nirvana", []], ["Oasis", []], ["Green Day", []], ["Alabama", []], ["R. Kelly", []], ["Robbie Williams", []], ["Bob Seger", []], ["Kenny G", []], ["Enya", []], ["Bryan Adams", []], ["Bob Marley", []], ["The Police", []], ["Barry Manilow", []], ["Kiss", []], ["Aretha Franklin", []]
];

const MUSIC_GENRES: Array<[string, string[]]> = [
  ["Pop", ["Michael Jackson", "Madonna", "Taylor Swift", "Beyoncé", "Adele", "Britney Spears", "Ariana Grande", "The Weeknd", "Justin Bieber", "Katy Perry", "Lady Gaga", "Whitney Houston"]],
  ["Rock", ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd", "The Rolling Stones", "AC/DC", "U2", "Eagles", "Fleetwood Mac", "Nirvana", "Green Day", "The Police", "David Bowie"]],
  ["Hard Rock and Heavy Metal", ["Metallica", "Guns N' Roses", "Bon Jovi", "Def Leppard", "Van Halen", "Kiss", "Aerosmith", "Judas Priest", "Black Sabbath", "Iron Maiden"]],
  ["R&B and Soul", ["Michael Jackson", "Whitney Houston", "Beyoncé", "Rihanna", "Usher", "Alicia Keys", "Aretha Franklin", "Diana Ross", "The Supremes", "Stevie Wonder", "Marvin Gaye"]],
  ["Hip-Hop and Rap", ["Eminem", "Drake", "Kanye West", "Jay-Z", "Nicki Minaj", "Lil Wayne", "Tupac Shakur", "Post Malone", "Flo Rida", "The Black Eyed Peas"]],
  ["Country", ["Garth Brooks", "George Strait", "Shania Twain", "Tim McGraw", "Johnny Cash", "Kenny Rogers", "Luke Bryan", "Alabama", "Taylor Swift", "Dolly Parton"]],
  ["Latin and Spanish-Language Music", ["Julio Iglesias", "Roberto Carlos", "Shakira", "Gloria Estefan", "Santana", "Enrique Iglesias", "Luis Miguel", "Daddy Yankee", "Bad Bunny", "Celia Cruz"]],
  ["Disco and Dance", ["Donna Summer", "ABBA", "Bee Gees", "Diana Ross", "Gloria Estefan", "The Black Eyed Peas", "Kylie Minogue", "Daft Punk"]],
  ["Folk and Singer-Songwriters", ["Bob Dylan", "Paul McCartney", "James Taylor", "Bruce Springsteen", "Simon & Garfunkel", "Johnny Cash", "Joni Mitchell", "Carole King", "Neil Young"]],
  ["Jazz and Standards", ["Frank Sinatra", "Barbra Streisand", "Tony Bennett", "Ella Fitzgerald", "Louis Armstrong", "Diana Krall", "Nat King Cole", "Norah Jones"]],
  ["Classical and Operatic Pop", ["Andrea Bocelli", "Luciano Pavarotti", "Sarah Brightman", "Josh Groban", "Enya", "Il Divo", "The Three Tenors"]],
  ["Reggae and Caribbean", ["Bob Marley", "The Police", "Santana", "Rihanna", "Sean Paul", "Jimmy Cliff", "Peter Tosh"]],
  ["Electronic and Dance Music", ["The Weeknd", "Lady Gaga", "Daft Punk", "David Guetta", "Calvin Harris", "Avicii", "Skrillex", "Marshmello"]],
  ["K-Pop and J-Pop", ["B'z", "Ayumi Hamasaki", "BTS", "Hikaru Utada", "BoA", "Girls' Generation", "BLACKPINK", "Babymetal"]],
  ["Alternative and Indie", ["Radiohead", "Coldplay", "Imagine Dragons", "The Killers", "Oasis", "Pearl Jam", "R.E.M.", "Arctic Monkeys", "The Cure"]]
];

function buildMusicTopic(): TopicSeed {
  return branch("Music", [
    branch("Best-Selling Music Artists", BEST_SELLING_ARTISTS.map(([name, aliases]) => leaf(name, aliases))),
    grouped("By Genre and Subgenre", MUSIC_GENRES),
    grouped("By Reported Claimed Sales Tier", [
      ["250 Million or More", BEST_SELLING_ARTISTS.slice(0, 7).map(([name]) => name)],
      ["200 Million to 249 Million", BEST_SELLING_ARTISTS.slice(7, 19).map(([name]) => name)],
      ["150 Million to 199 Million", BEST_SELLING_ARTISTS.slice(19, 34).map(([name]) => name)],
      ["120 Million to 149 Million", BEST_SELLING_ARTISTS.slice(34, 51).map(([name]) => name)],
      ["100 Million to 119 Million", BEST_SELLING_ARTISTS.slice(51, 84).map(([name]) => name)],
      ["75 Million to 99 Million", BEST_SELLING_ARTISTS.slice(84).map(([name]) => name)]
    ]),
    grouped("By Music Era", [
      ["1930s to 1950s", ["Frank Sinatra", "Elvis Presley", "Nat King Cole", "Ella Fitzgerald", "Johnny Cash"]],
      ["1960s and 1970s", ["The Beatles", "The Rolling Stones", "Aretha Franklin", "Led Zeppelin", "ABBA", "Bob Marley", "David Bowie"]],
      ["1980s and 1990s", ["Michael Jackson", "Madonna", "Whitney Houston", "Prince", "Mariah Carey", "Nirvana", "Tupac Shakur"]],
      ["2000s and 2010s", ["Eminem", "Beyoncé", "Rihanna", "Taylor Swift", "Drake", "Adele", "Bruno Mars"]],
      ["2020s", ["The Weeknd", "Bad Bunny", "BTS", "Taylor Swift", "Ariana Grande", "Ed Sheeran"]]
    ])
  ]);
}

const NBA_TEAMS: Array<[string, string[]]> = [
  ["Atlanta Hawks", ["Tri-Cities and Milwaukee Years", "St. Louis Hawks Era", "Atlanta and Dominique Wilkins Era", "Modern Era"]], ["Boston Celtics", ["Founding Years", "Bill Russell Dynasty", "Larry Bird Era", "Big Three Era", "Modern Era"]], ["Brooklyn Nets", ["New Jersey Nets Years", "Jason Kidd Era", "Brooklyn Move", "Modern Era"]], ["Charlotte Hornets", ["Original Charlotte Years", "Bobcats Era", "Return of the Hornets", "Modern Era"]], ["Chicago Bulls", ["Founding Years", "Michael Jordan Dynasty", "Post-Jordan Rebuild", "Modern Era"]], ["Cleveland Cavaliers", ["Founding Years", "LeBron James First Era", "2016 Championship", "Modern Era"]], ["Dallas Mavericks", ["Founding Years", "Dirk Nowitzki Era", "2011 Championship", "Luka Dončić Era"]], ["Denver Nuggets", ["ABA and Early NBA Years", "Alex English Era", "Carmelo Anthony Era", "Nikola Jokić Era"]], ["Detroit Pistons", ["Bad Boys Era", "Going to Work Era", "Modern Rebuild"]], ["Golden State Warriors", ["Philadelphia Warriors Years", "Run TMC Era", "We Believe Era", "Stephen Curry Dynasty"]], ["Houston Rockets", ["San Diego and Early Houston Years", "Hakeem Olajuwon Era", "Yao Ming Era", "Modern Era"]], ["Indiana Pacers", ["ABA Pacers Era", "Reggie Miller Era", "Malcolm Brogdon and Modern Era"]], ["LA Clippers", ["Buffalo and San Diego Years", "Lob City Era", "Kawhi Leonard Era"]], ["Los Angeles Lakers", ["Minneapolis Lakers Years", "Showtime Era", "Shaq and Kobe Era", "Kobe and Pau Era", "LeBron James Era"]], ["Memphis Grizzlies", ["Vancouver Years", "Grit and Grind Era", "Ja Morant Era"]], ["Miami Heat", ["Expansion Years", "Alonzo Mourning Era", "Heatles Era", "Jimmy Butler Era"]], ["Milwaukee Bucks", ["Expansion Years", "Kareem Abdul-Jabbar Era", "Big Three and 2001 Run", "Giannis Antetokounmpo Era"]], ["Minnesota Timberwolves", ["Expansion Years", "Kevin Garnett Era", "Modern Era"]], ["New Orleans Pelicans", ["Charlotte and New Orleans Hornets Years", "Anthony Davis Era", "Modern Era"]], ["New York Knicks", ["Founding Years", "Early Championship Era", "1970s Championship Teams", "Patrick Ewing Era", "Modern Era"]], ["Oklahoma City Thunder", ["Seattle SuperSonics Years", "Kevin Durant and Russell Westbrook Era", "Modern Era"]], ["Orlando Magic", ["Expansion Years", "Shaquille O'Neal and Penny Hardaway Era", "Dwight Howard Era", "Modern Era"]], ["Philadelphia 76ers", ["Syracuse Nationals Years", "Wilt Chamberlain Era", "Julius Erving Era", "Allen Iverson Era", "Modern Era"]], ["Phoenix Suns", ["Expansion Years", "The Original Suns Finals Run", "Steve Nash Era", "Charles Barkley Era", "Modern Era"]], ["Portland Trail Blazers", ["Founding Years", "1977 Championship", "Clyde Drexler Era", "Modern Era"]], ["Sacramento Kings", ["Rochester and Cincinnati Years", "Kansas City-Omaha Years", "Chris Webber Era", "Modern Era"]], ["San Antonio Spurs", ["Dallas Chaparrals and ABA Years", "David Robinson Era", "Twin Towers Era", "Tim Duncan Dynasty", "Modern Era"]], ["Toronto Raptors", ["Expansion Years", "Vince Carter Era", "2019 Championship", "Modern Era"]], ["Utah Jazz", ["New Orleans Jazz Years", "Stockton and Malone Era", "Modern Era"]], ["Washington Wizards", ["Baltimore Bullets Years", "1978 Championship", "Wes Unseld and Elvin Hayes Era", "Modern Era"]]
];

const NBA_TOP_100 = [
  "Michael Jordan", "LeBron James", "Kareem Abdul-Jabbar", "Bill Russell", "Magic Johnson", "Wilt Chamberlain", "Larry Bird", "Tim Duncan", "Shaquille O'Neal", "Hakeem Olajuwon", "Kobe Bryant", "Stephen Curry", "Kevin Durant", "Oscar Robertson", "Jerry West", "Julius Erving", "Moses Malone", "Karl Malone", "Kevin Garnett", "Dirk Nowitzki", "Giannis Antetokounmpo", "David Robinson", "Charles Barkley", "John Havlicek", "Elgin Baylor", "Dwyane Wade", "Isiah Thomas", "Chris Paul", "John Stockton", "Scottie Pippen", "Kawhi Leonard", "Nikola Jokić", "Jason Kidd", "Steve Nash", "Bob Pettit", "Rick Barry", "George Gervin", "Patrick Ewing", "Clyde Drexler", "Allen Iverson", "Russell Westbrook", "James Harden", "Dominique Wilkins", "Reggie Miller", "Paul Pierce", "Ray Allen", "Kevin McHale", "Willis Reed", "Walt Frazier", "Bob Cousy", "Dave Cowens", "Elvin Hayes", "Wes Unseld", "Robert Parish", "Dwight Howard", "Damian Lillard", "Anthony Davis", "Chris Webber", "Carmelo Anthony", "Tracy McGrady", "Vince Carter", "Gary Payton", "Manu Ginóbili", "Pau Gasol", "Dennis Rodman", "Draymond Green", "Klay Thompson", "Jimmy Butler", "Kyrie Irving", "Jayson Tatum", "Joel Embiid", "Luka Dončić", "James Worthy", "Bill Walton", "Artis Gilmore", "Nate Thurmond", "Dave DeBusschere", "Bernard King", "Grant Hill", "Yao Ming", "Amar'e Stoudemire", "LaMarcus Aldridge", "Tony Parker", "Chauncey Billups", "Ben Wallace", "Dikembe Mutombo", "Chris Bosh", "DeMar DeRozan", "Paul George", "Andre Iguodala", "Shawn Marion", "Rasheed Wallace", "Alex English", "Mitch Richmond", "Sidney Moncrief", "Jo Jo White", "Lou Hudson", "Shawn Kemp", "Mark Price", "Tim Hardaway"
];

const NBA_AWARDS = ["Most Valuable Player", "Finals Most Valuable Player", "Defensive Player of the Year", "Rookie of the Year", "Most Improved Player", "Sixth Man of the Year", "Coach of the Year", "All-NBA Teams", "All-Defensive Teams", "All-Star Game", "Scoring Champion", "Rebounding Leader", "Assist Leader", "Steals Leader", "Blocks Leader", "Three-Point Contest", "Slam Dunk Contest"];

const NFL_TEAMS: Array<[string, string[]]> = [
  ["Arizona Cardinals", ["Chicago Cardinals Years", "St. Louis Cardinals Years", "Arizona Move", "Modern Era"]], ["Atlanta Falcons", ["Expansion Years", "1998 Super Bowl Run", "Michael Vick Era", "Modern Era"]], ["Baltimore Ravens", ["Expansion Years", "2000 Championship Defense", "Joe Flacco Era", "Lamar Jackson Era"]], ["Buffalo Bills", ["AFL Years", "K-Gun and Four Super Bowls", "1990s Rebuild", "Modern Era"]], ["Carolina Panthers", ["Expansion Years", "1996 NFC Championship Run", "Cam Newton Era", "Modern Era"]], ["Chicago Bears", ["Decatur Staleys Years", "Monsters of the Midway", "1985 Championship", "Modern Era"]], ["Cincinnati Bengals", ["Expansion Years", "Freezer Bowl Era", "The 2000s Rebuild", "Joe Burrow Era"]], ["Cleveland Browns", ["AAFC and Founding Years", "Paul Brown Era", "The Kardiac Kids", "Modern Era"]], ["Dallas Cowboys", ["Founding Years", "Doomsday Defense", "Triplets Dynasty", "Tony Romo Era", "Modern Era"]], ["Denver Broncos", ["AFL and Early Years", "Orange Crush Defense", "John Elway Era", "Peyton Manning Era", "Modern Era"]], ["Detroit Lions", ["Portsmouth and Early Years", "Bobby Layne Era", "Barry Sanders Era", "Modern Era"]], ["Green Bay Packers", ["Curly Lambeau Era", "Vince Lombardi Dynasty", "Brett Favre Era", "Aaron Rodgers Era", "Modern Era"]], ["Houston Texans", ["Expansion Years", "Andre Johnson Era", "J.J. Watt Era", "Modern Era"]], ["Indianapolis Colts", ["Baltimore Colts Years", "Johnny Unitas Era", "Peyton Manning Era", "Andrew Luck Era"]], ["Jacksonville Jaguars", ["Expansion Years", "1990s Playoff Era", "Modern Era"]], ["Kansas City Chiefs", ["Dallas Texans Years", "Hank Stram Era", "Len Dawson Era", "Patrick Mahomes Era"]], ["Las Vegas Raiders", ["Oakland AFL Years", "John Madden Dynasty", "Los Angeles Years", "Las Vegas Move"]], ["Los Angeles Chargers", ["Los Angeles and San Diego Years", "Air Coryell Era", "Philip Rivers Era", "Modern Era"]], ["Los Angeles Rams", ["Cleveland Rams Years", "Greatest Show on Turf", "St. Louis Years", "Sean McVay Era"]], ["Miami Dolphins", ["Expansion Years", "Perfect Season", "Dan Marino Era", "Modern Era"]], ["Minnesota Vikings", ["Expansion Years", "Purple People Eaters", "Four Super Bowl Era", "Modern Era"]], ["New England Patriots", ["Boston Patriots Years", "Parcells Era", "Brady-Belichick Dynasty", "Modern Era"]], ["New Orleans Saints", ["Expansion Years", "Dome Patrol", "Drew Brees Era", "Modern Era"]], ["New York Giants", ["Founding Years", "1950s Championship Teams", "Parcells Era", "Manning Era", "Modern Era"]], ["New York Jets", ["Titans Years", "1968 Championship", "Namath Era", "Modern Era"]], ["Philadelphia Eagles", ["Founding Years", "1960 Championship", "Buddy Ryan Era", "Reid and McNabb Era", "Modern Era"]], ["Pittsburgh Steelers", ["Founding Years", "Steel Curtain Dynasty", "Bradshaw Era", "Ben Roethlisberger Era", "Modern Era"]], ["San Francisco 49ers", ["Founding Years", "Montana and Walsh Dynasty", "Young Era", "Harbaugh Era", "Modern Era"]], ["Seattle Seahawks", ["Expansion Years", "Legion of Boom", "Russell Wilson Era", "Modern Era"]], ["Tampa Bay Buccaneers", ["Expansion Years", "1979 Defense", "Gruden Championship", "Modern Era"]], ["Tennessee Titans", ["Houston Oilers Years", "Run and Shoot Era", "Music City Miracle", "Modern Era"]], ["Washington Commanders", ["Boston and Early Years", "Hogs and Gibbs Dynasty", "1991 Championship", "Modern Era"]]
];

const NFL_BEST_PLAYERS = ["Tom Brady", "Jerry Rice", "Jim Brown", "Lawrence Taylor", "Joe Montana", "Peyton Manning", "Walter Payton", "Emmitt Smith", "Reggie White", "Johnny Unitas", "Randy Moss", "Deion Sanders", "Barry Sanders", "Gale Sayers", "Ray Lewis", "Anthony Munoz", "Joe Greene", "Dick Butkus", "Rob Gronkowski", "Tony Gonzalez", "Drew Brees", "Aaron Rodgers", "Patrick Mahomes", "Dan Marino", "Steve Young", "John Elway", "Bruce Smith", "Alan Page", "Earl Campbell", "Eric Dickerson", "Marshall Faulk", "Adrian Peterson", "LaDainian Tomlinson", "Junior Seau", "Ronnie Lott", "Rod Woodson", "Darrell Green", "Willie Brown", "Troy Polamalu", "Ed Reed", "J.J. Watt", "Aaron Donald", "Calvin Johnson", "Terrell Owens", "Devin Hester", "Adam Vinatieri", "Morten Andersen", "Hugh McElhenny", "Franco Harris", "Lynn Swann"];
const NFL_AWARDS = ["Most Valuable Player", "Super Bowl Most Valuable Player", "Defensive Player of the Year", "Offensive Player of the Year", "Offensive Rookie of the Year", "Defensive Rookie of the Year", "Comeback Player of the Year", "Coach of the Year", "Walter Payton Man of the Year", "All-Pro Teams", "Pro Bowl", "Passing Champion", "Rushing Champion", "Receiving Champion", "Defensive Interceptions Leader", "Sack Leader"];

const MLB_TEAMS: Array<[string, string[]]> = [
  ["Arizona Diamondbacks", ["Expansion Years", "2001 World Series", "Modern Era"]], ["Atlanta Braves", ["Boston and Milwaukee Years", "1990s Division Dynasty", "John Smoltz and Chipper Jones Era", "Modern Era"]], ["Baltimore Orioles", ["St. Louis Browns Years", "Brooks Robinson Era", "Earl Weaver Era", "Modern Era"]], ["Boston Red Sox", ["Early Years", "Babe Ruth and Curse of the Bambino", "2004 Championship", "Modern Era"]], ["Chicago Cubs", ["Early Years", "1908 Championship and Drought", "2016 Championship", "Modern Era"]], ["Chicago White Sox", ["Early Years", "1917 Championship", "Black Sox Scandal", "2005 Championship", "Modern Era"]], ["Cincinnati Reds", ["Early Years", "Big Red Machine", "1990 Championship", "Modern Era"]], ["Cleveland Guardians", ["Cleveland Spiders and Early Years", "1948 Championship", "Modern Era"]], ["Colorado Rockies", ["Expansion Years", "1995 Wild Card Era", "Modern Era"]], ["Detroit Tigers", ["Early Years", "Ty Cobb Era", "1968 Championship", "1984 Championship", "Modern Era"]], ["Houston Astros", ["Colt .45s Years", "Killer B's Era", "2017 Championship", "Modern Era"]], ["Kansas City Royals", ["Expansion Years", "1985 Championship", "2015 Championship", "Modern Era"]], ["Los Angeles Angels", ["Los Angeles and California Angels Years", "1979 Playoff Era", "2002 Championship", "Modern Era"]], ["Los Angeles Dodgers", ["Brooklyn Dodgers Years", "Sandy Koufax Era", "Fernandomania", "Gibson and Hershiser Era", "Modern Era"]], ["Miami Marlins", ["Florida Marlins Years", "1997 and 2003 Championships", "Modern Era"]], ["Milwaukee Brewers", ["Seattle Pilots Years", "1982 Pennant", "Modern Era"]], ["Minnesota Twins", ["Washington Senators Years", "Killer B's Era", "1987 and 1991 Championships", "Modern Era"]], ["New York Mets", ["Expansion Years", "1969 Miracle Mets", "1986 Championship", "Modern Era"]], ["New York Yankees", ["Early Years", "Babe Ruth and Murderers' Row", "Casey Stengel Dynasty", "Reggie and Steinbrenner Era", "Jeter Dynasty", "Modern Era"]], ["Oakland Athletics", ["Philadelphia Athletics Years", "Swingin' A's", "Bash Brothers Era", "Moneyball Era", "Modern Era"]], ["Philadelphia Phillies", ["Early Years", "1950 Whiz Kids", "1980 Championship", "2008 Championship", "Modern Era"]], ["Pittsburgh Pirates", ["Early Years", "Honus Wagner Era", "We Are Family", "Andrew McCutchen Era", "Modern Era"]], ["San Diego Padres", ["Expansion Years", "Tony Gwynn Era", "1998 World Series Run", "Modern Era"]], ["San Francisco Giants", ["New York Giants Years", "Willie Mays Era", "2010s Championships", "Modern Era"]], ["Seattle Mariners", ["Expansion Years", "Ken Griffey Jr. Era", "2001 Record Season", "Modern Era"]], ["St. Louis Cardinals", ["Early Years", "Gashouse Gang", "Stan Musial Era", "Whiteyball", "Modern Era"]], ["Tampa Bay Rays", ["Devil Rays Years", "2008 Pennant", "Modern Era"]], ["Texas Rangers", ["Washington Senators Years", "Early Rangers Years", "2010 and 2011 World Series Runs", "Modern Era"]], ["Toronto Blue Jays", ["Expansion Years", "1992 and 1993 Championships", "Modern Era"]], ["Washington Nationals", ["Montreal Expos Years", "Washington Move", "2019 Championship", "Modern Era"]]
];

const MLB_BEST_PLAYERS = ["Babe Ruth", "Willie Mays", "Hank Aaron", "Ty Cobb", "Walter Johnson", "Ted Williams", "Lou Gehrig", "Stan Musial", "Mickey Mantle", "Cy Young", "Honus Wagner", "Jackie Robinson", "Sandy Koufax", "Barry Bonds", "Rogers Hornsby", "Tris Speaker", "Christy Mathewson", "Joe DiMaggio", "Frank Robinson", "Roberto Clemente", "Pete Rose", "Greg Maddux", "Nolan Ryan", "Tom Seaver", "Randy Johnson", "Pedro Martínez", "Albert Pujols", "Ichiro Suzuki", "Derek Jeter", "Mike Trout", "Rickey Henderson", "Cal Ripken Jr.", "George Brett", "Tony Gwynn", "Ozzie Smith", "Cal Ripken Sr.", "Yogi Berra", "Johnny Bench", "Mike Schmidt", "Ernie Banks", "Eddie Mathews", "Eddie Collins", "Jimmie Foxx", "Mel Ott", "Carl Yastrzemski", "Roberto Alomar", "Jeff Bagwell", "Chipper Jones", "Ken Griffey Jr.", "Adrian Beltre"];
const MLB_AWARDS = ["Most Valuable Player", "Cy Young Award", "Rookie of the Year", "Manager of the Year", "Reliever of the Year", "Comeback Player of the Year", "World Series Most Valuable Player", "Gold Glove Award", "Silver Slugger Award", "Batting Champion", "Home Run Leader", "Runs Batted In Leader", "Stolen Base Leader", "Strikeout Leader", "No-Hitter", "Perfect Game", "All-Star Game"];

const SOCCER_LEAGUES: Array<[string, Array<[string, string[]]>]> = [
  ["Premier League", [["Arsenal", ["Early Years", "Invincibles Era", "Modern Era"]], ["Chelsea", ["Founding Years", "Mourinho Era", "Abramovich Era", "Modern Era"]], ["Liverpool", ["Founding Years", "Shankly and Paisley Dynasty", "Premier League Rebuild", "Klopp Era"]], ["Manchester City", ["Founding Years", "First Division Era", "Abu Dhabi Era", "Modern Era"]], ["Manchester United", ["Busby Babes", "Ferguson Dynasty", "Post-Ferguson Era"]], ["Tottenham Hotspur", ["Early Years", "Bill Nicholson Era", "Modern Era"]]]],
  ["La Liga", [["Barcelona", ["Founding Years", "Cruyff and Dream Team", "Guardiola Era", "Modern Era"]], ["Real Madrid", ["Early Years", "Di Stéfano Era", "Galácticos Era", "Modern Era"]], ["Atlético Madrid", ["Early Years", "Simeone Era", "Modern Era"]], ["Athletic Bilbao", ["Founding Years", "Basque Policy Era", "Modern Era"]]]],
  ["Bundesliga", [["Bayern Munich", ["Founding Years", "Beckenbauer Era", "Heynckes Era", "Modern Dynasty"]], ["Borussia Dortmund", ["Founding Years", "Hitzfeld Era", "Klopp Era", "Modern Era"]], ["Bayer Leverkusen", ["Founding Years", "Neverkusen Era", "2024 Championship"]], ["Schalke 04", ["Founding Years", "Ruhr Rivalry Era", "Modern Era"]]]],
  ["Serie A", [["Juventus", ["Founding Years", "Trapattoni Era", "Calciopoli", "Modern Era"]], ["AC Milan", ["Gre-No-Li Era", "Sacchi Dynasty", "Ancelotti Era", "Modern Era"]], ["Inter Milan", ["Founding Years", "Grande Inter", "Treble Era", "Modern Era"]], ["Roma", ["Founding Years", "Totti Era", "Modern Era"]]]],
  ["Ligue 1", [["Paris Saint-Germain", ["Founding Years", "QSI Era", "Modern Era"]], ["Olympique de Marseille", ["Founding Years", "1993 Champions League", "Modern Era"]], ["Lyon", ["Founding Years", "Seven-Time Dynasty", "Modern Era"]], ["Monaco", ["Founding Years", "1990s Era", "Modern Era"]]]],
  ["Major League Soccer", [["LA Galaxy", ["Founding Years", "Beckham Era", "Modern Era"]], ["Seattle Sounders", ["MLS Arrival", "2010s Championships", "Modern Era"]], ["Atlanta United", ["Founding Years", "2018 Championship", "Modern Era"]], ["Inter Miami", ["Founding Years", "Messi Era"]]]]
];
const SOCCER_PLAYERS = ["Pelé", "Lionel Messi", "Diego Maradona", "Cristiano Ronaldo", "Johan Cruyff", "Franz Beckenbauer", "Zinedine Zidane", "Ronaldo Nazário", "Alfredo Di Stéfano", "Michel Platini", "Ferenc Puskás", "Garrincha", "George Best", "Paolo Maldini", "Xavi", "Andrés Iniesta", "Ronaldinho", "Eusébio", "Bobby Charlton", "Lev Yashin"];
const SOCCER_AWARDS = ["Ballon d'Or", "FIFA World Cup Golden Ball", "Golden Boot", "UEFA Player of the Year", "FIFA World Player of the Year", "UEFA Champions League Records", "World Cup Records", "Manager of the Year"];

const CRICKET_NATIONAL_TEAMS: Array<[string, string[]]> = [
  ["Australia", ["Early Test Cricket", "Bradman Era", "World Series Cricket", "Ponting Era", "Modern Era"]], ["England", ["Early Test Cricket", "Bodyline Series", "1980s Rebuild", "Bazball Era", "Modern Era"]], ["India", ["Early Test Cricket", "Gavaskar Era", "1983 World Cup", "Tendulkar and Ganguly Era", "Kohli Era", "Modern Era"]], ["New Zealand", ["Early Test Cricket", "Hadlee Era", "2015 and 2019 World Cups", "Modern Era"]], ["Pakistan", ["Early Test Cricket", "Hanif Mohammad Era", "Imran Khan World Cup", "Wasim and Waqar Era", "Modern Era"]], ["South Africa", ["Early Test Cricket", "Isolation Years", "Return to International Cricket", "Modern Era"]], ["Sri Lanka", ["Early Test Cricket", "1996 World Cup", "Murali Era", "Modern Era"]], ["West Indies", ["Early Test Cricket", "Sobers Era", "Clive Lloyd Dynasty", "T20 Era", "Modern Era"]], ["Bangladesh", ["Associate Years", "Test Status", "2015 World Cup", "Modern Era"]], ["Afghanistan", ["Associate Years", "Full Member Era", "Modern Era"]], ["Zimbabwe", ["Early Test Cricket", "1999 World Cup", "Modern Era"]], ["Ireland", ["Associate Years", "2011 World Cup", "Test Status", "Modern Era"]]
];
const CRICKET_FORMATS = ["Test Cricket", "One Day Internationals", "Twenty20 Internationals", "First-Class Cricket", "List A Cricket", "Twenty20 Cricket", "The Hundred", "T10 Cricket"];
const IPL_TEAMS: Array<[string, string[]]> = [["Chennai Super Kings", ["Founding Years", "2008–2013 Core", "2018 Return", "Modern Era"]], ["Delhi Capitals", ["Delhi Daredevils Years", "2019 Rebrand", "Modern Era"]], ["Gujarat Titans", ["Expansion Years", "2022 Championship", "Modern Era"]], ["Kolkata Knight Riders", ["Founding Years", "2012 and 2014 Championships", "Modern Era"]], ["Lucknow Super Giants", ["Expansion Years", "Modern Era"]], ["Mumbai Indians", ["Founding Years", "2013–2020 Dynasty", "Modern Era"]], ["Punjab Kings", ["Kings XI Punjab Years", "2008 Final", "Rebrand Era"]], ["Rajasthan Royals", ["2008 Inaugural Championship", "Rebuilding Years", "2022 Final"]], ["Royal Challengers Bengaluru", ["Founding Years", "Three Finals Era", "Modern Era"]], ["Sunrisers Hyderabad", ["Founding Years", "2016 Championship", "Modern Era"]]];
const CRICKET_BEST_PLAYERS = ["Don Bradman", "Sachin Tendulkar", "Garfield Sobers", "Shane Warne", "Muttiah Muralitharan", "Jacques Kallis", "Viv Richards", "Brian Lara", "Wasim Akram", "Imran Khan", "Ricky Ponting", "Kumar Sangakkara", "Virat Kohli", "MS Dhoni", "AB de Villiers", "Glenn McGrath", "Wasim Bari", "Kapil Dev", "Sunil Gavaskar", "Babar Azam", "Ben Stokes", "Joe Root", "James Anderson", "Kane Williamson", "Steve Smith", "Lasith Malinga", "Adam Gilchrist", "Matthew Hayden", "Chris Gayle", "Dale Steyn"];

const OTHER_SPORTS: Array<[string, string[]]> = [
  ["Tennis", ["History of Tennis", "Grand Slam Tournaments", "ATP Tour", "WTA Tour", "Davis Cup", "Billie Jean King Cup", "Greatest Players"]],
  ["Golf", ["History of Golf", "The Masters", "U.S. Open", "The Open Championship", "PGA Championship", "PGA Tour", "Greatest Golfers"]],
  ["Ice Hockey", ["History of Ice Hockey", "National Hockey League", "Stanley Cup", "International Ice Hockey", "Greatest Players"]],
  ["Rugby", ["History of Rugby", "Rugby World Cup", "Six Nations", "The Rugby Championship", "Super Rugby", "Greatest Players"]],
  ["Volleyball", ["History of Volleyball", "Olympic Volleyball", "FIVB World Championship", "Beach Volleyball", "Greatest Players"]],
  ["Table Tennis", ["History of Table Tennis", "Olympic Table Tennis", "World Table Tennis Championships", "Greatest Players"]],
  ["Badminton", ["History of Badminton", "Thomas Cup", "Uber Cup", "BWF World Championships", "Greatest Players"]],
  ["Boxing", ["History of Boxing", "Heavyweight Champions", "World Boxing Organizations", "Olympic Boxing", "Greatest Boxers"]],
  ["Mixed Martial Arts", ["History of MMA", "Ultimate Fighting Championship", "Pride Fighting Championships", "Women in MMA", "Greatest Fighters"]],
  ["Wrestling", ["Ancient Wrestling", "Olympic Wrestling", "Professional Wrestling", "WWE", "Greatest Wrestlers"]],
  ["Athletics and Track and Field", ["History of Athletics", "Sprints", "Distance Running", "Jumps", "Throws", "Decathlon and Heptathlon", "Greatest Athletes"]],
  ["Swimming", ["History of Swimming", "Olympic Swimming", "Open-Water Swimming", "World Records", "Greatest Swimmers"]],
  ["Gymnastics", ["History of Gymnastics", "Artistic Gymnastics", "Rhythmic Gymnastics", "Trampoline", "Greatest Gymnasts"]],
  ["Cycling", ["History of Cycling", "Tour de France", "Giro d'Italia", "Vuelta a España", "Track Cycling", "Greatest Cyclists"]],
  ["Formula One", ["History of Formula One", "World Drivers' Championship", "Constructors' Championship", "Legendary Circuits", "Greatest Drivers"]],
  ["Motorsport", ["MotoGP", "NASCAR", "IndyCar", "World Rally Championship", "24 Hours of Le Mans", "Greatest Drivers"]],
  ["Skiing and Snowboarding", ["History of Alpine Skiing", "Olympic Alpine Skiing", "Cross-Country Skiing", "Ski Jumping", "Snowboarding", "Greatest Athletes"]],
  ["Figure Skating", ["History of Figure Skating", "Olympic Figure Skating", "World Figure Skating Championships", "Greatest Skaters"]],
  ["Rowing and Canoeing", ["History of Rowing", "Olympic Rowing", "Canoe Sprint", "Canoe Slalom", "Greatest Crews"]],
  ["Sailing", ["History of Sailing", "Olympic Sailing", "America's Cup", "The Ocean Race", "Greatest Sailors"]],
  ["Surfing", ["History of Surfing", "World Surf League", "Olympic Surfing", "Big-Wave Surfing", "Greatest Surfers"]],
  ["Skateboarding", ["History of Skateboarding", "Street Skateboarding", "Park Skateboarding", "Olympic Skateboarding", "Greatest Skaters"]],
  ["Archery", ["History of Archery", "Olympic Archery", "World Archery Championships", "Greatest Archers"]],
  ["Fencing", ["History of Fencing", "Foil", "Épée", "Sabre", "Olympic Fencing", "Greatest Fencers"]],
  ["Equestrian Sports", ["History of Equestrian Sport", "Dressage", "Show Jumping", "Eventing", "Horse Racing", "Greatest Riders"]],
  ["Lacrosse", ["History of Lacrosse", "Professional Lacrosse", "World Lacrosse Championship", "Greatest Players"]],
  ["Field Hockey", ["History of Field Hockey", "Olympic Field Hockey", "FIH Hockey World Cup", "Greatest Players"]],
  ["Handball", ["History of Handball", "Olympic Handball", "IHF World Championship", "Greatest Players"]],
  ["Darts", ["History of Darts", "PDC World Championship", "World Matchplay", "Greatest Players"]],
  ["Snooker and Billiards", ["History of Snooker", "World Snooker Championship", "English Billiards", "Pool", "Greatest Players"]]
];

const OLYMPIC_EVENTS = ["100 Metres", "200 Metres", "400 Metres", "800 Metres", "1500 Metres", "Marathon", "110 Metres Hurdles", "400 Metres Hurdles", "4 × 100 Metres Relay", "4 × 400 Metres Relay", "High Jump", "Long Jump", "Triple Jump", "Pole Vault", "Shot Put", "Discus Throw", "Hammer Throw", "Javelin Throw", "Decathlon", "Heptathlon", "Freestyle Swimming", "Backstroke", "Breaststroke", "Butterfly", "Individual Medley", "Swimming Relays", "Platform Diving", "Springboard Diving", "Water Polo", "Artistic Gymnastics", "Rhythmic Gymnastics", "Trampoline", "Road Cycling", "Track Cycling", "Mountain Biking", "BMX Racing", "BMX Freestyle", "Rowing", "Canoe Sprint", "Canoe Slalom", "Sailing", "Sport Climbing", "Skateboarding", "Surfing", "Archery", "Shooting", "Fencing", "Judo", "Taekwondo", "Boxing", "Wrestling", "Weightlifting", "Tennis", "Table Tennis", "Badminton", "Basketball", "3×3 Basketball", "Football", "Rugby Sevens", "Field Hockey", "Volleyball", "Beach Volleyball", "Equestrian Dressage", "Equestrian Eventing", "Equestrian Show Jumping", "Alpine Skiing", "Cross-Country Skiing", "Ski Jumping", "Freestyle Skiing", "Snowboard", "Figure Skating", "Speed Skating", "Short-Track Speed Skating", "Ice Hockey", "Curling", "Bobsleigh", "Luge", "Skeleton"];

function buildSportsTopic(): TopicSeed {
  const nbaAwards = NBA_AWARDS;
  const nflAwards = NFL_AWARDS;
  const mlbAwards = MLB_AWARDS;
  return branch("Sports", [
    branch("Major Sports Ranked", leaves(["Basketball", "American Football", "Baseball", "Soccer", "Cricket"])),
    branch("Basketball", [
      branch("Basketball History", leaves(["Origins and Early Rules", "Basketball in the United States", "Professional Basketball", "International Basketball", "Women's Basketball", "Basketball Tactics and Rule Changes"])),
      league("NBA", NBA_TEAMS, NBA_TOP_100, nbaAwards, ["BAA and Founding Years", "Bill Russell and Celtics Dynasty", "ABA-NBA Merger", "Magic Johnson and Larry Bird Era", "Michael Jordan Era", "Global Expansion", "Modern Analytics Era"]),
      league("WNBA", [["Atlanta Dream", ["Founding Years", "Modern Era"]], ["Chicago Sky", ["Founding Years", "2014 Championship", "Modern Era"]], ["Connecticut Sun", ["Orlando Miracle Years", "Connecticut Era", "Modern Era"]], ["Las Vegas Aces", ["San Antonio Stars Years", "Las Vegas Move", "Championship Era"]], ["Los Angeles Sparks", ["Founding Years", "Lisa Leslie Era", "Modern Era"]], ["New York Liberty", ["Founding Years", "Early Finals Era", "Modern Era"]], ["Phoenix Mercury", ["Founding Years", "Diana Taurasi Era", "Modern Era"]], ["Seattle Storm", ["Founding Years", "Lauren Jackson Era", "Sue Bird Era", "Modern Era"]]], ["Diana Taurasi", "Sue Bird", "Lisa Leslie", "Candace Parker", "Maya Moore", "Sheryl Swoopes", "Tamika Catchings", "Lauren Jackson", "Breanna Stewart", "A'ja Wilson"], ["Most Valuable Player", "Finals Most Valuable Player", "Defensive Player of the Year", "Rookie of the Year", "Sixth Woman of the Year", "Coach of the Year"], ["Founding Years", "Early WNBA Dynasties", "Global Growth", "Modern Era"])
    ]),
    branch("American Football", [
      branch("American Football History", leaves(["Early Rules and Origins", "College Football", "American Football League", "National Football League", "Super Bowl Era", "Modern Passing Era", "Women's and Flag Football"])),
      league("NFL", NFL_TEAMS, NFL_BEST_PLAYERS, nflAwards, ["Early Professional Football", "American Football League and Merger", "Super Bowl Era", "Free Agency Era", "Modern Offense and Defense"]),
      branch("College Football", ["History of College Football", "College Football Playoff", "Rose Bowl", "Sugar Bowl", "Orange Bowl", "Historic Programs", "Greatest Coaches", "Greatest Players"].map((label) => leaf(label)))
    ]),
    branch("Baseball", [
      branch("Baseball History", leaves(["Origins of Baseball", "Dead-Ball Era", "Live-Ball Era", "Integration of Baseball", "Expansion Era", "Free Agency", "Analytics and Sabermetrics", "Women's Baseball and Softball"])),
      league("Major League Baseball", MLB_TEAMS, MLB_BEST_PLAYERS, mlbAwards, ["National League and American League Origins", "Dead-Ball Era", "Babe Ruth and the Live-Ball Era", "Integration and Jackie Robinson", "Expansion and Divisional Play", "Wild Card Era", "Analytics Era"]),
      branch("International Baseball", leaves(["World Baseball Classic", "Japanese Baseball", "Korean Baseball", "Cuban Baseball", "Caribbean Baseball", "Greatest International Players"]))
    ]),
    branch("Soccer", [
      branch("Soccer History", leaves(["Ancient Ball Games", "Association Football Rules", "Football Association Origins", "Professional Soccer", "Women's Soccer", "Globalization of Soccer", "Tactical Revolutions"])),
      ...SOCCER_LEAGUES.map(([name, teams]) => league(name, teams, SOCCER_PLAYERS, SOCCER_AWARDS, ["Founding and Early Years", "Professional Expansion", "Modern Global Era"])),
      branch("International Competitions", leaves(["FIFA World Cup", "UEFA European Championship", "Copa América", "Africa Cup of Nations", "AFC Asian Cup", "CONCACAF Gold Cup", "UEFA Champions League", "Copa Libertadores", "FIFA Women's World Cup"])),
      branch("Women's Soccer", leaves(["History of Women's Soccer", "FIFA Women's World Cup", "National Women's Soccer League", "Women's Super League", "UEFA Women's Champions League", "Greatest Women's Players"]))
    ]),
    branch("Cricket", [
      branch("Cricket History", leaves(["Origins of Cricket", "County Cricket", "Test Cricket Origins", "One-Day Cricket", "Twenty20 Revolution", "Women's Cricket", "Cricket in South Asia", "Cricket in the Caribbean"])),
      branch("Formats", leaves(CRICKET_FORMATS)),
      league("Indian Premier League", IPL_TEAMS, CRICKET_BEST_PLAYERS, ["Orange Cap", "Purple Cap", "Most Valuable Player", "Emerging Player of the Year", "Player of the Match", "Fair Play Award"], ["Founding Season", "Early Franchise Era", "Super Over and Playoff Era", "Expansion and Modern Era"]),
      branch("Cricket National Teams", CRICKET_NATIONAL_TEAMS.map(([name, periods]) => team(name, periods))),
      branch("International Cricket Competitions", leaves(["Cricket World Cup", "T20 World Cup", "World Test Championship", "Champions Trophy", "Women's Cricket World Cup", "Women's T20 World Cup", "The Ashes", "Border-Gavaskar Trophy", "India-Pakistan Cricket Rivalry"])),
      branch("Greatest Cricket Players", leaves(CRICKET_BEST_PLAYERS))
    ]),
    branch("Other Sports", OTHER_SPORTS.map(([name, topics]) => branch(name, leaves(topics)))),
    branch("Olympics", [
      branch("Ancient Olympic Games", leaves(["Olympia", "Ancient Events", "Olympic Truce", "End of the Ancient Games"])),
      branch("Modern Olympic History", leaves(["1896 Athens", "1900 Paris", "1908 London", "1936 Berlin", "1948 London", "1964 Tokyo", "1980 Moscow", "1984 Los Angeles", "1992 Barcelona", "2008 Beijing", "2012 London", "2016 Rio", "2020 Tokyo", "2024 Paris"])),
      branch("Summer Olympic Events", leaves(OLYMPIC_EVENTS.slice(0, 62))),
      branch("Winter Olympic Events", leaves(OLYMPIC_EVENTS.slice(62))),
      branch("Records", [])
    ])
  ]);
}

export const TELEVISION_MUSIC_SPORTS_CATALOG_METADATA = {
  televisionSource: "https://en.wikipedia.org/wiki/Lists_of_television_programs_considered_the_best",
  musicSource: "https://en.wikipedia.org/wiki/List_of_best-selling_music_artists",
  sportsSources: [
    "https://en.wikipedia.org/wiki/List_of_NBA_teams",
    "https://en.wikipedia.org/wiki/List_of_NFL_franchises",
    "https://en.wikipedia.org/wiki/List_of_Major_League_Baseball_teams",
    "https://en.wikipedia.org/wiki/List_of_international_cricket_teams",
    "https://en.wikipedia.org/wiki/Olympic_sports"
  ],
  verifiedAt: "2026-09-21",
  note: "Artist rankings are ordered by reported claimed worldwide sales and are estimates; sports team eras and player lists are curated historical reference categories, not official rankings."
} as const;

export function buildTelevisionMusicSportsTopics(): TopicSeed[] {
  return [buildTelevisionTopic(), buildMusicTopic(), buildSportsTopic()];
}
