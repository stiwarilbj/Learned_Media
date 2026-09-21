import type { TopicSeed } from "./topic-catalog";

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): TopicSeed => ({ label, children, ...(aliases.length ? { aliases } : {}) });
const movie = (label: string, aliases: string[] = []): TopicSeed => branch(label, [], aliases);
const movies = (titles: string[]) => titles.map((title) => movie(title));
const filmSeries = (label: string, titles: string[], aliases: string[] = []): TopicSeed => branch(label, movies(titles), aliases);

const HIGHEST_GROSSING_SERIES: TopicSeed[] = [
  filmSeries("Marvel Cinematic Universe", ["Iron Man", "The Incredible Hulk", "Iron Man 2", "Thor", "Captain America: The First Avenger", "The Avengers", "Iron Man 3", "Thor: The Dark World", "Captain America: The Winter Soldier", "Guardians of the Galaxy", "Avengers: Age of Ultron", "Ant-Man", "Captain America: Civil War", "Doctor Strange", "Guardians of the Galaxy Vol. 2", "Spider-Man: Homecoming", "Thor: Ragnarok", "Black Panther", "Avengers: Infinity War", "Ant-Man and the Wasp", "Captain Marvel", "Avengers: Endgame", "Spider-Man: Far From Home", "Black Widow", "Shang-Chi and the Legend of the Ten Rings", "Eternals", "Spider-Man: No Way Home", "Doctor Strange in the Multiverse of Madness", "Thor: Love and Thunder", "Black Panther: Wakanda Forever", "Ant-Man and the Wasp: Quantumania", "Guardians of the Galaxy Vol. 3", "The Marvels", "Deadpool & Wolverine", "Captain America: Brave New World", "Thunderbolts*", "The Fantastic Four: First Steps"]),
  filmSeries("Spider-Man", ["Spider-Man", "Spider-Man 2", "Spider-Man 3", "The Amazing Spider-Man", "The Amazing Spider-Man 2", "Spider-Man: Homecoming", "Spider-Man: Into the Spider-Verse", "Spider-Man: Far From Home", "Spider-Man: No Way Home", "Spider-Man: Across the Spider-Verse", "Spider-Man: Brand New Day"]),
  filmSeries("Star Wars", ["Star Wars", "The Empire Strikes Back", "Return of the Jedi", "The Phantom Menace", "Attack of the Clones", "Revenge of the Sith", "The Force Awakens", "Rogue One: A Star Wars Story", "The Last Jedi", "Solo: A Star Wars Story", "The Rise of Skywalker"]),
  filmSeries("Wizarding World", ["Harry Potter and the Philosopher's Stone", "Harry Potter and the Chamber of Secrets", "Harry Potter and the Prisoner of Azkaban", "Harry Potter and the Goblet of Fire", "Harry Potter and the Order of the Phoenix", "Harry Potter and the Half-Blood Prince", "Harry Potter and the Deathly Hallows – Part 1", "Harry Potter and the Deathly Hallows – Part 2", "Fantastic Beasts and Where to Find Them", "Fantastic Beasts: The Crimes of Grindelwald", "Fantastic Beasts: The Secrets of Dumbledore"]),
  filmSeries("James Bond", ["Dr. No", "From Russia with Love", "Goldfinger", "Thunderball", "You Only Live Twice", "On Her Majesty's Secret Service", "Diamonds Are Forever", "Live and Let Die", "The Man with the Golden Gun", "The Spy Who Loved Me", "Moonraker", "For Your Eyes Only", "Octopussy", "A View to a Kill", "The Living Daylights", "Licence to Kill", "GoldenEye", "Tomorrow Never Dies", "The World Is Not Enough", "Die Another Day", "Casino Royale", "Quantum of Solace", "Skyfall", "Spectre", "No Time to Die"]),
  filmSeries("Avengers", ["The Avengers", "Avengers: Age of Ultron", "Avengers: Infinity War", "Avengers: Endgame"]),
  filmSeries("X-Men", ["X-Men", "X2", "X-Men: The Last Stand", "X-Men: First Class", "The Wolverine", "X-Men: Days of Future Past", "Deadpool", "X-Men: Apocalypse", "Logan", "Deadpool 2", "Dark Phoenix", "The New Mutants", "Deadpool & Wolverine"]),
  filmSeries("Fast & Furious", ["The Fast and the Furious", "2 Fast 2 Furious", "The Fast and the Furious: Tokyo Drift", "Fast & Furious", "Fast Five", "Fast & Furious 6", "Furious 7", "The Fate of the Furious", "F9", "Fast X", "Fast & Furious Presents: Hobbs & Shaw"]),
  filmSeries("DC Extended Universe", ["Man of Steel", "Batman v Superman: Dawn of Justice", "Suicide Squad", "Wonder Woman", "Justice League", "Aquaman", "Shazam!", "Birds of Prey", "Wonder Woman 1984", "The Suicide Squad", "Black Adam", "Shazam! Fury of the Gods", "The Flash", "Blue Beetle", "Aquaman and the Lost Kingdom"]),
  filmSeries("Batman", ["Batman (1966)", "Batman", "Batman Returns", "Batman Forever", "Batman & Robin", "Batman Begins", "The Dark Knight", "The Dark Knight Rises", "The Lego Batman Movie", "Joker", "The Batman", "Joker: Folie à Deux"]),
  filmSeries("Jurassic Park", ["Jurassic Park", "The Lost World: Jurassic Park", "Jurassic Park III", "Jurassic World", "Jurassic World: Fallen Kingdom", "Jurassic World Dominion", "Jurassic World Rebirth"]),
  filmSeries("Avatar", ["Avatar", "Avatar: The Way of Water", "Avatar: Fire and Ash"]),
  filmSeries("Despicable Me", ["Despicable Me", "Despicable Me 2", "Minions", "Despicable Me 3", "Minions: The Rise of Gru", "Despicable Me 4"]),
  filmSeries("Middle-earth", ["The Lord of the Rings: The Fellowship of the Ring", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King", "The Hobbit: An Unexpected Journey", "The Hobbit: The Desolation of Smaug", "The Hobbit: The Battle of the Five Armies"]),
  filmSeries("Transformers", ["Transformers", "Transformers: Revenge of the Fallen", "Transformers: Dark of the Moon", "Transformers: Age of Extinction", "Transformers: The Last Knight", "Bumblebee", "Transformers: Rise of the Beasts"]),
  filmSeries("Mission: Impossible", ["Mission: Impossible", "Mission: Impossible 2", "Mission: Impossible III", "Mission: Impossible – Ghost Protocol", "Mission: Impossible – Rogue Nation", "Mission: Impossible – Fallout", "Mission: Impossible – Dead Reckoning Part One", "Mission: Impossible – The Final Reckoning"]),
  filmSeries("Pirates of the Caribbean", ["The Curse of the Black Pearl", "Dead Man's Chest", "At World's End", "On Stranger Tides", "Dead Men Tell No Tales"]),
  filmSeries("Toy Story", ["Toy Story", "Toy Story 2", "Toy Story 3", "Toy Story 4", "Lightyear"]),
  filmSeries("Shrek", ["Shrek", "Shrek 2", "Shrek the Third", "Shrek Forever After", "Puss in Boots", "Puss in Boots: The Last Wish"]),
  filmSeries("The Twilight Saga", ["Twilight", "The Twilight Saga: New Moon", "The Twilight Saga: Eclipse", "The Twilight Saga: Breaking Dawn – Part 1", "The Twilight Saga: Breaking Dawn – Part 2"])
];

const HIGHEST_GROSSING_FILMS = movies(["Avatar", "Avengers: Endgame", "Avatar: The Way of Water", "Titanic", "Ne Zha 2", "Star Wars: The Force Awakens", "Avengers: Infinity War", "Spider-Man: No Way Home", "Zootopia 2", "Inside Out 2", "Jurassic World", "The Lion King (2019)", "The Avengers", "Furious 7", "Top Gun: Maverick", "Avatar: Fire and Ash", "Frozen 2", "Barbie", "Avengers: Age of Ultron", "The Super Mario Bros. Movie", "Black Panther", "Harry Potter and the Deathly Hallows – Part 2", "Deadpool & Wolverine", "Star Wars: The Last Jedi", "Jurassic World: Fallen Kingdom", "Frozen", "Beauty and the Beast (2017)", "Incredibles 2", "The Fate of the Furious", "Iron Man 3", "Minions", "Captain America: Civil War", "Aquaman", "The Lord of the Rings: The Return of the King", "Spider-Man: Far From Home", "Captain Marvel", "Transformers: Dark of the Moon", "Skyfall", "Transformers: Age of Extinction", "The Dark Knight Rises", "Joker", "Star Wars: The Rise of Skywalker", "Toy Story 4", "Toy Story 3", "Pirates of the Caribbean: Dead Man's Chest", "Moana 2", "Rogue One: A Star Wars Story", "The Lord of the Rings: The Two Towers", "Jurassic World Dominion", "The Super Mario Bros. Movie (1993)", "The Lion King (1994)", "Zootopia", "Inside Out", "Ne Zha", "Moana", "Deadpool", "Deadpool 2", "The Fellowship of the Ring", "The Curse of the Black Pearl", "Toy Story", "Toy Story 2"]);

const ADJUSTED_FOR_INFLATION = movies(["Gone with the Wind", "Avatar", "Titanic", "Star Wars", "Avengers: Endgame", "The Sound of Music", "E.T. the Extra-Terrestrial", "The Ten Commandments", "Doctor Zhivago", "Jaws"]);

const RELEASE_ERAS: TopicSeed[] = [
  branch("1910s and 1920s", movies(["The Birth of a Nation", "Intolerance", "Cleopatra (1917)", "Mickey", "The Miracle Man", "Way Down East", "The Four Horsemen of the Apocalypse", "Robin Hood", "The Covered Wagon", "The Sea Hawk", "The Big Parade", "Ben-Hur (1925)", "For Heaven's Sake", "Wings", "The Singing Fool", "The Broadway Melody"])),
  branch("1930s and 1940s", movies(["All Quiet on the Western Front", "Frankenstein", "City Lights", "King Kong", "I'm No Angel", "Cavalcade", "She Done Him Wrong", "The Merry Widow", "It Happened One Night", "Mutiny on the Bounty", "San Francisco", "Snow White and the Seven Dwarfs", "You Can't Take It with You", "Gone with the Wind", "The Wizard of Oz", "Pinocchio", "Boom Town", "Sergeant York", "Bambi", "Mrs. Miniver", "For Whom the Bell Tolls", "This Is the Army", "Going My Way", "Mom and Dad", "The Bells of St. Mary's", "Song of the South", "The Best Years of Our Lives", "Duel in the Sun", "Forever Amber", "Unconquered", "Easter Parade", "The Red Shoes", "The Snake Pit", "Samson and Delilah"])),
  branch("1950s and 1960s", movies(["King Solomon's Mines", "Quo Vadis", "This Is Cinerama", "The Greatest Show on Earth", "Peter Pan", "The Robe", "Rear Window", "White Christmas", "20,000 Leagues Under the Sea", "Lady and the Tramp", "Cinerama Holiday", "Mister Roberts", "The Ten Commandments", "The Bridge on the River Kwai", "South Pacific", "Ben-Hur (1959)", "Swiss Family Robinson", "Spartacus", "Psycho", "One Hundred and One Dalmatians", "West Side Story", "Lawrence of Arabia", "How the West Was Won", "The Longest Day", "Cleopatra (1963)", "From Russia with Love", "My Fair Lady", "Goldfinger", "Mary Poppins", "The Sound of Music", "The Bible: In the Beginning...", "Hawaii", "Who's Afraid of Virginia Woolf?", "The Jungle Book (1967)", "The Graduate", "2001: A Space Odyssey", "Funny Girl"])),
  branch("1970s and 1980s", movies(["Butch Cassidy and the Sundance Kid", "Love Story", "The French Connection", "Fiddler on the Roof", "Diamonds Are Forever", "The Godfather", "The Exorcist", "The Sting", "The Towering Inferno", "Jaws", "Rocky", "Star Wars", "Grease", "Moonraker", "Rocky II", "The Empire Strikes Back", "Raiders of the Lost Ark", "E.T. the Extra-Terrestrial", "Return of the Jedi", "Ghostbusters", "Back to the Future", "Top Gun", "Fatal Attraction", "Rain Man", "Indiana Jones and the Last Crusade"])),
  branch("1990s", movies(["Ghost", "Terminator 2: Judgment Day", "Aladdin (1992)", "Jurassic Park", "The Lion King (1994)", "Toy Story", "Die Hard with a Vengeance", "Independence Day", "Titanic", "Armageddon", "Star Wars: Episode I – The Phantom Menace"])),
  branch("2000s", movies(["Mission: Impossible 2", "Harry Potter and the Philosopher's Stone", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King", "Shrek 2", "Harry Potter and the Goblet of Fire", "Star Wars: Episode III – Revenge of the Sith", "Pirates of the Caribbean: Dead Man's Chest", "Pirates of the Caribbean: At World's End", "The Dark Knight", "Avatar"])),
  branch("2010s", movies(["Toy Story 3", "Harry Potter and the Deathly Hallows – Part 2", "The Avengers", "Frozen", "Transformers: Age of Extinction", "Star Wars: The Force Awakens", "Captain America: Civil War", "Star Wars: The Last Jedi", "Avengers: Infinity War", "Avengers: Endgame"])),
  branch("2020s", movies(["Demon Slayer: Kimetsu no Yaiba – The Movie: Mugen Train", "Spider-Man: No Way Home", "Avatar: The Way of Water", "Barbie", "Inside Out 2", "Ne Zha 2", "Zootopia 2", "Avatar: Fire and Ash", "The Super Mario Bros. Movie", "Deadpool & Wolverine", "Moana 2", "Lilo & Stitch (2025)", "Jurassic World Dominion", "Despicable Me 4", "Oppenheimer", "Spider-Man: Brand New Day"]))
];

const genre = (label: string, groups: Array<[string, string[]]>): TopicSeed => branch(label, groups.map(([name, titles]) => branch(name, movies(titles))));

const GENRE_BRANCHES: TopicSeed[] = [
  genre("Action and Adventure", [
    ["Superhero Blockbusters", ["Superman (1978)", "Batman Begins", "The Dark Knight", "Iron Man", "The Avengers", "Black Panther", "Wonder Woman", "Spider-Man: No Way Home", "Avengers: Endgame", "Deadpool & Wolverine"]],
    ["Spy and Espionage", ["Dr. No", "Goldfinger", "The Bourne Identity", "The Bourne Ultimatum", "Mission: Impossible – Fallout", "Skyfall", "Tinker Tailor Soldier Spy", "Kingsman: The Secret Service", "Atomic Blonde", "Argo"]],
    ["Martial Arts", ["Enter the Dragon", "The 36th Chamber of Shaolin", "Police Story", "Drunken Master", "Once Upon a Time in China", "Crouching Tiger, Hidden Dragon", "Hero", "Ip Man", "The Raid", "Everything Everywhere All at Once"]],
    ["Disaster and Survival", ["The Poseidon Adventure", "The Towering Inferno", "Earthquake", "Armageddon", "Deep Impact", "The Day After Tomorrow", "2012", "San Andreas", "Greenland", "Twisters"]],
    ["War and Military", ["The Bridge on the River Kwai", "Lawrence of Arabia", "The Great Escape", "Apocalypse Now", "Platoon", "Saving Private Ryan", "Black Hawk Down", "Dunkirk", "1917", "All Quiet on the Western Front"]],
    ["Heist and Crime Action", ["The French Connection", "The Godfather", "Heat", "The Usual Suspects", "Ocean's Eleven", "The Italian Job", "Inside Man", "Baby Driver", "The Town", "Logan Lucky"]],
    ["Adventure Epics", ["Raiders of the Lost Ark", "Indiana Jones and the Last Crusade", "The Mummy (1999)", "Pirates of the Caribbean: The Curse of the Black Pearl", "The Lord of the Rings: The Fellowship of the Ring", "Jurassic Park", "Avatar", "The Revenant", "Mad Max: Fury Road", "The Last Samurai"]]
  ]),
  genre("Science Fiction", [
    ["Space Opera", ["Star Wars", "The Empire Strikes Back", "Dune (2021)", "Dune: Part Two", "Guardians of the Galaxy", "The Fifth Element", "Stargate", "Valerian and the City of a Thousand Planets"]],
    ["Time Travel", ["Back to the Future", "Back to the Future Part II", "The Terminator", "Terminator 2: Judgment Day", "12 Monkeys", "Looper", "Primer", "Predestination", "Edge of Tomorrow", "The Adam Project"]],
    ["Cyberpunk and Artificial Intelligence", ["Blade Runner", "Blade Runner 2049", "The Matrix", "The Matrix Reloaded", "Ghost in the Shell", "Ex Machina", "Her", "Upgrade", "Tron", "Ready Player One"]],
    ["Alien Invasion", ["The Day the Earth Stood Still", "War of the Worlds", "Independence Day", "District 9", "Edge of Tomorrow", "Arrival", "A Quiet Place", "Nope", "Signs", "Invasion of the Body Snatchers"]],
    ["Dystopian Futures", ["Metropolis", "A Clockwork Orange", "Soylent Green", "Logan's Run", "The Hunger Games", "Snowpiercer", "Children of Men", "The Maze Runner", "The Platform", "The Hunger Games: Catching Fire"]],
    ["Kaiju and Giant Creatures", ["Godzilla (1954)", "Godzilla (2014)", "Godzilla vs. Kong", "King Kong (1933)", "King Kong (2005)", "Pacific Rim", "Cloverfield", "The Host", "Colossal", "Shin Godzilla"]]
  ]),
  genre("Fantasy", [
    ["High Fantasy", ["The Lord of the Rings: The Fellowship of the Ring", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King", "The Hobbit: An Unexpected Journey", "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", "The Golden Compass", "Stardust", "The Green Knight"]],
    ["Dark Fantasy", ["Pan's Labyrinth", "The Dark Crystal", "The NeverEnding Story", "The Shape of Water", "Sleepy Hollow", "The Crow", "The Northman", "The Brothers Grimm"]],
    ["Fairy Tale Retellings", ["Cinderella (1950)", "Cinderella (2015)", "Beauty and the Beast (1991)", "Beauty and the Beast (2017)", "Maleficent", "Snow White and the Huntsman", "Enchanted", "Into the Woods"]],
    ["Mythic Fantasy", ["Clash of the Titans", "Jason and the Argonauts", "Hercules", "Troy", "300", "The Odyssey", "Immortals", "The Fall"]],
    ["Urban and Supernatural Fantasy", ["Harry Potter and the Philosopher's Stone", "Doctor Strange", "The Green Mile", "Constantine", "Practical Magic", "The Craft", "The Mortal Instruments: City of Bones", "The Sorcerer's Apprentice"]]
  ]),
  genre("Animation", [
    ["Computer-Animated Family Films", ["Toy Story", "Toy Story 3", "Finding Nemo", "The Incredibles", "Up", "Frozen", "Inside Out", "Zootopia", "Moana", "The Super Mario Bros. Movie"]],
    ["Hand-Drawn Animation", ["Snow White and the Seven Dwarfs", "Cinderella", "The Jungle Book", "The Lion King", "Mulan", "The Little Mermaid", "Beauty and the Beast", "The Iron Giant", "The Prince of Egypt"]],
    ["Stop-Motion Animation", ["The Nightmare Before Christmas", "Coraline", "Fantastic Mr. Fox", "Kubo and the Two Strings", "Isle of Dogs", "Chicken Run", "Wallace & Gromit: The Curse of the Were-Rabbit", "Guillermo del Toro's Pinocchio"]],
    ["Anime Films", ["Spirited Away", "My Neighbor Totoro", "Princess Mononoke", "Howl's Moving Castle", "Your Name", "Demon Slayer: Kimetsu no Yaiba – The Movie: Mugen Train", "Akira", "The Boy and the Heron", "One Piece Film: Red"]],
    ["Animated Musicals", ["The Little Mermaid", "Beauty and the Beast", "The Lion King", "Frozen", "Moana", "Encanto", "Tangled", "The Princess and the Frog", "The Nightmare Before Christmas"]],
    ["Adult Animation", ["Persepolis", "Waltz with Bashir", "The Triplets of Belleville", "Flee", "South Park: Bigger, Longer & Uncut", "Sausage Party", "Anomalisa", "Fantastic Planet"]]
  ]),
  genre("Comedy", [
    ["Screwball Comedy", ["It Happened One Night", "Bringing Up Baby", "His Girl Friday", "The Philadelphia Story", "Some Like It Hot", "The Awful Truth"]],
    ["Romantic Comedy", ["When Harry Met Sally...", "Pretty Woman", "Notting Hill", "Four Weddings and a Funeral", "The Holiday", "Crazy Rich Asians", "10 Things I Hate About You", "The Proposal"]],
    ["Dark Comedy", ["Dr. Strangelove", "Fargo", "The Lobster", "In Bruges", "Parasite", "The Menu", "Burn After Reading", "The Death of Stalin"]],
    ["Satire and Social Comedy", ["The Great Dictator", "Network", "The Truman Show", "Wag the Dog", "Thank You for Smoking", "Don't Look Up", "Jojo Rabbit", "Borat"]],
    ["Teen Comedy", ["Clueless", "Mean Girls", "Superbad", "Booksmart", "Easy A", "Ferris Bueller's Day Off", "The Breakfast Club", "Dazed and Confused"]],
    ["Buddy Comedy", ["The Odd Couple", "Planes, Trains and Automobiles", "Midnight Run", "Rush Hour", "Dumb and Dumber", "The Nice Guys", "21 Jump Street", "The Intouchables"]],
    ["Mockumentary and Parody", ["This Is Spinal Tap", "Best in Show", "The Naked Gun", "Airplane!", "Austin Powers: International Man of Mystery", "What We Do in the Shadows", "Monty Python and the Holy Grail"]]
  ]),
  genre("Drama", [
    ["Biographical Drama", ["Gandhi", "Amadeus", "Schindler's List", "The Social Network", "Oppenheimer", "A Beautiful Mind", "The Theory of Everything", "The King's Speech", "Malcolm X"]],
    ["Courtroom Drama", ["12 Angry Men", "To Kill a Mockingbird", "A Few Good Men", "Philadelphia", "The Verdict", "Anatomy of a Murder", "Erin Brockovich", "The Trial of the Chicago 7"]],
    ["Coming-of-Age Drama", ["Stand by Me", "The 400 Blows", "Boyhood", "Lady Bird", "Moonlight", "The Perks of Being a Wallflower", "The Last Picture Show", "The Wonder Years"]],
    ["Sports Drama", ["Rocky", "Raging Bull", "Hoosiers", "Field of Dreams", "Moneyball", "Remember the Titans", "The Blind Side", "Ford v Ferrari", "I, Tonya"]],
    ["Family Drama", ["The Godfather", "Kramer vs. Kramer", "Ordinary People", "Little Miss Sunshine", "The Farewell", "Minari", "The Royal Tenenbaums", "The Whale"]],
    ["Historical Drama", ["Lawrence of Arabia", "Doctor Zhivago", "The Last Emperor", "Atonement", "The English Patient", "The Pianist", "The Favourite", "12 Years a Slave"]],
    ["Psychological Drama", ["Citizen Kane", "Vertigo", "The Godfather Part II", "Taxi Driver", "There Will Be Blood", "Black Swan", "The Master", "Aftersun"]]
  ]),
  genre("Horror", [
    ["Slasher", ["Psycho", "Halloween", "Friday the 13th", "A Nightmare on Elm Street", "Scream", "The Texas Chain Saw Massacre", "The Shining", "X"]],
    ["Supernatural Horror", ["The Exorcist", "The Conjuring", "The Ring", "The Grudge", "The Sixth Sense", "The Others", "The Omen", "The Haunting"]],
    ["Psychological Horror", ["Rosemary's Baby", "Hereditary", "The Babadook", "The Witch", "Midsommar", "Black Swan", "The Lighthouse", "The Innocents"]],
    ["Body Horror", ["The Fly", "Videodrome", "The Thing", "Society", "Tetsuo: The Iron Man", "Titane", "Raw", "Slither"]],
    ["Folk Horror", ["The Wicker Man", "The Blair Witch Project", "Midsommar", "The Witch", "The Ritual", "A Field in England", "The Village", "The Blood on Satan's Claw"]],
    ["Monster Horror", ["Jaws", "Alien", "Aliens", "The Thing", "The Host", "Cloverfield", "The Mist", "A Quiet Place"]],
    ["Zombie and Infection Horror", ["Night of the Living Dead", "Dawn of the Dead", "28 Days Later", "Train to Busan", "World War Z", "REC", "The Girl with All the Gifts", "Pontypool"]],
    ["Cosmic Horror", ["The Color Out of Space", "The Void", "Annihilation", "Event Horizon", "In the Mouth of Madness", "The Endless", "Underwater", "The Thing"]]
  ]),
  genre("Thriller and Mystery", [
    ["Psychological Thriller", ["Vertigo", "Rear Window", "The Silence of the Lambs", "Se7en", "Gone Girl", "Shutter Island", "Prisoners", "The Girl on the Train"]],
    ["Crime and Neo-Noir", ["Double Indemnity", "Chinatown", "L.A. Confidential", "Heat", "The Departed", "No Country for Old Men", "Drive", "Nightcrawler"]],
    ["Legal Thriller", ["The Firm", "A Time to Kill", "The Lincoln Lawyer", "Michael Clayton", "The Pelican Brief", "Primal Fear", "The Insider", "Dark Waters"]],
    ["Political Thriller", ["All the President's Men", "The Manchurian Candidate", "JFK", "The Constant Gardener", "Syriana", "The Ides of March", "The Post", "Official Secrets"]],
    ["Techno-Thriller", ["WarGames", "The Net", "Enemy of the State", "Eagle Eye", "The Bourne Identity", "Minority Report", "Snowden", "Blackhat"]],
    ["Whodunit and Detective Mystery", ["The Maltese Falcon", "Murder on the Orient Express", "The Hound of the Baskervilles", "Clue", "Knives Out", "Glass Onion", "See How They Run", "Gosford Park"]]
  ]),
  genre("Romance", [
    ["Romantic Drama", ["Casablanca", "Gone with the Wind", "Doctor Zhivago", "Titanic", "The Notebook", "Brokeback Mountain", "La La Land", "Past Lives"]],
    ["Historical Romance", ["Sense and Sensibility", "Pride & Prejudice", "Atonement", "Anna Karenina", "The Age of Innocence", "Bright Star", "Portrait of a Lady on Fire"]],
    ["Teen Romance", ["Romeo + Juliet", "The Fault in Our Stars", "The Spectacular Now", "To All the Boys I've Loved Before", "The Sun Is Also a Star", "Love, Simon", "The Half of It"]],
    ["LGBTQ+ Romance", ["Carol", "Moonlight", "Call Me by Your Name", "Portrait of a Lady on Fire", "The Handmaiden", "God's Own Country", "The Way He Looks"]],
    ["Fantasy Romance", ["The Shape of Water", "Edward Scissorhands", "The Princess Bride", "The Time Traveler's Wife", "About Time", "Warm Bodies", "The Lake House"]]
  ]),
  genre("Musical Films", [
    ["Stage Adaptations", ["West Side Story", "The Sound of Music", "My Fair Lady", "Chicago", "Les Misérables", "The Phantom of the Opera", "Wicked"]],
    ["Jukebox Musicals", ["Mamma Mia!", "Across the Universe", "Jersey Boys", "Yesterday", "Rocketman", "Bohemian Rhapsody", "A Complete Unknown"]],
    ["Dance Musicals", ["Singin' in the Rain", "An American in Paris", "Saturday Night Fever", "Flashdance", "Footloose", "Dirty Dancing", "Billy Elliot"]],
    ["Animated Musicals", ["The Lion King", "The Little Mermaid", "Beauty and the Beast", "Frozen", "Moana", "Encanto", "Tangled"]]
  ]),
  genre("Western", [
    ["Classic Western", ["Stagecoach", "My Darling Clementine", "Red River", "The Searchers", "High Noon", "Shane", "Rio Bravo"]],
    ["Spaghetti Western", ["A Fistful of Dollars", "For a Few Dollars More", "The Good, the Bad and the Ugly", "Once Upon a Time in the West", "Django", "The Great Silence"]],
    ["Revisionist Western", ["The Wild Bunch", "McCabe & Mrs. Miller", "Unforgiven", "Dances with Wolves", "The Assassination of Jesse James by the Coward Robert Ford", "The Hateful Eight"]],
    ["Neo-Western", ["No Country for Old Men", "Hell or High Water", "Wind River", "The Three Burials of Melquiades Estrada", "The Power of the Dog", "Hostiles"]],
    ["Space Western", ["Star Wars", "Serenity", "Outland", "Cowboys & Aliens", "Prospect"]]
  ]),
  genre("Documentary and Nonfiction", [
    ["Nature Documentary", ["March of the Penguins", "Earth", "Oceans", "The Cove", "My Octopus Teacher", "Fire of Love"]],
    ["Science Documentary", ["An Inconvenient Truth", "Particle Fever", "The Farthest", "Apollo 11", "A Beautiful Planet", "Fantastic Fungi"]],
    ["Historical Documentary", ["Shoah", "They Shall Not Grow Old", "The Act of Killing", "The Fog of War", "13th", "Summer of Soul"]],
    ["Music Documentary", ["Woodstock", "Stop Making Sense", "The Last Waltz", "Amy", "Summer of Soul", "Moonage Daydream"]],
    ["Sports Documentary", ["Hoop Dreams", "When We Were Kings", "Free Solo", "Icarus", "Senna", "The Last Dance"]],
    ["True Crime Documentary", ["The Thin Blue Line", "Paradise Lost", "Capturing the Friedmans", "The Staircase", "The Jinx"]]
  ]),
  genre("International Cinema", [
    ["Bollywood and Indian Cinema", ["Mother India", "Sholay", "Dilwale Dulhania Le Jayenge", "Lagaan", "Devdas", "3 Idiots", "Dangal", "RRR", "Baahubali: The Beginning", "Baahubali 2: The Conclusion"]],
    ["Hong Kong Cinema", ["A Better Tomorrow", "Police Story", "Infernal Affairs", "In the Mood for Love", "Ip Man", "The Killer", "Crouching Tiger, Hidden Dragon"]],
    ["Japanese Cinema", ["Seven Samurai", "Tokyo Story", "Rashomon", "Spirited Away", "Akira", "Shoplifters", "Godzilla (1954)", "Your Name"]],
    ["Korean Cinema", ["Parasite", "Oldboy", "The Handmaiden", "Train to Busan", "Memories of Murder", "The Host", "Decision to Leave"]],
    ["French Cinema", ["The 400 Blows", "Breathless", "The Intouchables", "Amélie", "La Haine", "The Artist", "Portrait of a Lady on Fire"]],
    ["Italian Cinema", ["Bicycle Thieves", "La Dolce Vita", "8½", "Cinema Paradiso", "The Good, the Bad and the Ugly", "Life Is Beautiful", "The Great Beauty"]],
    ["Iranian Cinema", ["A Separation", "Children of Heaven", "Taste of Cherry", "The Wind Will Carry Us", "The Salesman", "Close-Up"]],
    ["Latin American Cinema", ["The Official Story", "City of God", "Roma", "Y Tu Mamá También", "Amores perros", "The Secret in Their Eyes", "Wild Tales"]]
  ])
];

export const MOVIE_CATALOG_METADATA = {
  sourceUrl: "https://en.wikipedia.org/wiki/List_of_highest-grossing_films",
  sourceLabel: "Wikipedia's lists of highest-grossing films and film series",
  verifiedAt: "2026-09-21",
  note: "Film-series and film-gross rankings are snapshots and can change after releases, re-releases, and data revisions."
} as const;

export function buildMoviesTopic(): TopicSeed {
  return branch("Movies", [
    branch("Highest-Grossing Film Series", HIGHEST_GROSSING_SERIES),
    branch("Highest-Grossing Films", HIGHEST_GROSSING_FILMS),
    branch("Highest-Grossing Films Adjusted for Inflation", ADJUSTED_FOR_INFLATION),
    branch("Original Films for Sequel Entries", movies(["Ne Zha", "Zootopia", "Inside Out", "Avatar", "Moana", "Deadpool", "The Fellowship of the Ring", "The Curse of the Black Pearl", "Toy Story", "The Lion King (1994)", "Beauty and the Beast (1991)", "Frozen", "Jurassic Park", "The Fast and the Furious", "Star Wars", "Harry Potter and the Philosopher's Stone"])),
    branch("By Release Era", RELEASE_ERAS),
    branch("By Genre", GENRE_BRANCHES)
  ]);
}
