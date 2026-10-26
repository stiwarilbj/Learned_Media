// Generated from the website's finalized catalogs and pure policies.
(function(scope){const modules={"topic-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEST_SELLING_BOOK_SERIES_METADATA = exports.TOPIC_CATALOG_VERSION = void 0;
exports.titleCaseTopicLabel = titleCaseTopicLabel;
exports.englishLiteratureLabel = englishLiteratureLabel;
exports.createCatalogTopics = createCatalogTopics;
exports.findTopicById = findTopicById;
exports.preserveTopicPathIndex = preserveTopicPathIndex;
exports.updateTopicTreeById = updateTopicTreeById;
exports.flattenTopics = flattenTopics;
exports.preserveTopicSelectionStats = preserveTopicSelectionStats;
exports.selectionState = selectionState;
exports.toggleTopicSelection = toggleTopicSelection;
exports.selectedLeafTopics = selectedLeafTopics;
exports.selectedLeafCount = selectedLeafCount;
exports.summarizeSelection = summarizeSelection;
exports.selectWeightedTopicPaths = selectWeightedTopicPaths;
exports.migrateTopicTree = migrateTopicTree;
const writer_catalog_1 = require("./writer-catalog");
const political_history_catalog_1 = require("./political-history-catalog");
const disease_catalog_1 = require("./disease-catalog");
const computer_science_catalog_1 = require("./computer-science-catalog");
const natural_disaster_catalog_1 = require("./natural-disaster-catalog");
const war_history_catalog_1 = require("./war-history-catalog");
const company_history_catalog_1 = require("./company-history-catalog");
const movie_catalog_1 = require("./movie-catalog");
const television_music_sports_catalog_1 = require("./television-music-sports-catalog");
const history_science_taxonomy_catalog_1 = require("./history-science-taxonomy-catalog");
const topic_suggestions_1 = require("./topic-suggestions");
exports.TOPIC_CATALOG_VERSION = 28;
const branch = (label, children) => ({ label, children });
const series = (label, aliases = []) => ({ label, children: [], aliases });
const LITERATURE_SEED = branch("Literature", [
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
// This expansion is kept as catalog data (rather than generated search results) so
// it is available offline, has stable path-based IDs, and can be migrated like
// every other topic. Repeated works are intentional when they fit more than one
// subject, but each placement remains a distinct contextual topic ID.
const BOOK_EXPANSION = [
    branch("Romance", ["Love Story", "Pride and Prejudice", "Jane Eyre", "The Bridges of Madison County", "The Notebook", "The Time Traveler's Wife"]),
    branch("Thrillers", ["The Girl with the Dragon Tattoo", "The Girl on the Train", "Gone Girl", "The Da Vinci Code", "The Lost Symbol", "The Bourne Identity"]),
    branch("Horror", ["The Shining", "It", "Dracula", "Frankenstein", "The Haunting of Hill House", "The Exorcist"]),
    branch("Children's Literature", ["Alice's Adventures in Wonderland", "Charlotte's Web", "The Tale of Peter Rabbit", "The Very Hungry Caterpillar", "Matilda", "The Wind in the Willows", "Goodnight Moon", "The Poky Little Puppy", "James and the Giant Peach", "The Little Prince"]),
    branch("Biography and Memoir", ["The Diary of Anne Frank (Het Achterhuis)", "Long Walk to Freedom", "The Story of My Life", "I Know Why the Caged Bird Sings", "The Autobiography of Malcolm X", "Educated"]),
    branch("Popular Science", ["Cosmos", "A Brief History of Time", "The Naked Ape", "The Selfish Gene", "Silent Spring", "The Immortal Life of Henrietta Lacks"]),
    branch("Self-Development", ["How to Win Friends and Influence People", "The 7 Habits of Highly Effective People", "The Power of Positive Thinking", "The Purpose Driven Life", "Your Erroneous Zones", "The Secret"]),
    branch("Religion and Spirituality", ["The Bible", "The Quran", "The Bhagavad Gita", "The Celestine Prophecy", "The Alchemist", "The Seven Spiritual Laws of Success"]),
    branch("Education", ["Scouting for Boys", "The McGuffey Readers", "The Common Sense Book of Baby and Child Care", "American Spelling Book (Webster's Dictionary)", "A Message to Garcia", "The 4-Hour Workweek"]),
    branch("Reference Works", ["Guinness World Records", "Alcoholics Anonymous", "The Hite Report", "The Art of War", "Gray's Anatomy", "Roget's Thesaurus"]),
    branch("Books from Your List", [
        "Scouting for Boys", "The McGuffey Readers", "Guinness World Records", "六星占術によるあなたの運命 (Rokusei Senjutsu: Six-Star Astrology Tells Your Fortune)", "American Spelling Book (Webster's Dictionary)",
        "A Tale of Two Cities", "The Little Prince (Le Petit Prince)", "The Alchemist (O Alquimista)", "Harry Potter and the Philosopher's Stone", "And Then There Were None", "Dream of the Red Chamber (紅樓夢)", "The Hobbit", "Alice's Adventures in Wonderland",
        "She: A History of Adventure", "The Da Vinci Code", "Harry Potter and the Chamber of Secrets", "The Catcher in the Rye", "Sophie's World (Sofies verden)", "The Bridges of Madison County", "One Hundred Years of Solitude (Cien años de soledad)", "Lolita", "Heidi", "The Common Sense Book of Baby and Child Care", "Anne of Green Gables", "Black Beauty", "The Name of the Rose (Il Nome della Rosa)", "The Eagle Has Landed", "Watership Down", "The Hite Report",
        "Charlotte's Web", "The Ginger Man", "The Purpose Driven Life", "The Tale of Peter Rabbit", "Jonathan Livingston Seagull", "The Very Hungry Caterpillar", "A Message to Garcia", "To Kill a Mockingbird", "Flowers in the Attic", "Cosmos", "Angels & Demons", "How to Win Friends and Influence People", "Alcoholics Anonymous", "Fear of Flying", "How the Steel Was Tempered (Kak zakalyalas' stal)", "War and Peace (Война и мир)", "The Adventures of Pinocchio (Le avventure di Pinocchio)",
        "The Diary of Anne Frank (Het Achterhuis)", "Your Erroneous Zones", "The Thorn Birds", "Kane and Abel", "The Kite Runner", "Valley of the Dolls", "The Great Gatsby", "Gone with the Wind", "Rebecca", "The Revolt of Mamie Stover", "The Girl with the Dragon Tattoo (Män som hatar kvinnor)", "The Lost Symbol", "The Hunger Games", "James and the Giant Peach",
        "Ben-Hur: A Tale of the Christ", "The Young Guard (Молодая гвардия)", "Who Moved My Cheese?", "A Brief History of Time", "Paul et Virginie", "Lust for Life", "The Wind in the Willows", "The 7 Habits of Highly Effective People", "Totto-Chan: The Little Girl at the Window (窓ぎわのトットちゃん)", "Sapiens: A Brief History of Humankind", "Virgin Soil Upturned (Поднятая целина)", "The Celestine Prophecy", "The Fault in Our Stars",
        "The Girl on the Train", "The Shack", "Uncle Styopa (Дядя Стёпа)", "The Godfather", "Love Story", "Catching Fire", "Mockingjay", "Kitchen (キッチン)", "Andromeda Nebula (Туманность Андромеды)", "Gone Girl", "The Bermuda Triangle", "Things Fall Apart", "Wolf Totem (狼圖騰)", "The Happy Hooker: My Own Story", "Jaws",
        "Love You Forever", "The Women's Room", "What to Expect When You're Expecting", "Adventures of Huckleberry Finn", "The Secret Diary of Adrian Mole, Aged 13¾", "Pride and Prejudice", "Kon-Tiki: Across the Pacific in a Raft (Kon-Tiki ekspedisjonen)", "The Good Soldier Švejk (Osudy dobrého vojáka Švejka za světové války)", "Where the Wild Things Are", "The Power of Positive Thinking", "The Secret", "Dune", "Charlie and the Chocolate Factory", "The Naked Ape", "Kokoro (こころ)",
        "Where the Crawdads Sing", "Follow Your Heart (Va' dove ti porta il cuore)", "Matilda", "The Book Thief", "The Horse Whisperer", "Goodnight Moon", "The Neverending Story (Die unendliche Geschichte)", "All the Light We Cannot See", "Fifty Shades of Grey", "The Outsiders", "Guess How Much I Love You", "Shōgun", "The Poky Little Puppy", "The Pillars of the Earth", "Perfume (Das Parfum)", "The Grapes of Wrath",
        // Requested classics and three well-known Jules Verne novels.
        "Crime and Punishment", "Jane Eyre", "Wuthering Heights", "Agnes Grey",
        "Twenty Thousand Leagues Under the Sea", "Journey to the Center of the Earth", "Around the World in Eighty Days",
        "Moby-Dick", "The Count of Monte Cristo", "Don Quixote", "Frankenstein", "Dracula", "The Brothers Karamazov", "Great Expectations",
        "Sense and Sensibility", "Emma", "Persuasion", "The Tenant of Wildfell Hall", "The Picture of Dorian Gray"
    ])
];
// Wikipedia groups these books by reported worldwide sales estimates. The
// catalog keeps that order for the user's list, while titles not present on
// the reference page remain at the end in their existing order.
const BEST_SELLING_BOOK_ORDER = [
    "A Tale of Two Cities", "The Little Prince", "The Alchemist", "Harry Potter and the Philosopher's Stone", "And Then There Were None", "Dream of the Red Chamber", "The Hobbit", "Alice's Adventures in Wonderland",
    "She: A History of Adventure", "The Da Vinci Code", "Harry Potter and the Chamber of Secrets", "The Catcher in the Rye", "Sophie's World", "The Bridges of Madison County", "One Hundred Years of Solitude", "Lolita", "Heidi", "The Common Sense Book of Baby and Child Care", "Anne of Green Gables", "Black Beauty", "The Name of the Rose", "The Eagle Has Landed", "Watership Down", "The Hite Report", "Charlotte's Web", "The Ginger Man", "The Purpose Driven Life",
    "The Tale of Peter Rabbit", "Jonathan Livingston Seagull", "The Very Hungry Caterpillar", "A Message to Garcia", "To Kill a Mockingbird", "Flowers in the Attic", "Cosmos", "Angels & Demons", "How to Win Friends and Influence People", "Alcoholics Anonymous", "Fear of Flying", "How the Steel Was Tempered", "War and Peace", "The Adventures of Pinocchio", "The Diary of Anne Frank", "Your Erroneous Zones", "The Thorn Birds", "Kane and Abel", "The Kite Runner", "Valley of the Dolls", "The Great Gatsby", "Gone with the Wind", "Rebecca", "The Revolt of Mamie Stover", "The Girl with the Dragon Tattoo", "The Lost Symbol", "The Hunger Games", "James and the Giant Peach", "Ben-Hur: A Tale of the Christ", "The Young Guard", "Who Moved My Cheese?",
    "A Brief History of Time", "Paul and Virginia", "Lust for Life", "The Wind in the Willows", "The 7 Habits of Highly Effective People", "Totto-Chan: The Little Girl at the Window", "Sapiens: A Brief History of Humankind", "Virgin Soil Upturned", "The Celestine Prophecy", "The Fault in Our Stars", "The Girl on the Train", "The Shack", "Uncle Styopa", "The Godfather", "Love Story", "Catching Fire", "Mockingjay", "Kitchen", "Andromeda Nebula", "Gone Girl", "The Bermuda Triangle", "Things Fall Apart", "Wolf Totem", "The Happy Hooker: My Own Story", "Jaws", "Love You Forever", "The Women's Room", "What to Expect When You're Expecting", "Adventures of Huckleberry Finn", "The Secret Diary of Adrian Mole, Aged 13¾", "Pride and Prejudice", "Kon-Tiki: Across the Pacific in a Raft", "The Good Soldier Švejk", "Where the Wild Things Are", "The Power of Positive Thinking", "The Secret", "Dune", "Charlie and the Chocolate Factory", "The Naked Ape", "Kokoro",
    "Where the Crawdads Sing", "Follow Your Heart", "Matilda", "The Book Thief", "The Horse Whisperer", "Goodnight Moon", "The Neverending Story", "All the Light We Cannot See", "Fifty Shades of Grey", "The Outsiders", "Guess How Much I Love You", "Shōgun", "The Poky Little Puppy", "The Pillars of the Earth", "Perfume", "The Grapes of Wrath"
];
function bookSortKey(seed) {
    const label = typeof seed === "string" ? seed : seed.label;
    const translated = label === "Paul et Virginie" ? "Paul and Virginia" : label;
    return englishLiteratureLabel(translated).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function orderBookSeeds(seeds) {
    const order = new Map(BEST_SELLING_BOOK_ORDER.map((title, index) => [bookSortKey(title), index]));
    return seeds
        .map((seed, index) => ({ seed, index, rank: order.get(bookSortKey(seed)) ?? BEST_SELLING_BOOK_ORDER.length }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ seed }) => seed);
}
const REMOVED_BOOK_LIST_LABELS = new Set();
function isEnglishBookTitle(seed) {
    const title = typeof seed === "string" ? seed : seed.label;
    const englishTitle = englishLiteratureLabel(title);
    return /[A-Za-z]/.test(englishTitle)
        && /^[A-Za-z0-9\s'’.,:;!?&—–¾-]+$/.test(englishTitle);
}
function keepBookFromList(seed) {
    return isEnglishBookTitle(seed);
}
const booksFromList = BOOK_EXPANSION.at(-1);
if (booksFromList && typeof booksFromList !== "string") {
    const keptBooks = booksFromList.children.filter((seed) => {
        if (keepBookFromList(seed))
            return true;
        const title = typeof seed === "string" ? seed : seed.label;
        REMOVED_BOOK_LIST_LABELS.add(title.toLowerCase());
        const englishTitle = englishLiteratureLabel(title);
        if (englishTitle)
            REMOVED_BOOK_LIST_LABELS.add(englishTitle.toLowerCase());
        return false;
    });
    booksFromList.children = orderBookSeeds(keptBooks);
}
const BEST_SELLING_BOOK_SERIES = branch("Best-Selling Book Series", [
    series("Harry Potter"), series("Goosebumps"), series("Perry Mason"), series("Diary of a Wimpy Kid"), series("Choose Your Own Adventure"), series("The Berenstain Bears"), series("Mr. Men and Little Miss"), series("Sweet Valley High"), series("Noddy"), series("Jack Reacher"), series("The Railway Series / Thomas & Friends"), series("Nancy Drew"), series("San-Antonio"), series("Robert Langdon"), series("Geronimo Stilton"), series("Percy Jackson & the Olympians"), series("The Baby-Sitters Club"), series("American Girl"), series("Twilight"), series("Star Wars"),
    series("One Piece"), series("Little Critter"), series("Peter Rabbit"), series("Fifty Shades"), series("Chicken Soup for the Soul"), series("Clifford the Big Red Dog"), series("Frank Merriwell"), series("Dirk Pitt"), series("Musashi", ["宮本武蔵"]), series("The Chronicles of Narnia"), series("SAS"), series("A Song of Ice and Fire"), series("The Hunger Games"), series("James Bond"), series("Martine"), series("Millennium"), series("The Wheel of Time"), series("Discworld"), series("Miffy", ["Nijntje"]), series("Alex Cross"), series("Anpanman", ["アンパンマン"]), series("Captain Underpants"), series("Fear Street"), series("Pippi Longstocking", ["Pippi Långstrump"]), series("The Vampire Chronicles"), series("OSS 117"), series("Winnie-the-Pooh"), series("Magic Tree House"), series("Left Behind"), series("A Series of Unfortunate Events"), series("Arthur"), series("Little House on the Prairie"), series("All Creatures Great and Small"), series("The Magic School Bus"), series("Where’s Wally?", ["Where's Wally?", "Where’s Waldo?", "Where's Waldo?"]), series("Men Are from Mars, Women Are from Venus"), series("The Hardy Boys"), series("The Bobbsey Twins"), series("Tarzan")
]);
/**
 * Sales totals and ordering are reported worldwide estimates, not audited
 * rankings. Keep the provenance with the catalog so both clients can explain
 * what the series branch represents without putting source text into searches.
 */
exports.BEST_SELLING_BOOK_SERIES_METADATA = {
    sourceUrl: "https://en.wikipedia.org/wiki/List_of_best-selling_books#List_of_best-selling_book_series",
    sourceLabel: "Wikipedia's List of best-selling book series",
    verifiedAt: "2026-09-20",
    note: "Worldwide sales and rank are reported estimates."
};
const FAMOUS_AUTHORS = branch("Famous Authors", [
    branch("By Region and Country", [
        branch("Africa", [branch("Nigeria", ["Chinua Achebe", "Wole Soyinka", "Chimamanda Ngozi Adichie", "Ben Okri", "Buchi Emecheta", "Teju Cole"]), branch("Kenya", ["Ngũgĩ wa Thiong'o", "Binyavanga Wainaina", "Yvonne Adhiambo Owuor", "Grace Ogot"]), branch("South Africa", ["Nadine Gordimer", "J.M. Coetzee", "Zakes Mda", "Damon Galgut", "Alan Paton"]), branch("Egypt", ["Naguib Mahfouz", "Ahdaf Soueif", "Alaa Al Aswany"]), branch("Ghana", ["Ama Ata Aidoo", "Kofi Awoonor"])]),
        branch("Asia", [branch("India", ["Rabindranath Tagore", "R.K. Narayan", "Arundhati Roy", "Salman Rushdie", "Vikram Seth", "Amitav Ghosh", "Jhumpa Lahiri", "Mahasweta Devi", "Premchand", "Kiran Desai"]), branch("Japan", ["Murasaki Shikibu", "Haruki Murakami", "Yasunari Kawabata", "Yukio Mishima", "Natsume Soseki", "Banana Yoshimoto"]), branch("China", ["Lu Xun", "Mo Yan", "Cixin Liu", "Cao Xueqin", "Eileen Chang", "Can Xue"]), branch("Korea", ["Han Kang", "Yi Sang", "Hwang Sok-yong"]), branch("Iran", ["Forough Farrokhzad", "Marjane Satrapi"]), branch("Turkey", ["Orhan Pamuk", "Elif Shafak"])]),
        branch("Europe", [branch("United Kingdom", ["William Shakespeare", "Jane Austen", "Charles Dickens", "Virginia Woolf", "George Orwell", "J.R.R. Tolkien", "Agatha Christie", "Kazuo Ishiguro", "Zadie Smith", "C.S. Lewis"]), branch("Ireland", ["James Joyce", "Oscar Wilde", "W.B. Yeats", "Samuel Beckett", "Sally Rooney"]), branch("France", ["Victor Hugo", "Marcel Proust", "Albert Camus", "Simone de Beauvoir", "Alexandre Dumas"]), branch("Germany", ["Johann Wolfgang von Goethe", "Thomas Mann", "Hermann Hesse", "Cornelia Funke"]), branch("Italy", ["Dante Alighieri", "Umberto Eco", "Elena Ferrante", "Italo Calvino"]), branch("Spain", ["Miguel de Cervantes", "Federico García Lorca", "Carlos Ruiz Zafón"]), branch("Russia", ["Leo Tolstoy", "Fyodor Dostoevsky", "Anton Chekhov", "Vladimir Nabokov", "Aleksandr Solzhenitsyn"]), branch("Nordic Countries", ["Hans Christian Andersen", "Henrik Ibsen", "Astrid Lindgren", "Sigrid Undset"])]),
        branch("The Americas", [branch("United States", ["Mark Twain", "Toni Morrison", "F. Scott Fitzgerald", "Ernest Hemingway", "Harper Lee", "Maya Angelou", "Ursula K. Le Guin", "Octavia Butler", "Stephen King", "Ray Bradbury", "Isaac Asimov", "John Steinbeck", "Louisa May Alcott"]), branch("Canada", ["Margaret Atwood", "Alice Munro", "Lucy Maud Montgomery", "Yann Martel", "Michael Ondaatje"]), branch("Latin America", ["Jorge Luis Borges", "Gabriel García Márquez", "Isabel Allende", "Julio Cortázar", "Pablo Neruda", "Mario Vargas Llosa", "Clarice Lispector"])]),
        branch("Oceania", [branch("Australia", ["Patrick White", "Peter Carey", "Tim Winton", "Alexis Wright"]), branch("New Zealand", ["Katherine Mansfield", "Witi Ihimaera", "Eleanor Catton"])]),
        branch("Indigenous Traditions", ["Leslie Marmon Silko", "Louise Erdrich", "N. Scott Momaday", "Thomas King", "Lee Maracle"])
    ]),
    branch("By Genre", [branch("Literary Fiction", ["Jane Austen", "Toni Morrison", "Virginia Woolf", "Gabriel García Márquez", "Leo Tolstoy", "James Joyce"]), branch("Mystery and Thriller", ["Agatha Christie", "Robert Louis Stevenson", "Stephen King", "Gillian Flynn", "Patricia Highsmith"]), branch("Fantasy and Science Fiction", ["J.R.R. Tolkien", "C.S. Lewis", "Ursula K. Le Guin", "Octavia Butler", "Isaac Asimov", "Ray Bradbury"]), branch("Children and Young Adult", ["Louisa May Alcott", "Astrid Lindgren", "J.K. Rowling", "Roald Dahl", "E.B. White", "L. Frank Baum"]), branch("Poetry", ["Rabindranath Tagore", "Pablo Neruda", "W.B. Yeats", "Federico García Lorca", "Forough Farrokhzad"]), branch("Science and Ideas", ["Carl Sagan", "Stephen Hawking", "Rachel Carson", "Yuval Noah Harari", "Mary Roach"])]),
    branch("By Literary Form", [branch("Novelists", ["Rabindranath Tagore", "Chinua Achebe", "Jane Austen", "Charles Dickens", "Haruki Murakami", "Toni Morrison"]), branch("Poets", ["Rabindranath Tagore", "Pablo Neruda", "Maya Angelou", "Emily Dickinson", "William Blake", "Homer"]), branch("Playwrights", ["William Shakespeare", "Henrik Ibsen", "Oscar Wilde", "Samuel Beckett", "Arthur Miller"]), branch("Essayists", ["Michel de Montaigne", "George Orwell", "James Baldwin", "Virginia Woolf", "Joan Didion"]), branch("Political Writers", ["Mary Wollstonecraft", "Thomas Paine", "Karl Marx", "Hannah Arendt", "Frantz Fanon"]), branch("Historians and Biographers", ["Herodotus", "Thucydides", "Ibn Khaldun", "Barbara Tuchman", "Robert Caro"])])
]);
const FAMOUS_SCIENTISTS = branch("Famous Scientists", [
    branch("Physics and Astronomy", [
        "Galileo Galilei", "Isaac Newton", "Michael Faraday", "James Clerk Maxwell", "Marie Curie", "Albert Einstein", "Max Planck", "Niels Bohr", "Ernest Rutherford", "Emmy Noether", "Lise Meitner", "Richard Feynman", "Vera Rubin", "Stephen Hawking", "Jocelyn Bell Burnell", "Chien-Shiung Wu", "Abdus Salam", "Subrahmanyan Chandrasekhar", "Katherine Johnson"
    ]),
    branch("Biology and Medicine", [
        "William Harvey", "Andreas Vesalius", "Antonie van Leeuwenhoek", "Carl Linnaeus", "Charles Darwin", "Gregor Mendel", "Louis Pasteur", "Robert Koch", "Edward Jenner", "Alexander Fleming", "Florence Nightingale", "Rosalind Franklin", "Barbara McClintock", "Jane Goodall", "E.O. Wilson", "Rachel Carson", "Tu Youyou", "Katalin Karikó", "Jonas Salk", "Elizabeth Blackburn"
    ]),
    branch("Chemistry and Earth Science", [
        "Antoine Lavoisier", "Dmitri Mendeleev", "Linus Pauling", "Dorothy Hodgkin", "Ahmed Zewail", "Svante Arrhenius", "Fritz Haber", "Percy Julian", "Charles Lyell", "Alfred Wegener", "Inge Lehmann", "Milutin Milanković", "Charles David Keeling", "Susan Solomon", "Wangari Maathai"
    ]),
    branch("Mathematics and Computer Science", [
        "Euclid", "Archimedes", "Al-Khwarizmi", "Ada Lovelace", "George Boole", "Alan Turing", "John von Neumann", "Srinivasa Ramanujan", "Grace Hopper", "Donald Knuth", "Maryam Mirzakhani", "Fei-Fei Li"
    ]),
    branch("Science Communication", [
        "Carl Sagan", "David Attenborough", "Stephen Jay Gould", "Neil deGrasse Tyson", "David Suzuki", "Brian Cox", "Mary Anning"
    ])
]);
const PHILOSOPHY_SEED = branch("Philosophy", [
    branch("Famous Philosophers", [
        branch("Ancient Mediterranean", ["Socrates", "Plato", "Aristotle", "Pythagoras", "Epicurus", "Zeno of Citium", "Diogenes", "Heraclitus", "Parmenides", "Plotinus", "Cicero", "Seneca", "Epictetus", "Marcus Aurelius"]),
        branch("Medieval and Islamic Philosophy", ["Augustine of Hippo", "Boethius", "Anselm of Canterbury", "Thomas Aquinas", "Duns Scotus", "William of Ockham", "Al-Farabi", "Avicenna", "Al-Ghazali", "Averroes", "Maimonides"]),
        branch("Asian Philosophers", ["Confucius", "Laozi", "Zhuangzi", "Mozi", "Han Feizi", "Nagarjuna", "Adi Shankara", "Gautama Buddha", "Mahavira", "Zhu Xi", "Wang Yangming", "Dogen", "Kukai"]),
        branch("Early Modern Philosophy", ["Niccolo Machiavelli", "René Descartes", "Baruch Spinoza", "Thomas Hobbes", "John Locke", "George Berkeley", "David Hume", "Jean-Jacques Rousseau", "Immanuel Kant", "Mary Wollstonecraft", "Adam Smith", "Edmund Burke"]),
        branch("Modern Philosophy", ["Georg Wilhelm Friedrich Hegel", "Arthur Schopenhauer", "Søren Kierkegaard", "Karl Marx", "Friedrich Nietzsche", "William James", "John Dewey", "Charles Sanders Peirce", "Edmund Husserl", "Martin Heidegger", "Bertrand Russell", "Ludwig Wittgenstein", "Jean-Paul Sartre", "Simone de Beauvoir", "Albert Camus", "Hannah Arendt", "John Rawls", "Robert Nozick", "Michel Foucault", "Jacques Derrida", "Frantz Fanon", "Bell Hooks", "Judith Butler", "Martha Nussbaum", "Peter Singer"])
    ]),
    branch("Philosophical Traditions", ["Stoicism", "Epicureanism", "Platonism", "Aristotelianism", "Confucianism", "Daoism", "Buddhist Philosophy", "Hindu Philosophy", "Islamic Philosophy", "Scholasticism", "Rationalism", "Empiricism", "Existentialism", "Phenomenology", "Pragmatism", "Analytic Philosophy", "Marxist Philosophy", "Feminist Philosophy", "African Philosophy", "Indigenous Philosophies"]),
    branch("Ethics and Political Philosophy", ["Virtue Ethics", "Deontological Ethics", "Consequentialism", "Social Contract", "Natural Rights", "Justice", "Free Will", "Philosophy of Mind", "Philosophy of Science", "Philosophy of Language", "Political Legitimacy", "Civil Disobedience", "Human Rights", "Bioethics", "Environmental Ethics", "Aesthetics"])
]);
const literatureChildren = LITERATURE_SEED.children;
const booksBranch = literatureChildren.find((child) => typeof child !== "string" && child.label === "Books");
booksBranch?.children.unshift(BOOK_EXPANSION[BOOK_EXPANSION.length - 1]);
booksBranch?.children.push(...BOOK_EXPANSION.slice(0, -1));
literatureChildren.push(BEST_SELLING_BOOK_SERIES, FAMOUS_AUTHORS);
const [TELEVISION_SEED, MUSIC_SEED, SPORTS_SEED] = (0, television_music_sports_catalog_1.buildTelevisionMusicSportsTopics)();
const ENTERTAINMENT_SEED = branch("Entertainment", [
    LITERATURE_SEED,
    writer_catalog_1.WRITERS_SEED,
    PHILOSOPHY_SEED,
    SPORTS_SEED,
    (0, movie_catalog_1.buildMoviesTopic)(),
    TELEVISION_SEED,
    MUSIC_SEED
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
const TOPIC_SEEDS = [
    branch("History", [
        branch("United States", [
            (0, political_history_catalog_1.buildUnitedStatesPoliticalHistory)(),
            "Indigenous America", "Colonial America", "American Revolution", "Early United States",
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
        (0, political_history_catalog_1.buildWorldPoliticalHistory)(),
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
        (0, history_science_taxonomy_catalog_1.buildHumanOriginsTopic)(),
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
        ]),
        (0, war_history_catalog_1.buildWarHistoryTopic)(),
        (0, company_history_catalog_1.buildCompaniesTopic)()
    ]),
    branch("Science", [
        (0, computer_science_catalog_1.buildComputerScienceTopic)(),
        branch("Chemistry", ["Atoms", "Elements", "Periodic Table", "Chemical Bonds", "Reactions", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Biochemistry", "Materials Chemistry", "Electrochemistry", "Nuclear Chemistry", "Strange Chemical Properties", "Everyday Chemistry"]),
        branch("Biology", ["Evolution", "Genetics", "DNA", "Cells", "Microbiology", "Viruses", "Zoology", "Ecology", "Marine Biology", "Human Biology", "Anatomy", "Neuroscience", "Immunology", "Animal Behavior", "Extreme Organisms", "Symbiosis", (0, history_science_taxonomy_catalog_1.buildOrganismsTopic)()]),
        (0, disease_catalog_1.buildDiseasesTopic)(),
        ...(0, natural_disaster_catalog_1.buildNaturalDisasterAndExtinctionTopics)(),
        branch("Physics", ["Mechanics", "Motion", "Gravity", "Electricity", "Magnetism", "Waves", "Sound", "Light", "Thermodynamics", "Fluid Mechanics", "Quantum Physics", "Particle Physics", "Nuclear Physics", "Relativity", "Strange Physical Phenomena"]),
        branch("Natural History", ["Ancient DNA", "Volcanoes", "Earthquakes", "Paleontology"]),
        branch("Earth Science", [(0, history_science_taxonomy_catalog_1.buildGeologyTopic)(), "Oceans", "Atmosphere", "Weather", "Climate"]),
        branch("Technology", ["Electronics", "Computing", "Semiconductors", "Robotics", "Telecommunications", "Energy", "Transportation", "Manufacturing", "Materials", "Batteries", "Sensors", "Medical Technology", "Emerging Technology"]),
        branch("Space", [
            branch("Solar System", ["Sun", "Mercury", "Venus", branch("Earth", ["Moon"]), "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Dwarf Planets", "Asteroids", "Comets"]),
            "Stars", "Black Holes", "Neutron Stars", "Exoplanets", "Nebulae", "Galaxies", "Milky Way", "Cosmology", "Early Universe", "Space Telescopes", "Spacecraft", "Rockets", "Human Spaceflight", "Space Stations", "Strange Space Objects"
        ]),
        FAMOUS_SCIENTISTS
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
    ENTERTAINMENT_SEED
];
function slug(value) {
    const normalized = value.toLowerCase().trim()
        .replace(/c\+\+/g, "c-plus-plus")
        .replace(/c#/g, "c-sharp")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return normalized || "topic";
}
function nodeId(path) {
    return `topic-${path.map(slug).join("--")}`;
}
const LOWERCASE_TOPIC_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
const SCIENTIFIC_GENERA = new Set(["Ardipithecus", "Australopithecus", "Homo", "Kenyanthropus", "Orrorin", "Paranthropus", "Sahelanthropus"]);
/** Title Case is for catalog labels only; book and video titles keep their original styling. */
function titleCaseTopicLabel(label) {
    const normalized = label.replace(/\s+/gu, " ").trim();
    const scientificName = normalized.match(/^([A-Z][a-z]+) ([a-z][a-z-]+)(?:\s|$)/u);
    if (scientificName && SCIENTIFIC_GENERA.has(scientificName[1]))
        return normalized;
    const words = normalized.split(/(\s+)/);
    const wordIndexes = words.map((word, index) => (/^\s+$/.test(word) ? -1 : index)).filter((index) => index >= 0);
    const first = wordIndexes[0];
    const last = wordIndexes.at(-1);
    return words.map((word, index) => {
        if (!word.trim())
            return word;
        const isAcronymOrStyled = /^[A-Z0-9][A-Z0-9.+/#-]*$/.test(word) || /[a-z].*[A-Z]/.test(word);
        if (isAcronymOrStyled)
            return word;
        const lower = word.toLowerCase();
        if (index === first || index === last)
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        if (LOWERCASE_TOPIC_WORDS.has(lower))
            return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join("");
}
function buildNode(seed, parentPath, depth, rootIndex) {
    const label = (typeof seed === "string" ? seed : titleCaseTopicLabel(seed.label)).replace(/\s+/gu, " ").trim();
    if (!label)
        return null;
    const children = typeof seed === "string" ? undefined : seed.children;
    const path = [...parentPath, label];
    return {
        id: nodeId(path), label, selected: false, expanded: false,
        weight: 10,
        aliases: typeof seed === "string" ? undefined : seed.aliases,
        children: children?.map((child) => buildNode(child, path, depth + 1, rootIndex)).filter((child) => Boolean(child))
    };
}
function englishLiteratureLabel(label) {
    const translated = {
        "Paul et Virginie": "Paul and Virginia",
        "Rokusei Senjutsu (Six-Star Astrology) Tells Your Fortune": "Six-Star Astrology Tells Your Fortune",
        "六星占術によるあなたの運命 (Rokusei Senjutsu: Six-Star Astrology Tells Your Fortune)": "Six-Star Astrology Tells Your Fortune",
        "六星占術によるあなたの運命": "Six-Star Astrology Tells Your Fortune"
    };
    return (translated[label] ?? label.replace(/\s*\([^)]*\)/g, "")).normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\x00-\x7F’—–¾]/g, "").replace(/\s+/g, " ").trim();
}
function createCatalogTopics() {
    // Keep original IDs and aliases while presenting English-only Literature labels.
    const clean = (node) => {
        const label = englishLiteratureLabel(node.label);
        if (!label)
            return null;
        const children = node.children?.map(clean).filter((child) => Boolean(child));
        return { ...node, label, aliases: Array.from(new Set([...(node.aliases ?? []), node.label])), children };
    };
    const topics = TOPIC_SEEDS.map((seed, index) => buildNode(seed, [], 0, index)).filter((node) => Boolean(node)).map(node => node.label === "Literature" ? clean(node) : node).filter((node) => Boolean(node));
    primeTopicTreeMetadata(topics);
    return topics;
}
const topicLeafStats = new WeakMap();
const topicPathIndexes = new WeakMap();
function primeTopicTreeMetadata(nodes) {
    const index = new Map();
    const visit = (node, path) => {
        index.set(node.id, path);
        if (!node.children?.length) {
            const stats = { selected: node.selected ? 1 : 0, total: 1 };
            topicLeafStats.set(node, stats);
            return stats;
        }
        const stats = { selected: 0, total: 0 };
        node.children.forEach((child, childIndex) => {
            const childStats = visit(child, [...path, childIndex]);
            stats.selected += childStats.selected;
            stats.total += childStats.total;
        });
        topicLeafStats.set(node, stats);
        return stats;
    };
    nodes.forEach((node, rootIndex) => visit(node, [rootIndex]));
    topicPathIndexes.set(nodes, index);
    return index;
}
function topicPathForId(nodes, id) {
    let index = topicPathIndexes.get(nodes) ?? primeTopicTreeMetadata(nodes);
    let path = index.get(id);
    if (path) {
        let level = nodes;
        let node;
        for (const position of path) {
            node = level[position];
            if (!node)
                break;
            level = node.children ?? [];
        }
        if (node?.id === id)
            return path;
        index = primeTopicTreeMetadata(nodes);
        path = index.get(id);
    }
    if (!path) {
        index = primeTopicTreeMetadata(nodes);
        path = index.get(id);
    }
    return path;
}
function findTopicById(nodes, id) {
    const path = topicPathForId(nodes, id);
    if (!path)
        return undefined;
    let level = nodes;
    let node;
    for (const position of path) {
        node = level[position];
        if (!node)
            return undefined;
        level = node.children ?? [];
    }
    return node?.id === id ? node : undefined;
}
function preserveTopicPathIndex(previous, next) {
    const index = topicPathIndexes.get(previous);
    if (index)
        topicPathIndexes.set(next, index);
    return next;
}
function updateTopicTreeById(nodes, id, update) {
    const path = topicPathForId(nodes, id);
    if (!path)
        return nodes;
    const visit = (list, depth) => {
        const position = path[depth];
        const node = list[position];
        if (!node)
            return list;
        let updated;
        if (depth === path.length - 1)
            updated = preserveTopicSelectionStats(node, update(node));
        else {
            const children = visit(node.children ?? [], depth + 1);
            if (children === node.children)
                return list;
            updated = preserveTopicSelectionStats(node, { ...node, children });
        }
        if (updated === node)
            return list;
        const next = list.slice();
        next[position] = updated;
        return next;
    };
    return preserveTopicPathIndex(nodes, visit(nodes, 0));
}
function flattenTopics(nodes, parentPath = []) {
    return nodes.flatMap((node) => {
        const path = [...parentPath, node.label];
        return [{ ...node, path }, ...(node.children ? flattenTopics(node.children, path) : [])];
    });
}
function leafStats(node) {
    const cached = topicLeafStats.get(node);
    if (cached)
        return cached;
    let stats;
    if (!node.children?.length)
        stats = { selected: node.selected ? 1 : 0, total: 1 };
    else {
        stats = { selected: 0, total: 0 };
        for (const child of node.children) {
            const childStats = leafStats(child);
            stats.selected += childStats.selected;
            stats.total += childStats.total;
        }
    }
    topicLeafStats.set(node, stats);
    return stats;
}
function preserveTopicSelectionStats(previous, next) {
    const stats = topicLeafStats.get(previous);
    if (stats)
        topicLeafStats.set(next, stats);
    return next;
}
function selectionState(node) {
    const stats = leafStats(node);
    return stats.selected === 0 ? "none" : stats.selected === stats.total ? "selected" : "mixed";
}
function setBranchSelected(node, selected) {
    const children = node.children?.map((child) => setBranchSelected(child, selected));
    const stats = children?.length
        ? children.reduce((total, child) => ({ selected: total.selected + child.stats.selected, total: total.total + child.stats.total }), { selected: 0, total: 0 })
        : { selected: selected ? 1 : 0, total: 1 };
    if (node.selected === selected && (!children || children.every((child, index) => child.node === node.children?.[index]))) {
        topicLeafStats.set(node, stats);
        return { node, stats };
    }
    const next = { ...node, selected, children: children?.map((child) => child.node) };
    topicLeafStats.set(next, stats);
    return { node: next, stats };
}
function toggleTopicSelection(nodes, id) {
    const path = topicPathForId(nodes, id);
    if (!path)
        return nodes;
    const visit = (list, depth) => {
        const position = path[depth];
        const node = list[position];
        if (!node)
            return list;
        let next;
        if (depth === path.length - 1)
            next = setBranchSelected(node, !node.selected).node;
        else {
            const children = visit(node.children ?? [], depth + 1);
            if (children === node.children)
                return list;
            const updated = { ...node, children };
            const stats = leafStats(updated);
            next = { ...updated, selected: stats.selected === stats.total };
            topicLeafStats.set(next, stats);
        }
        if (next === node)
            return list;
        const result = list.slice();
        result[position] = next;
        return result;
    };
    return preserveTopicPathIndex(nodes, visit(nodes, 0));
}
function selectedLeafTopics(nodes) {
    return flattenTopics(nodes).filter((topic) => !topic.children?.length && topic.selected);
}
function selectedLeafCount(nodes) {
    return nodes.reduce((count, node) => count + leafStats(node).selected, 0);
}
function summarizeSelection(nodes) {
    const selectedRoots = nodes.filter((node) => selectionState(node) === "selected");
    if (selectedRoots.length) {
        return selectedRoots.slice(0, 3).map((node) => node.label).join(" · ")
            + (selectedRoots.length > 3 ? ` +${selectedRoots.length - 3} more` : "");
    }
    const selectedCount = selectedLeafCount(nodes);
    if (!selectedCount)
        return "No topics selected";
    const paths = [];
    const visit = (items, parentPath) => {
        for (const node of items) {
            if (!leafStats(node).selected || paths.length >= 3)
                continue;
            const path = [...parentPath, node.label];
            if (node.children?.length)
                visit(node.children, path);
            else if (node.selected)
                paths.push(path.join(" / "));
            if (paths.length >= 3)
                break;
        }
    };
    visit(nodes, []);
    return paths.join(" · ") + (selectedCount > paths.length ? ` +${selectedCount - paths.length} more` : "");
}
function selectWeightedTopicPaths(nodes, limit = 10) {
    const pool = [];
    const visit = (items, parentPath, parentWeight) => {
        for (const node of items) {
            const path = [...parentPath, node.label];
            const weight = parentWeight * (node.weight / 10);
            if (node.children?.length)
                visit(node.children, path, weight);
            else if (node.selected)
                pool.push({ path, weight: Math.max(1, Math.round(weight)) });
        }
    };
    visit(nodes, [], 10);
    const selected = [];
    while (pool.length && selected.length < limit) {
        const total = pool.reduce((sum, item) => sum + item.weight, 0);
        let cursor = Math.random() * total;
        const index = pool.findIndex((item) => (cursor -= item.weight) <= 0);
        selected.push(pool.splice(index < 0 ? pool.length - 1 : index, 1)[0]);
    }
    return selected;
}
function migrateTopicTree(saved, collapseInitial = false, migrateLegacyRootWeights = false) {
    if (!saved?.length)
        return createCatalogTopics();
    let next = createCatalogTopics();
    const fresh = flattenTopics(next);
    const byId = new Map(fresh.map(topic => [topic.id, topic]));
    const byPath = new Map(fresh.map((topic) => [topic.path.join("\u0000").toLowerCase(), topic]));
    const byLabel = new Map();
    const byAlias = new Map();
    fresh.forEach((topic) => byLabel.set(topic.label.toLowerCase(), [...(byLabel.get(topic.label.toLowerCase()) ?? []), topic]));
    fresh.forEach((topic) => (topic.aliases ?? []).forEach((alias) => byAlias.set(alias.toLowerCase(), [...(byAlias.get(alias.toLowerCase()) ?? []), topic])));
    const missingCustom = new Map();
    const selectedIds = new Set();
    const updates = new Map();
    const legacySeriesParents = new Map();
    const resolveMigratedPath = (path) => {
        const key = path.join("\u0000").toLowerCase();
        return byPath.get(key) ?? fresh.find((topic) => topic.path.slice(-path.length).join("\u0000").toLowerCase() === key);
    };
    flattenTopics(saved).forEach((oldTopic) => {
        const key = oldTopic.path.join("\u0000").toLowerCase();
        const wasRemovedFromBookList = oldTopic.path.length === 4
            && oldTopic.path[0].toLowerCase() === "literature"
            && oldTopic.path[1].toLowerCase() === "books"
            && oldTopic.path[2].toLowerCase() === "books from your list"
            && REMOVED_BOOK_LIST_LABELS.has(oldTopic.label.toLowerCase());
        if (wasRemovedFromBookList)
            return;
        const migratedPath = political_history_catalog_1.POLITICAL_TOPIC_MIGRATIONS[key] ?? political_history_catalog_1.POLITICAL_TOPIC_LABEL_MIGRATIONS[oldTopic.label.toLowerCase()];
        const target = (migratedPath ? resolveMigratedPath(migratedPath) : undefined)
            ?? byId.get(oldTopic.id) ?? byPath.get(key)
            ?? (byLabel.get(oldTopic.label.toLowerCase())?.length === 1 ? byLabel.get(oldTopic.label.toLowerCase())?.[0] : undefined)
            ?? (byAlias.get(oldTopic.label.toLowerCase())?.length === 1 ? byAlias.get(oldTopic.label.toLowerCase())?.[0] : undefined);
        if (target) {
            const isLegacyBuiltInRoot = migrateLegacyRootWeights && oldTopic.path.length === 1 && [30, 25, 20, 25].includes(oldTopic.weight ?? 10);
            updates.set(target.id, { weight: isLegacyBuiltInRoot ? 10 : (oldTopic.weight || target.weight), expanded: collapseInitial ? false : oldTopic.expanded });
            if (oldTopic.selected)
                selectedIds.add(target.id);
            return;
        }
        const seriesParentPath = oldTopic.path.length > 3 && oldTopic.path[0] === "Literature" && oldTopic.path[1] === "Best-Selling Book Series" ? oldTopic.path.slice(0, 3).join("\u0000").toLowerCase() : undefined;
        if (seriesParentPath && !legacySeriesParents.has(seriesParentPath))
            legacySeriesParents.set(seriesParentPath, { selected: Boolean(oldTopic.selected), weight: oldTopic.weight });
        if (migratedPath)
            return;
        if (oldTopic.custom || oldTopic.selected) {
            const customKey = (0, topic_suggestions_1.normalizeCustomTopicLabel)(oldTopic.label);
            if (!missingCustom.has(customKey)) {
                const occupiedIds = new Set([...byId.keys(), ...Array.from(missingCustom.values(), (topic) => topic.id)]);
                const preservedId = oldTopic.custom && oldTopic.id && !occupiedIds.has(oldTopic.id) ? oldTopic.id : undefined;
                missingCustom.set(customKey, { id: preservedId ?? (0, topic_suggestions_1.createCustomTopicId)(oldTopic.label, occupiedIds), label: oldTopic.label, selected: oldTopic.selected, expanded: false, weight: oldTopic.weight || 10, custom: true });
            }
        }
    });
    legacySeriesParents.forEach((legacy, path) => {
        const parent = byPath.get(path);
        if (!parent)
            return;
        updates.set(parent.id, { ...updates.get(parent.id), weight: legacy.weight || parent.weight });
        if (legacy.selected)
            selectedIds.add(parent.id);
    });
    const apply = (items, inheritedSelection = false) => items.map((node) => {
        const patch = updates.get(node.id);
        const branchSelected = inheritedSelection || selectedIds.has(node.id);
        const children = node.children ? apply(node.children, branchSelected) : undefined;
        const stats = children?.length
            ? children.reduce((total, child) => { const value = leafStats(child); return { selected: total.selected + value.selected, total: total.total + value.total }; }, { selected: 0, total: 0 })
            : { selected: branchSelected ? 1 : 0, total: 1 };
        const selected = stats.selected === stats.total;
        const result = patch || children !== node.children || selected !== node.selected
            ? { ...node, ...patch, selected, children }
            : node;
        topicLeafStats.set(result, stats);
        return result;
    });
    const migrated = apply(next);
    return preserveTopicPathIndex(next, [...migrated, ...Array.from(missingCustom.values())]);
}

},
"writer-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRITERS_SEED = void 0;
const branch = (label, children) => ({ label, children });
const WRITERS_BY_REGION = [
    ["United States", [
            "Benjamin Franklin", "Phillis Wheatley", "Washington Irving", "James Fenimore Cooper", "Edgar Allan Poe", "Nathaniel Hawthorne", "Herman Melville", "Henry David Thoreau", "Ralph Waldo Emerson", "Walt Whitman", "Emily Dickinson", "Mark Twain", "Henry James", "Kate Chopin", "Edith Wharton", "Willa Cather", "Robert Frost", "William Carlos Williams", "T. S. Eliot", "Wallace Stevens", "Zora Neale Hurston", "Langston Hughes", "William Faulkner", "F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "Carson McCullers", "Richard Wright", "Ralph Ellison", "Flannery O'Connor", "J. D. Salinger", "Harper Lee", "James Baldwin", "Lorraine Hansberry", "Gwendolyn Brooks", "Sylvia Plath", "Allen Ginsberg", "James Agee", "Kurt Vonnegut", "Ray Bradbury", "Isaac Asimov", "Philip K. Dick", "Ursula K. Le Guin", "Octavia E. Butler", "Toni Morrison", "Maya Angelou", "Alice Walker", "Joyce Carol Oates", "Toni Cade Bambara", "John Updike", "Philip Roth", "Cormac McCarthy", "Don DeLillo", "Joan Didion", "bell hooks", "Sandra Cisneros", "Amy Tan", "Maxine Hong Kingston", "Louise Erdrich", "Louise Glück", "Rita Dove", "Audre Lorde", "Stephen King", "John Ashbery", "David Foster Wallace", "George Saunders", "Colson Whitehead", "Jesmyn Ward", "Ta-Nehisi Coates", "Louisa May Alcott", "Frederick Douglass", "Harriet Jacobs", "W. E. B. Du Bois", "Ambrose Bierce"
        ]],
    ["United Kingdom", [
            "Geoffrey Chaucer", "Thomas More", "William Shakespeare", "John Milton", "John Donne", "Daniel Defoe", "Jonathan Swift", "Samuel Johnson", "William Blake", "Jane Austen", "Walter Scott", "Mary Shelley", "William Wordsworth", "Samuel Taylor Coleridge", "Lord Byron", "Percy Bysshe Shelley", "John Keats", "Elizabeth Barrett Browning", "Christina Rossetti", "Charles Dickens", "Charlotte Brontë", "Emily Brontë", "Anne Brontë", "George Eliot", "Thomas Hardy", "Robert Louis Stevenson", "Arthur Conan Doyle", "H. G. Wells", "Rudyard Kipling", "Virginia Woolf", "E. M. Forster", "D. H. Lawrence", "Aldous Huxley", "George Orwell", "Evelyn Waugh", "Graham Greene", "J. R. R. Tolkien", "C. S. Lewis", "Agatha Christie", "Ian Fleming", "Anthony Burgess", "Doris Lessing", "Angela Carter", "Terry Pratchett", "J. K. Rowling", "Neil Gaiman", "Philip Pullman", "Kazuo Ishiguro", "Ian McEwan", "Hilary Mantel", "Zadie Smith", "Jeanette Winterson", "Bernardine Evaristo", "Alan Moore", "Kate Atkinson", "Malorie Blackman", "Robert Burns", "Wilkie Collins", "Elizabeth Gaskell", "Beatrix Potter", "A. A. Milne"
        ]],
    ["France", [
            "Christine de Pizan", "François Rabelais", "Michel de Montaigne", "Pierre Corneille", "Molière", "Jean Racine", "Madame de Lafayette", "Voltaire", "Denis Diderot", "Montesquieu", "Honoré de Balzac", "Victor Hugo", "Alexandre Dumas", "George Sand", "Stendhal", "Gustave Flaubert", "Charles Baudelaire", "Émile Zola", "Guy de Maupassant", "Jules Verne", "Arthur Rimbaud", "Paul Verlaine", "Marcel Proust", "Colette", "André Gide", "Antoine de Saint-Exupéry", "Jean-Paul Sartre", "Simone de Beauvoir", "Albert Camus", "Marguerite Yourcenar", "Marguerite Duras", "Aimé Césaire", "Annie Ernaux", "Patrick Modiano", "Leïla Slimani", "Jean de La Fontaine", "Alfred de Musset", "Alphonse Daudet", "Prosper Mérimée", "Anatole France"
        ]],
    ["Italy", [
            "Dante Alighieri", "Francesco Petrarca", "Giovanni Boccaccio", "Niccolò Machiavelli", "Ludovico Ariosto", "Torquato Tasso", "Carlo Goldoni", "Ugo Foscolo", "Alessandro Manzoni", "Giacomo Leopardi", "Giovanni Verga", "Gabriele D'Annunzio", "Luigi Pirandello", "Italo Svevo", "Giuseppe Tomasi di Lampedusa", "Alberto Moravia", "Elsa Morante", "Primo Levi", "Natalia Ginzburg", "Cesare Pavese", "Italo Calvino", "Dario Fo", "Umberto Eco", "Andrea Camilleri", "Oriana Fallaci", "Gianni Rodari", "Elena Ferrante", "Roberto Saviano", "Dacia Maraini", "Alessandro Baricco", "Giosuè Carducci", "Giovanni Pascoli", "Eugenio Montale", "Salvatore Quasimodo", "Giuseppe Ungaretti"
        ]],
    ["Russia", [
            "Alexander Pushkin", "Mikhail Lermontov", "Nikolai Gogol", "Ivan Turgenev", "Fyodor Dostoevsky", "Leo Tolstoy", "Nikolai Leskov", "Ivan Goncharov", "Anton Chekhov", "Maxim Gorky", "Ivan Bunin", "Andrei Bely", "Yevgeny Zamyatin", "Isaac Babel", "Vladimir Mayakovsky", "Anna Akhmatova", "Marina Tsvetaeva", "Osip Mandelstam", "Boris Pasternak", "Mikhail Bulgakov", "Mikhail Sholokhov", "Andrei Platonov", "Varlam Shalamov", "Aleksandr Solzhenitsyn", "Joseph Brodsky", "Sergei Dovlatov", "Vasily Grossman", "Viktor Pelevin", "Lyudmila Ulitskaya", "Guzel Yakhina", "Yevgeny Yevtushenko", "Olga Slavnikova", "Denis Fonvizin", "Nikolay Karamzin", "Sergei Yesenin", "Daniil Kharms", "Arkady Strugatsky", "Boris Strugatsky"
        ]],
    ["China", [
            "Confucius", "Laozi", "Zhuangzi", "Qu Yuan", "Sima Qian", "Tao Yuanming", "Wang Wei", "Li Bai", "Du Fu", "Su Shi", "Xin Qiji", "Cao Xueqin", "Lu Xun", "Lao She", "Ba Jin", "Shen Congwen", "Eileen Chang", "Wang Xiaobo", "Mo Yan", "Yu Hua", "Can Xue", "Bei Dao", "Wang Anyi", "Yan Lianke", "Cixin Liu", "Ha Jin"
        ]],
    ["India", [
            "Valmiki", "Vyasa", "Kalidasa", "Kabir", "Mirabai", "Bankim Chandra Chatterjee", "Rabindranath Tagore", "Premchand", "R. K. Narayan", "Mulk Raj Anand", "Kamala Markandaya", "Mahasweta Devi", "Salman Rushdie", "Anita Desai", "Vikram Seth", "Arundhati Roy", "Amitav Ghosh", "Jhumpa Lahiri", "Kiran Desai", "Aravind Adiga", "Amit Chaudhuri", "Rohinton Mistry", "Perumal Murugan", "Jeet Thayil", "Banu Mushtaq", "Ruskin Bond", "Shashi Tharoor", "Anand Neelakantan", "Kuvempu", "Sarojini Naidu"
        ]],
    ["Middle East", [
            "Ferdowsi", "Omar Khayyam", "Rumi", "Saadi Shirazi", "Hafez", "Naguib Mahfouz", "Khalil Gibran", "Forough Farrokhzad", "Sadegh Hedayat", "Shahrnush Parsipur", "Mahmoud Darwish", "Nizar Qabbani", "Adonis", "Ghassan Kanafani", "Jabra Ibrahim Jabra", "Hanan al-Shaykh", "Amin Maalouf", "Ahdaf Soueif", "Alaa Al Aswany", "Orhan Pamuk", "Elif Shafak", "Yaşar Kemal", "Amos Oz", "David Grossman", "Etgar Keret", "Fadwa Tuqan", "Sahar Khalifeh", "Mourid Barghouti", "Jalal Al-e Ahmad", "Marjane Satrapi", "Sahar Delijani"
        ]],
    ["Africa", [
            "Chinua Achebe", "Wole Soyinka", "Chimamanda Ngozi Adichie", "Ben Okri", "Buchi Emecheta", "Teju Cole", "Amos Tutuola", "Flora Nwapa", "Femi Osofisan", "Niyi Osundare", "J. P. Clark", "Nadine Gordimer", "J. M. Coetzee", "Zakes Mda", "Damon Galgut", "Alan Paton", "Bessie Head", "Mongane Wally Serote", "Mia Couto", "Ngũgĩ wa Thiong'o", "Binyavanga Wainaina", "Yvonne Adhiambo Owuor", "Grace Ogot", "Ayi Kwei Armah", "Ama Ata Aidoo", "Kofi Awoonor", "Naguib Mahfouz", "Ahdaf Soueif", "Tayeb Salih", "Léopold Sédar Senghor", "Mariama Bâ", "Ousmane Sembène", "Nuruddin Farah", "Tsitsi Dangarembga", "Yasmina Khadra", "Assia Djebar", "Alain Mabanckou", "Aminata Sow Fall", "Abdulrazak Gurnah", "Wangari Maathai"
        ]],
    ["Latin America", [
            "Sor Juana Inés de la Cruz", "José Martí", "Rubén Darío", "Jorge Luis Borges", "Adolfo Bioy Casares", "Julio Cortázar", "Silvina Ocampo", "Ernesto Sábato", "Roberto Arlt", "Victoria Ocampo", "Gabriel García Márquez", "Álvaro Mutis", "Laura Restrepo", "Juan Rulfo", "Carlos Fuentes", "Octavio Paz", "Elena Poniatowska", "Rosario Castellanos", "Isabel Allende", "Pablo Neruda", "Gabriela Mistral", "José Donoso", "Roberto Bolaño", "Mario Vargas Llosa", "César Vallejo", "José María Arguedas", "Clarice Lispector", "Jorge Amado", "Machado de Assis", "Paulo Coelho", "Carolina Maria de Jesus", "João Guimarães Rosa", "Eduardo Galeano", "Gioconda Belli", "Miguel Ángel Asturias", "Alejo Carpentier", "Rómulo Gallegos", "María Luisa Bombal"
        ]],
    ["Canada", [
            "Lucy Maud Montgomery", "Stephen Leacock", "Mordecai Richler", "Margaret Laurence", "Margaret Atwood", "Alice Munro", "Michael Ondaatje", "Yann Martel", "Robertson Davies", "Timothy Findley", "Leonard Cohen", "Rohinton Mistry", "Thomas King", "Lee Maracle", "Eden Robinson", "Dionne Brand", "Anne Carson", "Farley Mowat", "Carol Shields", "Madeleine Thien", "Michael Crummey"
        ]],
    ["Eastern Europe", [
            "Adam Mickiewicz", "Juliusz Słowacki", "Wisława Szymborska", "Czesław Miłosz", "Stanisław Lem", "Olga Tokarczuk", "Bruno Schulz", "Ryszard Kapuściński", "Franz Kafka", "Karel Čapek", "Milan Kundera", "Bohumil Hrabal", "Jaroslav Hašek", "Václav Havel", "Sándor Márai", "Imre Kertész", "Magda Szabó", "Milan Füst", "Mihail Sebastian", "Herta Müller", "Mircea Eliade", "Paul Celan", "Hristo Botev", "Ismail Kadare", "Ivo Andrić", "Danilo Kiš", "Dubravka Ugrešić", "Andrey Kurkov", "Lesya Ukrainka", "Serhiy Zhadan", "Svitlana Alexievich", "Georgi Gospodinov"
        ]],
    ["Spain", [
            "Miguel de Cervantes", "Lope de Vega", "Calderón de la Barca", "Teresa of Ávila", "Benito Pérez Galdós", "Leopoldo Alas", "Emilia Pardo Bazán", "Antonio Machado", "Federico García Lorca", "Juan Ramón Jiménez", "Rosa Chacel", "Carmen Laforet", "Camilo José Cela", "Miguel Delibes", "Carmen Martín Gaite", "Ana María Matute", "Javier Marías", "Carlos Ruiz Zafón", "Rosa Montero", "Arturo Pérez-Reverte"
        ]],
    ["Portugal", [
            "Luís de Camões", "Fernão Mendes Pinto", "Almeida Garrett", "Eça de Queirós", "Camilo Castelo Branco", "Fernando Pessoa", "Mário de Sá-Carneiro", "Florbela Espanca", "Sophia de Mello Breyner Andresen", "José Saramago", "António Lobo Antunes", "Lídia Jorge", "Agustina Bessa-Luís", "valter hugo mãe", "Gonçalo M. Tavares"
        ]],
    ["Ireland", [
            "Jonathan Swift", "Oliver Goldsmith", "Maria Edgeworth", "Bram Stoker", "Oscar Wilde", "W. B. Yeats", "James Joyce", "George Bernard Shaw", "J. M. Synge", "Sean O'Casey", "Samuel Beckett", "Flann O'Brien", "Elizabeth Bowen", "Edna O'Brien", "John McGahern", "Seamus Heaney", "Roddy Doyle", "Anne Enright", "Colm Tóibín", "Sally Rooney"
        ]],
    ["Germany", [
            "Johann Wolfgang von Goethe", "Friedrich Schiller", "Heinrich Heine", "Theodor Fontane", "Thomas Mann", "Hermann Hesse", "Bertolt Brecht", "Anna Seghers", "Günter Grass", "Christa Wolf", "W. G. Sebald", "Heinrich Böll", "Herta Müller", "Cornelia Funke", "Jenny Erpenbeck", "Daniel Kehlmann", "Judith Hermann"
        ]],
    ["Japan", [
            "Murasaki Shikibu", "Sei Shōnagon", "Matsuo Bashō", "Yosa Buson", "Kobayashi Issa", "Natsume Sōseki", "Ryūnosuke Akutagawa", "Jun'ichirō Tanizaki", "Yasunari Kawabata", "Osamu Dazai", "Yukio Mishima", "Kōbō Abe", "Kenzaburō Ōe", "Shūsaku Endō", "Kenzō Kitakata", "Haruki Murakami", "Banana Yoshimoto", "Hiromi Kawakami", "Mieko Kawakami", "Sayaka Murata", "Yōko Ogawa", "Keigo Higashino"
        ]],
    ["South Korea", [
            "Kim Sowol", "Yi Sang", "Hwang Sok-yong", "Ko Un", "Park Wan-suh", "Kim Young-ha", "Han Kang", "Hwang Jung-eun", "Shin Kyung-sook", "Bae Suah", "Cho Nam-joo", "Kim Hye-soon", "Choi Seung-ja", "Kim Hoon", "Pyun Hye-young"
        ]],
    ["Scandinavia", [
            "Hans Christian Andersen", "Søren Kierkegaard", "Henrik Ibsen", "August Strindberg", "Selma Lagerlöf", "Karin Boye", "Astrid Lindgren", "Tove Jansson", "Sigrid Undset", "Knut Hamsun", "Tarjei Vesaas", "Tomas Tranströmer", "Peter Høeg", "Jon Fosse", "Karl Ove Knausgård", "Jostein Gaarder", "Erlend Loe", "Karl Gjellerup"
        ]],
    ["Caribbean", [
            "Derek Walcott", "V. S. Naipaul", "Jamaica Kincaid", "Jean Rhys", "C. L. R. James", "George Lamming", "Earl Lovelace", "Lorna Goodison", "Edwidge Danticat", "Maryse Condé", "Patrick Chamoiseau", "Aimé Césaire", "Édouard Glissant", "Rita Indiana", "Mayra Santos-Febres", "Pedro Juan Gutiérrez"
        ]],
    ["Australia", [
            "Banjo Paterson", "Henry Handel Richardson", "Miles Franklin", "Patrick White", "Judith Wright", "Thomas Keneally", "Peter Carey", "Tim Winton", "Alexis Wright", "David Malouf", "Helen Garner", "Richard Flanagan", "Christos Tsiolkas", "Kim Scott"
        ]],
    ["New Zealand", [
            "Katherine Mansfield", "Janet Frame", "Frank Sargeson", "Allen Curnow", "Witi Ihimaera", "Patricia Grace", "Keri Hulme", "Maurice Gee", "Elizabeth Knox", "Eleanor Catton", "Paula Morris", "Ngahuia Te Awekotuku"
        ]],
    ["South Asia", [
            "Faiz Ahmed Faiz", "Saadat Hasan Manto", "Intizar Husain", "Bapsi Sidhwa", "Kamila Shamsie", "Mohsin Hamid", "Agha Shahid Ali", "Qurratulain Hyder", "Taslima Nasrin", "Kazi Nazrul Islam", "Jibanananda Das", "Akhteruzzaman Elias", "Michael Madhusudan Dutt", "Shyam Selvadurai", "Romesh Gunesekera", "Shehan Karunatilaka", "Manjula Martin", "Parijat"
        ]],
    ["Southeast Asia", [
            "Pramoedya Ananta Toer", "Chairil Anwar", "Andrea Hirata", "José Rizal", "Nick Joaquin", "F. Sionil José", "Lualhati Bautista", "Merlinda Bobis", "Seno Gumira Ajidarma", "Duong Thu Huong", "Bao Ninh", "Nguyễn Du", "Dương Thu Hương", "Viet Thanh Nguyen", "K. S. Maniam", "Tash Aw", "Alfian Sa'at", "S. P. Somtow"
        ]],
    ["Greece", [
            "Homer", "Sappho", "Aeschylus", "Sophocles", "Euripides", "Aristophanes", "Plato", "Plutarch", "Nikos Kazantzakis", "Constantine P. Cavafy", "George Seferis", "Odysseas Elytis", "Penelope Delta", "Dimitris Lyacos"
        ]],
    ["Netherlands and Belgium", [
            "Erasmus", "Joost van den Vondel", "Multatuli", "Louis Couperus", "Harry Mulisch", "Hella S. Haasse", "Cees Nooteboom", "Hugo Claus", "Amélie Nothomb", "Georges Simenon", "Hendrik Conscience", "Tom Lanoye", "David Van Reybrouck", "Anne Provoost"
        ]],
    ["Indigenous Writers", [
            "N. Scott Momaday", "Leslie Marmon Silko", "Louise Erdrich", "Sherman Alexie", "Joy Harjo", "Tommy Orange", "Thomas King", "Lee Maracle", "Eden Robinson", "Katherena Vermette", "Oodgeroo Noonuccal", "Alexis Wright", "Witi Ihimaera", "Patricia Grace", "Keri Hulme", "Kim Scott"
        ]]
];
const WRITERS_BY_ERA = [
    ["Ancient and Classical", ["Homer", "Sappho", "Aeschylus", "Sophocles", "Euripides", "Virgil", "Ovid", "Herodotus", "Thucydides", "Confucius", "Laozi", "Zhuangzi", "Sun Tzu", "Valmiki", "Vyasa", "Kalidasa", "Qu Yuan", "Sima Qian"]],
    ["Medieval", ["Dante Alighieri", "Geoffrey Chaucer", "Rumi", "Ferdowsi", "Saadi Shirazi", "Hafez", "Murasaki Shikibu", "Sei Shōnagon", "Ibn Khaldun", "Christine de Pizan", "Li Bai", "Du Fu", "Omar Khayyam", "Wang Wei", "Kabir", "Mirabai", "Marie de France", "Nizami Ganjavi"]],
    ["Renaissance and Early Modern", ["William Shakespeare", "Miguel de Cervantes", "Niccolò Machiavelli", "Giovanni Boccaccio", "Molière", "Lope de Vega", "Teresa of Ávila", "Luís de Camões", "John Milton", "Ben Jonson", "John Donne", "Sor Juana Inés de la Cruz", "Matsuo Bashō", "François Rabelais", "Torquato Tasso", "Edmund Spenser", "Philip Sidney", "Mary Sidney", "Jean de La Fontaine"]],
    ["Eighteenth Century and Enlightenment", ["Voltaire", "Denis Diderot", "Montesquieu", "Jean-Jacques Rousseau", "Samuel Johnson", "Jonathan Swift", "Alexander Pope", "Mary Wollstonecraft", "Phillis Wheatley", "Olaudah Equiano", "Jane Austen", "Johann Wolfgang von Goethe", "William Blake", "Henry Fielding", "Daniel Defoe", "Benjamin Franklin", "Immanuel Kant", "Ann Radcliffe", "Frances Burney", "Mercy Otis Warren", "Robert Burns", "Denis Fonvizin", "Nikolay Karamzin"]],
    ["Nineteenth Century", ["Jane Austen", "Mary Shelley", "Charlotte Brontë", "Emily Brontë", "Anne Brontë", "Charles Dickens", "George Eliot", "Thomas Hardy", "Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola", "Fyodor Dostoevsky", "Leo Tolstoy", "Anton Chekhov", "Alexander Pushkin", "Edgar Allan Poe", "Herman Melville", "Walt Whitman", "Emily Dickinson", "Mark Twain", "Jules Verne", "Henrik Ibsen", "Luigi Pirandello", "Rabindranath Tagore", "José Martí", "Machado de Assis", "Natsume Sōseki", "Hans Christian Andersen", "Oscar Wilde", "Louisa May Alcott", "Frederick Douglass", "Harriet Jacobs", "Ambrose Bierce", "Wilkie Collins", "Elizabeth Gaskell", "Alfred de Musset", "Alphonse Daudet", "Prosper Mérimée", "Anatole France", "Giosuè Carducci", "Giovanni Pascoli"]],
    ["Early Twentieth Century", ["James Joyce", "Virginia Woolf", "Marcel Proust", "Franz Kafka", "T. S. Eliot", "William Faulkner", "Ernest Hemingway", "D. H. Lawrence", "Lu Xun", "Rabindranath Tagore", "Federico García Lorca", "Boris Pasternak", "Mikhail Bulgakov", "Jorge Luis Borges", "Katherine Mansfield", "Rainer Maria Rilke", "Edith Wharton", "Zora Neale Hurston", "Nella Larsen", "Italo Svevo", "Yasunari Kawabata", "Fernando Pessoa", "Maya Angelou", "W. B. Yeats", "W. E. B. Du Bois", "Beatrix Potter", "A. A. Milne", "Eugenio Montale", "Salvatore Quasimodo", "Giuseppe Ungaretti", "Sergei Yesenin", "Daniil Kharms"]],
    ["Mid-Twentieth Century", ["George Orwell", "Albert Camus", "Simone de Beauvoir", "James Baldwin", "Chinua Achebe", "Toni Morrison", "Gabriel García Márquez", "Naguib Mahfouz", "Ursula K. Le Guin", "Octavia E. Butler", "Italo Calvino", "Primo Levi", "Pablo Neruda", "Derek Walcott", "Margaret Laurence", "Milan Kundera", "Mikhail Sholokhov", "Maya Angelou", "Flann O'Brien", "José Saramago", "Nadine Gordimer", "J. M. Coetzee", "Margaret Atwood", "Kurt Vonnegut", "Arkady Strugatsky", "Boris Strugatsky"]],
    ["Contemporary", ["J. K. Rowling", "Margaret Atwood", "Kazuo Ishiguro", "Salman Rushdie", "Haruki Murakami", "Chimamanda Ngozi Adichie", "Zadie Smith", "Elena Ferrante", "Cixin Liu", "Mo Yan", "Orhan Pamuk", "Arundhati Roy", "Jhumpa Lahiri", "Ocean Vuong", "Han Kang", "Olga Tokarczuk", "Colson Whitehead", "Yaa Gyasi", "Tana French", "Sally Rooney", "Isabel Allende", "Roberto Bolaño", "Kiran Desai", "David Grossman", "Annie Ernaux", "George Saunders", "Eleanor Catton"]]
];
exports.WRITERS_SEED = branch("Writers", [
    branch("Authors", WRITERS_BY_REGION.map(([region, authors]) => ({
        label: region,
        children: authors,
        aliases: region === "United States" ? ["US", "USA", "America"]
            : region === "United Kingdom" ? ["UK", "Britain", "Great Britain"]
                : undefined
    }))),
    branch("By Era", WRITERS_BY_ERA.map(([era, authors]) => branch(era, authors))),
    branch("Poets", ["Homer", "Sappho", "Virgil", "Dante Alighieri", "Rumi", "Hafez", "Kabir", "Mirabai", "William Shakespeare", "John Donne", "William Blake", "William Wordsworth", "John Keats", "Lord Byron", "Percy Bysshe Shelley", "Elizabeth Barrett Browning", "Walt Whitman", "Emily Dickinson", "Robert Frost", "Langston Hughes", "Maya Angelou", "Pablo Neruda", "Gabriela Mistral", "Federico García Lorca", "César Vallejo", "Anna Akhmatova", "Marina Tsvetaeva", "Boris Pasternak", "W. B. Yeats", "Seamus Heaney", "Derek Walcott", "Dylan Thomas", "Sylvia Plath", "Adrienne Rich", "Audre Lorde", "Louise Glück", "Rita Dove", "Joy Harjo", "Forough Farrokhzad", "Mahmoud Darwish", "Li Bai", "Du Fu", "Matsuo Bashō", "Tomas Tranströmer", "Wisława Szymborska", "Czesław Miłosz", "Nâzım Hikmet", "Yosano Akiko", "Ko Un"]),
    branch("Essay Writers", ["Michel de Montaigne", "Francis Bacon", "Joseph Addison", "Richard Steele", "Mary Wollstonecraft", "Ralph Waldo Emerson", "Henry David Thoreau", "Virginia Woolf", "George Orwell", "James Baldwin", "Joan Didion", "Susan Sontag", "Rebecca West", "E. B. White", "H. L. Mencken", "Zadie Smith", "Ta-Nehisi Coates", "bell hooks", "Audre Lorde", "Maya Angelou", "Annie Dillard", "James Agee", "Roxane Gay", "Sven Birkerts", "Claudia Rankine", "Lydia Davis", "Adam Gopnik", "Anand Giridharadas", "Arundhati Roy", "Amitav Ghosh", "Umberto Eco"]),
    branch("Playwrights", ["Aeschylus", "Sophocles", "Euripides", "Aristophanes", "William Shakespeare", "Molière", "Pierre Corneille", "Jean Racine", "Henrik Ibsen", "August Strindberg", "Anton Chekhov", "George Bernard Shaw", "Oscar Wilde", "Luigi Pirandello", "Federico García Lorca", "Bertolt Brecht", "Samuel Beckett", "Tennessee Williams", "Arthur Miller", "Lorraine Hansberry", "Edward Albee", "Caryl Churchill", "Tom Stoppard", "Tony Kushner", "Wole Soyinka", "Dario Fo", "Sarah Kane", "Suzan-Lori Parks", "David Mamet", "Ayad Akhtar"]),
    branch("Journalists and Columnists", ["Ida B. Wells", "Nellie Bly", "H. L. Mencken", "George Orwell", "Rebecca West", "James Agee", "Martha Gellhorn", "Hunter S. Thompson", "Joan Didion", "James Baldwin", "Pauline Kael", "Janet Malcolm", "Ryszard Kapuściński", "Anna Politkovskaya", "M. F. K. Fisher", "Barbara Ehrenreich", "Ta-Nehisi Coates", "Gloria Steinem", "Molly Ivins", "Mona Eltahawy", "Rana Foroohar", "Fareed Zakaria", "Pankaj Mishra", "A. A. Gill"]),
    branch("Memoirists and Biographers", ["Frederick Douglass", "Harriet Jacobs", "Maya Angelou", "James Baldwin", "Elie Wiesel", "Primo Levi", "Anne Frank", "Vladimir Nabokov", "George Orwell", "James Boswell", "Lytton Strachey", "Robert Caro", "Barbara Tuchman", "Ron Chernow", "Doris Kearns Goodwin", "Edmund Morris", "Margo Jefferson", "Tara Westover", "Annie Ernaux", "Roxane Gay", "Trevor Noah", "Patti Smith", "Michelle Zauner", "Carmen Maria Machado"]),
    branch("Screenwriters", ["Nora Ephron", "Aaron Sorkin", "Charlie Kaufman", "Greta Gerwig", "Jordan Peele", "Phoebe Waller-Bridge", "Tony Kushner", "Issa Rae", "Shonda Rhimes", "Spike Lee", "Billy Wilder", "Paddy Chayefsky", "Quentin Tarantino", "Sofia Coppola", "Emerald Fennell", "Michaela Coel", "Ramy Youssef", "Rian Johnson", "David Mamet", "Akira Kurosawa", "Satyajit Ray", "Park Chan-wook"])
]);

},
"political-history-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLITICAL_HISTORY_CATALOG_SOURCES = exports.POLITICAL_HISTORY_AUDIT_CORRECTIONS = exports.POLITICAL_TOPIC_LABEL_MIGRATIONS = exports.POLITICAL_TOPIC_MIGRATIONS = void 0;
exports.buildUnitedStatesPoliticalHistory = buildUnitedStatesPoliticalHistory;
exports.buildWorldPoliticalHistory = buildWorldPoliticalHistory;
const branch = (label, children, aliases = []) => ({ label, children, aliases });
const person = (label, aliases = []) => ({ label, children: [], aliases });
const politicalPath = (...parts) => parts.join("\u0000").toLowerCase();
/** Explicitly preserves selections when a verified office or identity correction changes a path. */
exports.POLITICAL_TOPIC_MIGRATIONS = {
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Thaddeus Stevens")]: ["History", "United States", "U.S. Political History", "House", "Notable House Members", "Thaddeus Stevens"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "John Lewis")]: ["History", "United States", "U.S. Political History", "House", "Notable House Members", "John Lewis"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Ronald Reagan")]: ["History", "United States", "U.S. Political History", "Presidents", "Ronald Reagan (1981–1989)"],
    [politicalPath("History", "United States", "U.S. Political History", "House", "Famous House Members", "Robert La Follette Jr.")]: ["History", "United States", "U.S. Political History", "Senate", "Notable Senators", "Robert M. La Follette Jr."],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Idaho William Borah")]: ["History", "United States", "U.S. Political History", "Senate", "Notable Senators", "William E. Borah"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Ted Kennedy")]: ["History", "United States", "U.S. Political History", "Senate", "Notable Senators", "Edward M. Kennedy"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Pat Moynihan")]: ["History", "United States", "U.S. Political History", "Senate", "Notable Senators", "Daniel Patrick Moynihan"],
    [politicalPath("History", "United States", "U.S. Political History", "House", "Famous House Members", "Thomas P. O'Neill Jr.")]: ["History", "United States", "U.S. Political History", "House", "Notable House Members", "Tip O'Neill"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Strom Thurmond's 1998 Stem-Cell Research Testimony")]: ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Strom Thurmond's 1999 Stem-Cell Research Testimony"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy, Strom Thurmond, and Stem-Cell Research")]: ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)"],
    [politicalPath("History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy's 2006 Stem-Cell Research Floor Push")]: ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)"]
};
/** Handles legacy custom-topic records whose old path was not retained by an earlier catalog. */
exports.POLITICAL_TOPIC_LABEL_MIGRATIONS = {
    ["Strom Thurmond's 1998 Stem-Cell Research Testimony".toLowerCase()]: ["Strom Thurmond's 1999 Stem-Cell Research Testimony"],
    ["Ted Kennedy, Strom Thurmond, and Stem-Cell Research".toLowerCase()]: ["Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)"],
    ["Ted Kennedy's 2006 Stem-Cell Research Floor Push".toLowerCase()]: ["Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)"]
};
exports.POLITICAL_HISTORY_AUDIT_CORRECTIONS = [
    { subject: "Thaddeus Stevens", correction: "House, not Senate", sourceUrl: "https://history.house.gov/People/Detail/22236" },
    { subject: "John Lewis", correction: "House, not Senate", sourceUrl: "https://history.house.gov/People/Detail/16948" },
    { subject: "Robert M. La Follette Jr.", correction: "Senate, not House", sourceUrl: "https://www.senate.gov/senators/FeaturedBios/Featured_Bio_LaFollette.htm" },
    { subject: "Theodore Roosevelt", correction: "Vice president term ends in 1901 when he succeeds to the presidency", sourceUrl: "https://www.senate.gov/about/officers-staff/vice-presidents.htm" },
    { subject: "George Mifflin Dallas", correction: "Add vice-president term 1845–1849", sourceUrl: "https://www.senate.gov/about/officers-staff/vice-presidents.htm" },
    { subject: "Birch Bayh", correction: "Add to Senate list; served Indiana 1963–1981", sourceUrl: "https://www.senate.gov/states/IN/senators.htm" },
    { subject: "Constance Baker Motley", correction: "Retain in House list; verified U.S. Representative", sourceUrl: "https://history.house.gov/People/Detail/18324" },
    { subject: "Strom Thurmond's 1998 Stem-Cell Research Testimony", correction: "Relabel as the verified November 4, 1999 hearing testimony", sourceUrl: "https://www.govinfo.gov/content/pkg/CHRG-106shrg61422/pdf/CHRG-106shrg61422.pdf" },
    { subject: "Ted Kennedy, Strom Thurmond, and Stem-Cell Research", correction: "Replace the broad label with the source-supported 2002 co-sponsorship record", sourceUrl: "https://www.govinfo.gov/content/pkg/CREC-2002-05-01/pdf/CREC-2002-05-01-pt1-PgS3631.pdf" },
    { subject: "Ted Kennedy's 2006 Stem-Cell Research Floor Push", correction: "Relabel to the source-supported 2002 co-sponsorship record", sourceUrl: "https://www.govinfo.gov/content/pkg/CREC-2002-05-01/pdf/CREC-2002-05-01-pt1-PgS3631.pdf" }
];
const ordinal = (value) => {
    const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] || "th");
    return `${value}${suffix}`;
};
const range = (start, end, step) => {
    const values = [];
    for (let value = start; value <= end; value += step)
        values.push(value);
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
    "John Tyler (1841)", "George Mifflin Dallas (1845–1849)", "Millard Fillmore (1849–1850)", "William R. King (1853)",
    "John C. Breckinridge (1857–1861)", "Hannibal Hamlin (1861–1865)", "Andrew Johnson (1865)",
    "Schuyler Colfax (1869–1873)", "Henry Wilson (1873–1875)", "William A. Wheeler (1877–1881)",
    "Chester A. Arthur (1881)", "Thomas A. Hendricks (1885)", "Levi P. Morton (1889–1893)",
    "Adlai E. Stevenson I (1893–1897)", "Garret Hobart (1897–1899)", "Theodore Roosevelt (1901)",
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
    "Daniel Webster", "Henry Clay", "John C. Calhoun", "Charles Sumner", "Stephen A. Douglas", "Jefferson Davis",
    "Robert M. La Follette", "Robert M. La Follette Jr.", "Hiram Johnson", person("William E. Borah", ["Idaho William Borah", "William Borah"]), "George Norris", "Huey Long",
    "Robert A. Taft", "Arthur Vandenberg", "Margaret Chase Smith", "Estes Kefauver", "Richard Russell Jr.", "Lyndon B. Johnson",
    "Hubert Humphrey", "Everett Dirksen", "Mike Mansfield", "Jacob K. Javits", person("Edward M. Kennedy", ["Ted Kennedy"]),
    "Barry Goldwater", person("Daniel Patrick Moynihan", ["Pat Moynihan", "Daniel P. Moynihan"]), "Howard Baker", "George Mitchell", "Robert C. Byrd", "Sam Nunn",
    "John McCain", "Dianne Feinstein", "Barbara Mikulski", "Bernie Sanders", "Elizabeth Warren", "John F. Kerry", "Cory Booker",
    "Tammy Duckworth", "Lisa Murkowski", "Susan Collins", "Richard Nixon", "Joe Biden", "Kamala Harris", "Daniel Inouye",
    "Birch Bayh", "Frank Church", "J. William Fulbright", "Edmund Muskie", "Robert F. Kennedy", "Bob Dole", "Richard Lugar",
    "Claiborne Pell", "Lowell Weicker"
];
const FAMOUS_HOUSE_MEMBERS = [
    "Frederick A. C. Muhlenberg", "Jonathan Dayton", "Nathaniel Macon", "Henry Clay", "John Quincy Adams", "Davy Crockett",
    "Thaddeus Stevens", "James G. Blaine", "Thomas Brackett Reed", "William Jennings Bryan", "Joseph Gurney Cannon",
    "Jeannette Rankin", "Fiorello La Guardia", "Sam Rayburn", "Joseph Martin Jr.", "John W. McCormack", "Gerald Ford",
    person("Tip O'Neill", ["Thomas P. O'Neill Jr."]), "Jim Wright", "Newt Gingrich", "Nancy Pelosi", "John Boehner", "Paul Ryan",
    "Steny Hoyer", "Barbara Jordan", "Shirley Chisholm", "John Lewis", "Constance Baker Motley", "Bella Abzug",
    "Alexandria Ocasio-Cortez", "Cynthia McKinney", "Adam Clayton Powell Jr.", "Elijah Cummings", "John Dingell",
    "Henry Waxman", "Ronald Dellums", "Emanuel Celler", "Hakeem Jeffries"
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
const STATEHOOD = {
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
const statehoodYear = (state) => STATEHOOD[state] ?? STATEHOOD[state.replace(/ /g, "")] ?? "statehood era";
const stateHistoryChildren = (state) => [
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
const WORLD_LEADERS = {
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
const WORLD_EVENTS = {
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
// These branches are deliberately event- and mechanism-focused. They give the
// generator narrow, sourceable entry points for how political actors actually
// move, block, reshape, or explain legislation instead of another broad list of
// officeholders or policy topics.
const PRESIDENTIAL_INNER_WORKINGS = [
    branch("Presidential Tools and Constraints", [
        "Veto Threats and Legislative Bargaining", "Pocket Vetoes", "Signing Statements", "Executive Orders and Administrative Direction",
        "Executive Privilege", "Recess Appointments", "Presidential Proclamations", "White House Legislative Affairs",
        "Going Public and the Bully Pulpit", "Emergency Powers and Statutory Limits"
    ]),
    branch("Named Presidential Episodes", [
        "George Washington's Cabinet Debate over the National Bank", "James Madison's Veto of the Bonus Bill (1817)",
        "Abraham Lincoln's Preliminary Emancipation Proclamation", "Theodore Roosevelt's 1902 Coal Strike Intervention",
        "Woodrow Wilson's League of Nations Senate Fight", "Franklin D. Roosevelt's 1937 Judicial Procedures Reform Bill",
        "Harry Truman's Executive Order 9981", "Dwight Eisenhower and Little Rock in 1957", "John F. Kennedy's 1962 Steel Price Crisis",
        "Lyndon Johnson and the 1964 Civil Rights Act Coalition", "Richard Nixon's Saturday Night Massacre",
        "Gerald Ford's 1974 Nixon Pardon", "Ronald Reagan's 1986 Immigration Reform Coalition",
        "George H. W. Bush and the 1990 Americans with Disabilities Act", "Bill Clinton's 1993 Deficit-Reduction Vote",
        "George W. Bush's 2001 Tax-Cut Reconciliation", "Barack Obama's 2010 Health-Care Reconciliation Strategy"
    ]),
    branch("White House Influence and Information", [
        "Fireside Chats and Public Pressure", "State of the Union Legislative Signaling", "Kitchen Cabinets and Informal Advisers",
        "Presidential Whip Counts", "Cabinet Meetings and Interagency Bargaining", "Signing Ceremonies as Coalition Messages",
        "Presidential Records and Information Control"
    ])
];
const SENATE_INNER_WORKINGS = [
    branch("Procedural Leverage", [
        "Committee Referral and Hearings", "Committee Markup and Amendment Negotiations", "Unanimous Consent Agreements",
        "Senate Holds", "Filibuster and Cloture under Rule XXII", "Voice Votes and Roll-Call Votes", "Riders on Must-Pass Bills",
        "Budget Reconciliation and the Byrd Rule", "Advice and Consent Negotiations", "Blue Slip and Judicial Nominations",
        "Conference Committees and Bicameral Bargaining"
    ]),
    branch("Named Legislative Stories", [
        "Everett Dirksen and the 1964 Civil Rights Act Cloture Vote", "Strom Thurmond's 1999 Stem-Cell Research Testimony",
        "Strom Thurmond's Fetal-Tissue Research Position", "Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)",
        "Stem Cell Research Enhancement Act of 2005", "John McCain and Russ Feingold's Bipartisan Campaign Reform Act",
        "Army–McCarthy Hearings and Senate Investigation", "Keating Five Ethics Investigation", "ABSCAM Senate Investigation",
        "Robert Byrd and Senate Control of the Floor", "Margaret Chase Smith's Declaration of Conscience"
    ]),
    branch("Coalitions and Negotiation", [
        "Party Conference Negotiations", "Bipartisan Working Groups", "Whip Counts and Vote Commitments",
        "Logrolling and Legislative Bargaining", "Conference Report Negotiations", "Constituent Casework as Legislative Feedback"
    ])
];
const HOUSE_INNER_WORKINGS = [
    branch("Procedural Leverage", [
        "Rules Committee Special Rules", "Open Rules and Closed Rules", "Discharge Petitions", "Suspension of the Rules",
        "House Committee Markup and Manager's Amendments", "The Motion to Recommit", "Appropriations Riders and Omnibus Bills",
        "House Whip Counts", "Party Caucus and Conference Negotiations", "House–Senate Conference Committees"
    ]),
    branch("Named Legislative Stories", [
        "Joseph Gurney Cannon and the 1910 House Revolt", "Charles R. Crisp and the 1931 Discharge Petition Rule",
        "The Hastert Rule and Majority-of-the-Majority Scheduling", "John Lewis and the 2016 House Sit-In",
        "House Impeachment Managers and Senate Trials", "The 1994 Republican Revolution and Committee Power",
        "The 2007 House Stem-Cell Research Vote", "ABSCAM and House Ethics Investigations"
    ]),
    branch("Coalitions and Negotiation", [
        "Bipartisan Problem-Solving Coalitions", "Leadership Vote Counting", "Rules Committee Negotiations",
        "Amendment Packages and Vote Trading", "Discharge-Petition Coalitions", "Conference Report Negotiations"
    ])
];
function buildUnitedStatesPoliticalHistory() {
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
            branch("Inner Workings", PRESIDENTIAL_INNER_WORKINGS),
            branch("Presidential Slogans and Campaigns", ["Campaign Slogans", "Inaugural Themes", "Reelection Campaigns", "Third-Party Presidential Campaigns"]),
            branch("Presidential Records", ["Longest Presidency", "Shortest Presidency", "Youngest and Oldest Presidents", "Presidential Elections and Popular Vote", "Presidential Firsts", "Presidential Libraries"]),
            branch("Presidential Corruption Scandals", PRESIDENTIAL_SCANDALS),
            branch("Other Presidential Scandals", ["Personal and Ethical Controversies", "Pardon and Patronage Controversies", "Executive Conflict of Interest", "Presidential Records and Transparency"])
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
            branch("Inner Workings", SENATE_INNER_WORKINGS),
            branch("Notable Senators", FAMOUS_SENATORS, ["Famous Senators"]),
            branch("Senate Elections and Representation", ELECTION_CYCLES.map((cycle) => `Senate ${cycle}`)),
            branch("Senate Committees and Leadership", ["Party Leaders", "Committee Chairs", "Filibuster and Cloture", "Advice and Consent"]),
            branch("Senate Corruption Scandals", CONGRESSIONAL_SCANDALS),
            branch("Other Senate Scandals", ["Personal Misconduct and Ethics Cases", "Lobbying and Influence", "Campaign Finance"]),
            branch("Senate Records", ["Longest-Serving Senators", "Youngest Senators", "Senate Firsts", "Record Votes and Debates", "Historic Confirmations"])
        ]),
        branch("House", [
            branch("House Eras", ["Early House", "Antebellum House", "Civil War and Reconstruction House", "Progressive Era House", "New Deal House", "Civil Rights Era House", "Modern House"]),
            branch("Inner Workings", HOUSE_INNER_WORKINGS),
            branch("Congresses During Each Speakership", CONGRESS_LABELS.map((label, index) => `${label} — ${HOUSE_SPEAKERS_BY_CONGRESS[index] ?? "Speakership"} Tenure`)),
            branch("Notable House Members", FAMOUS_HOUSE_MEMBERS, ["Famous House Members"]),
            branch("House Elections and Representation", ELECTION_CYCLES.map((cycle) => `House ${cycle}`)),
            branch("House Corruption Scandals", CONGRESSIONAL_SCANDALS),
            branch("Other House Scandals", ["House Ethics Investigations", "Lobbying and Influence", "Campaign Finance"]),
            branch("House Records", ["Longest-Serving Representatives", "Youngest Representatives", "House Firsts", "Historic Impeachments", "Historic Speeches"])
        ]),
        branch("Cabinet", [
            branch("History of the Cabinet", ["Washington's Cabinet", "Growth of the Executive Departments", "Cabinet Government and the Presidency", "Cabinet-Level Offices", "Modern Cabinet Appointments"]),
            ...CABINET_POSITIONS.map((position) => branch(position, ["Institutional History", "Secretaries and Leadership", "Major Decisions and Controversies"])),
            branch("Cabinet Corruption Scandals", CABINET_SCANDALS),
            branch("Other Cabinet Scandals", ["Conflicts of Interest", "Patronage and Appointments", "Procurement and Contracting"]),
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
function buildWorldPoliticalHistory() {
    return branch("World Political History", worldCountries.map((country) => {
        const leaders = WORLD_LEADERS[country] || ["Historical Leaders and Governments", "Modern National Leaders", "Short-Term and Transitional Leaders"];
        const events = WORLD_EVENTS[country] || genericWorldEvents;
        return branch(country, [branch("Leaders and Governments", leaders), branch("Major Political Events", events), branch("Political Institutions and Parties", ["Constitutional Development", "Political Parties and Elections", "Local and Regional Government", "International Relations"])]);
    }));
}
exports.POLITICAL_HISTORY_CATALOG_SOURCES = [
    "https://www.archives.gov/research/census/presidents",
    "https://www.senate.gov/about/officers-staff/vice-presidents.htm",
    "https://www.senate.gov/about/powers-procedures/voting.htm",
    "https://www.senate.gov/general/common/generic/about_committees.htm",
    "https://www.senate.gov/about/powers-procedures/filibusters-cloture.htm",
    "https://www.govinfo.gov/content/pkg/CHRG-106shrg61422/pdf/CHRG-106shrg61422.pdf",
    "https://www.govinfo.gov/content/pkg/GPO-CRECB-1998-pt1/pdf/GPO-CRECB-1998-pt1-10-1.pdf",
    "https://history.house.gov/Blog/2023/July/7-20-Discharge-Petitions/",
    "https://history.house.gov/People/Office/Speakers_Numerical_Order/",
    "https://history.house.gov/People/Detail/16948",
    "https://history.house.gov/People/Detail/18324",
    "https://history.house.gov/People/Detail/22236",
    "https://www.senate.gov/artandhistory/history/resources/pdf/chronlist.pdf",
    "https://www.supremecourt.gov/visiting/highlightsbrochure_may2026.pdf"
];

},
"disease-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISEASE_CATALOG_SOURCES = void 0;
exports.buildDiseasesTopic = buildDiseasesTopic;
const public_health_catalog_1 = require("./public-health-catalog");
const branch = (label, children, aliases = []) => ({ label, children, aliases });
const RESPIRATORY_DISEASES = [
    "COVID-19", "Influenza", "Common Cold", "Respiratory Syncytial Virus", "SARS", "MERS", "Tuberculosis", "Pertussis",
    "Diphtheria", "Pneumonia", "Legionnaires' Disease", "Pneumocystis Pneumonia", "Histoplasmosis", "Coccidioidomycosis",
    "Blastomycosis", "Aspergillosis", "Hantavirus Pulmonary Syndrome", "Lungworm Disease", "Silicosis", "Asbestosis"
];
const FEVER_AND_INFLAMMATION = [
    "Influenza", "Malaria", "Dengue", "Chikungunya", "Yellow Fever", "Typhoid Fever", "Relapsing Fever", "Q Fever",
    "Rocky Mountain Spotted Fever", "Rheumatic Fever", "Scarlet Fever", "Lassa Fever", "Marburg Virus Disease", "Ebola Disease",
    "Crimean-Congo Hemorrhagic Fever", "West Nile Fever", "Japanese Encephalitis", "Zika Virus Disease", "Chagas Disease"
];
const SKIN_AND_RASH_DISEASES = [
    "Smallpox", "Mpox (Monkeypox)", "Chickenpox", "Measles", "Rubella", "Hand, Foot, and Mouth Disease", "Molluscum Contagiosum",
    "Warts and Human Papillomavirus", "Impetigo", "Leprosy", "Erysipelas", "Ringworm", "Candidiasis of the Skin", "Scabies",
    "Cutaneous Leishmaniasis", "Sporotrichosis", "Chromoblastomycosis", "Mycetoma", "Anthrax of the Skin", "Necrotizing Fasciitis"
];
const NEUROLOGICAL_DISEASES = [
    "Polio", "Rabies", "Tetanus", "Meningococcal Disease", "Viral Meningitis", "Encephalitis", "Japanese Encephalitis",
    "West Nile Neuroinvasive Disease", "Herpes Simplex Encephalitis", "Neurocysticercosis", "African Sleeping Sickness",
    "Creutzfeldt-Jakob Disease", "Variant Creutzfeldt-Jakob Disease", "Kuru", "Fatal Familial Insomnia", "Toxoplasmosis of the Brain"
];
const DIGESTIVE_DISEASES = [
    "Cholera", "Typhoid Fever", "Paratyphoid Fever", "Salmonellosis", "Shigellosis", "Campylobacteriosis", "Listeriosis",
    "Norovirus Infection", "Rotavirus Infection", "Hepatitis A", "Hepatitis E", "Amebiasis", "Giardiasis", "Cryptosporidiosis",
    "Intestinal Worm Infections", "Botulism", "Food Poisoning", "Clostridioides difficile Infection", "Whipple Disease"
];
const BLOOD_AND_LYMPH_DISEASES = [
    "HIV Infection and AIDS", "Hepatitis B", "Hepatitis C", "Malaria", "Babesiosis", "Chagas Disease", "Dengue",
    "Yellow Fever", "Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Crimean-Congo Hemorrhagic Fever", "Plague",
    "Brucellosis", "Tularemia", "Lyme Disease", "Visceral Leishmaniasis", "Lymphatic Filariasis"
];
const VIRAL_DISEASES = [
    branch("Respiratory Viruses", RESPIRATORY_DISEASES),
    branch("Childhood and Vaccine-Preventable Viral Diseases", ["Measles", "Mumps", "Rubella", "Chickenpox", "Polio", "Diphtheria", "Pertussis", "Rotavirus Infection", "Hepatitis B", "Human Papillomavirus Disease"]),
    branch("Viral Hemorrhagic Fevers", ["Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Crimean-Congo Hemorrhagic Fever", "Yellow Fever", "Dengue Hemorrhagic Fever", "Rift Valley Fever", "Omsk Hemorrhagic Fever", "Kyasanur Forest Disease"]),
    branch("Viral Diseases of the Liver", ["Hepatitis A", "Hepatitis B", "Hepatitis C", "Hepatitis D", "Hepatitis E", "Hepatitis G", "Hepatitis-Associated Cirrhosis"]),
    branch("Viral Diseases of the Nervous System", NEUROLOGICAL_DISEASES.filter((disease) => ["Polio", "Rabies", "Viral Meningitis", "Encephalitis", "Japanese Encephalitis", "West Nile Neuroinvasive Disease", "Herpes Simplex Encephalitis"].includes(disease))),
    branch("Viral Skin and Mucosal Diseases", ["Smallpox", "Mpox (Monkeypox)", "Chickenpox", "Measles", "Rubella", "Molluscum Contagiosum", "Warts and Human Papillomavirus", "Herpes Simplex", "Shingles", "Hand, Foot, and Mouth Disease"]),
    branch("Mosquito- and Tick-Borne Viruses", ["Dengue", "Yellow Fever", "West Nile Virus Disease", "Zika Virus Disease", "Chikungunya", "Japanese Encephalitis", "Rift Valley Fever", "Tick-Borne Encephalitis", "Colorado Tick Fever"]),
    branch("Animal-Associated Viral Diseases", ["Rabies", "Avian Influenza", "Swine Influenza", "Nipah Virus Disease", "Hendra Virus Disease", "Ebola Disease", "Marburg Virus Disease", "Hantavirus Disease", "Mpox (Monkeypox)", "COVID-19"]),
    branch("Viral Sexually Transmitted Infections", ["HIV Infection and AIDS", "Human Papillomavirus Disease", "Genital Herpes", "Hepatitis B", "Molluscum Contagiosum", "Cytomegalovirus Infection"])
];
const BACTERIAL_DISEASES = [
    branch("Respiratory Bacterial Diseases", ["Tuberculosis", "Pertussis", "Diphtheria", "Pneumococcal Disease", "Legionnaires' Disease", "Mycoplasma Pneumonia", "Haemophilus Influenzae Disease", "Melioidosis"]),
    branch("Water- and Foodborne Bacterial Diseases", ["Cholera", "Typhoid Fever", "Paratyphoid Fever", "Salmonellosis", "Shigellosis", "Campylobacteriosis", "Listeriosis", "Botulism", "Escherichia coli Infection", "Yersiniosis", "Vibrio Infection"]),
    branch("Bacterial Diseases of the Skin", ["Impetigo", "Cellulitis", "Erysipelas", "Leprosy", "Anthrax", "Boils and Furunculosis", "Necrotizing Fasciitis", "Staphylococcal Scalded Skin Syndrome"]),
    branch("Bacterial Sexually Transmitted Infections", ["Syphilis", "Gonorrhea", "Chancroid", "Chlamydia", "Lymphogranuloma Venereum", "Granuloma Inguinale"]),
    branch("Bacterial Diseases of the Nervous System", ["Tetanus", "Bacterial Meningitis", "Botulism", "Neurobrucellosis", "Neurosyphilis", "Leprosy of the Nervous System"]),
    branch("Bacterial Vector- and Animal-Borne Diseases", ["Plague", "Lyme Disease", "Rocky Mountain Spotted Fever", "Ehrlichiosis", "Anaplasmosis", "Tularemia", "Brucellosis", "Leptospirosis", "Q Fever"]),
    branch("Antibiotic-Resistant Bacterial Diseases", ["MRSA Infection", "Drug-Resistant Tuberculosis", "Drug-Resistant Gonorrhea", "Vancomycin-Resistant Enterococci", "Carbapenem-Resistant Enterobacterales", "Multidrug-Resistant Salmonella", "Antimicrobial-Resistant Typhoid"])
];
const FUNGAL_DISEASES = [
    branch("Fungal Lung Diseases", ["Histoplasmosis", "Blastomycosis", "Coccidioidomycosis", "Aspergillosis", "Cryptococcosis", "Mucormycosis", "Pneumocystis Pneumonia", "Paracoccidioidomycosis", "Talaromycosis"]),
    branch("Fungal Skin and Nail Diseases", ["Ringworm", "Athlete's Foot", "Jock Itch", "Onychomycosis", "Candidiasis of the Skin", "Sporotrichosis", "Chromoblastomycosis", "Mycetoma", "Tinea Versicolor"]),
    branch("Fungal Diseases in the Mouth and Body", ["Oral Thrush", "Invasive Candidiasis", "Vaginal Candidiasis", "Cryptococcal Meningitis", "Fungal Sinusitis", "Fungal Eye Infection", "Pneumocystis Pneumonia"]),
    branch("Soil- and Environment-Associated Fungal Diseases", ["Histoplasmosis", "Blastomycosis", "Valley Fever", "Sporotrichosis", "Paracoccidioidomycosis", "Talaromycosis", "Mycetoma"])
];
const PARASITIC_DISEASES = [
    branch("Protozoan Diseases", ["Malaria", "Amebiasis", "Giardiasis", "Cryptosporidiosis", "Toxoplasmosis", "Chagas Disease", "African Sleeping Sickness", "Leishmaniasis", "Trichomoniasis", "Babesiosis", "Naegleria Fowleri Infection"]),
    branch("Worm Diseases", ["Ascariasis", "Hookworm Disease", "Strongyloidiasis", "Trichuriasis", "Schistosomiasis", "Trichinellosis", "Taeniasis", "Cysticercosis", "Echinococcosis", "Lymphatic Filariasis", "Onchocerciasis", "Dracunculiasis", "Pinworm Infection"]),
    branch("Insect- and Arthropod-Borne Parasitic Diseases", ["Malaria", "Leishmaniasis", "African Sleeping Sickness", "Chagas Disease", "Onchocerciasis", "Lymphatic Filariasis", "Scabies", "Pediculosis", "Tungiasis"]),
    branch("Food- and Water-Associated Parasitic Diseases", ["Giardiasis", "Cryptosporidiosis", "Amebiasis", "Cyclosporiasis", "Toxoplasmosis", "Trichinellosis", "Taeniasis", "Fascioliasis", "Paragonimiasis"]),
    branch("Neglected Tropical Diseases", ["Schistosomiasis", "Leishmaniasis", "Chagas Disease", "African Sleeping Sickness", "Lymphatic Filariasis", "Onchocerciasis", "Trachoma", "Dracunculiasis", "Buruli Ulcer", "Mycetoma", "Yaws"])
];
const PRION_DISEASES = [
    "Creutzfeldt-Jakob Disease", "Variant Creutzfeldt-Jakob Disease", "Kuru", "Fatal Familial Insomnia", "Gerstmann-Sträussler-Scheinker Syndrome",
    "Bovine Spongiform Encephalopathy", "Chronic Wasting Disease", "Scrapie"
];
const TRANSMISSION_GROUPS = [
    branch("Airborne and Respiratory Spread", RESPIRATORY_DISEASES.concat(["Measles", "Chickenpox"])),
    branch("Fecal-Oral and Waterborne Spread", DIGESTIVE_DISEASES.concat(["Polio"])),
    branch("Foodborne Spread", ["Salmonellosis", "Listeriosis", "Campylobacteriosis", "Botulism", "Norovirus Infection", "Hepatitis A", "Toxoplasmosis", "Trichinellosis", "E. coli Infection", "Typhoid Fever"]),
    branch("Bloodborne Spread", BLOOD_AND_LYMPH_DISEASES),
    branch("Sexual Contact", ["HIV Infection and AIDS", "Syphilis", "Gonorrhea", "Chlamydia", "Genital Herpes", "Human Papillomavirus Disease", "Trichomoniasis", "Hepatitis B"]),
    branch("Vector-Borne Spread", ["Malaria", "Dengue", "Yellow Fever", "Zika Virus Disease", "Chikungunya", "West Nile Virus Disease", "Lyme Disease", "Plague", "Leishmaniasis", "African Sleeping Sickness", "Onchocerciasis"]),
    branch("Animal-to-Human Spread", ["Rabies", "Brucellosis", "Leptospirosis", "Anthrax", "Avian Influenza", "Swine Influenza", "Ebola Disease", "Marburg Virus Disease", "Nipah Virus Disease", "Hantavirus Disease", "COVID-19"]),
    branch("Soil and Environmental Exposure", ["Tetanus", "Histoplasmosis", "Blastomycosis", "Coccidioidomycosis", "Hookworm Disease", "Strongyloidiasis", "Anthrax", "Sporotrichosis", "Legionnaires' Disease"]),
    branch("Direct Contact and Surfaces", ["Mpox (Monkeypox)", "Molluscum Contagiosum", "Impetigo", "Ringworm", "Scabies", "Conjunctivitis", "Norovirus Infection", "C. difficile Infection"])
];
const BODY_SYSTEM_GROUPS = [
    branch("Respiratory System", RESPIRATORY_DISEASES),
    branch("Digestive System", DIGESTIVE_DISEASES),
    branch("Liver and Gallbladder", ["Hepatitis A", "Hepatitis B", "Hepatitis C", "Hepatitis D", "Hepatitis E", "Yellow Fever", "Liver Fluke Disease", "Echinococcosis"]),
    branch("Nervous System", NEUROLOGICAL_DISEASES),
    branch("Skin and Hair", SKIN_AND_RASH_DISEASES),
    branch("Eyes and Vision", ["Trachoma", "Onchocerciasis", "Fungal Eye Infection", "Acanthamoeba Keratitis", "Herpes Eye Disease", "Cytomegalovirus Retinitis", "Toxoplasmosis of the Eye"]),
    branch("Heart and Blood Vessels", ["Rheumatic Fever", "Chagas Disease", "Endocarditis", "Malaria", "Dengue", "Babesiosis", "Lyme Carditis", "Brucellosis"]),
    branch("Reproductive and Urinary Systems", ["Gonorrhea", "Chlamydia", "Syphilis", "Trichomoniasis", "Genital Herpes", "Candidiasis", "Schistosomiasis", "Urinary Tract Infection"]),
    branch("Immune System and Whole-Body Effects", ["HIV Infection and AIDS", "Sepsis", "Toxic Shock Syndrome", "Cytomegalovirus Infection", "Infectious Mononucleosis", "Measles", "Tuberculosis", "Malaria"])
];
const EFFECT_GROUPS = [
    branch("Fever and Chills", FEVER_AND_INFLAMMATION),
    branch("Rashes and Skin Changes", SKIN_AND_RASH_DISEASES),
    branch("Breathing Problems", RESPIRATORY_DISEASES),
    branch("Digestive Symptoms", DIGESTIVE_DISEASES),
    branch("Bleeding and Hemorrhagic Illness", ["Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Dengue Hemorrhagic Fever", "Yellow Fever", "Crimean-Congo Hemorrhagic Fever", "Hemolytic Uremic Syndrome", "Severe Sepsis"]),
    branch("Brain and Nerve Effects", NEUROLOGICAL_DISEASES),
    branch("Long-Term and Chronic Effects", ["HIV Infection and AIDS", "Long COVID", "Post-Polio Syndrome", "Chronic Hepatitis", "Rheumatic Heart Disease", "Post-Tuberculosis Lung Disease", "Chronic Chagas Disease", "Post-Infectious Encephalitis"])
];
const IMPACT_GROUPS = [
    branch("Public Health and Prevention", ["Vaccination", "Quarantine and Isolation", "Contact Tracing", "Public Health Surveillance", "Outbreak Investigation", "Health Education", "Community Health Workers", "One Health", "Disease Elimination", "Disease Eradication"]),
    branch("Hospitals and Health Systems", ["Surge Capacity", "Infection Prevention and Control", "Personal Protective Equipment", "Healthcare-Associated Infections", "Laboratory Networks", "Emergency Departments During Outbreaks", "Rural Health and Access", "Global Health Systems"]),
    branch("Economy, Work, and Education", ["Workplace Outbreaks", "School Closures and Reopening", "Food Supply Disruptions", "Travel and Trade", "Economic Costs of Epidemics", "Paid Sick Leave and Public Health", "Occupational Disease"]),
    branch("Society, Culture, and Trust", ["Stigma and Discrimination", "Disability and Long-Term Recovery", "Risk Communication", "Misinformation and Rumors", "Memorials and Collective Memory", "Health Inequality", "Ethics During Outbreaks"]),
    branch("Medicine and Research", ["Vaccine Development", "Antimicrobial Resistance", "Clinical Trials During Outbreaks", "Disease Modeling", "Genomic Surveillance", "Diagnostics", "Public Health Funding", "Medical Supply Chains"]),
    branch("Historical Impact", ["The Black Death and Social Change", "Smallpox and Indigenous Communities", "1918 Influenza and World War I", "HIV/AIDS and Activism", "COVID-19 and Daily Life", "Epidemics and Migration", "Disease and Colonialism"])
];
const PANDEMICS_BY_TIME = [
    branch("Ancient and Medieval", ["Plague of Athens", "Antonine Plague", "Plague of Cyprian", "Plague of Justinian", "Black Death", "Cocoliztli Epidemics", "Medieval Leprosy Epidemics", "Medieval Smallpox Outbreaks"]),
    branch("Sixteenth Through Eighteenth Centuries", ["Smallpox in the Americas", "Great Plague of London", "Great Plague of Marseille", "Yellow Fever Epidemics in the Americas", "Eighteenth-Century Smallpox Epidemics", "Measles Epidemics in the Pacific", "Cholera Before the First Pandemic"]),
    branch("Nineteenth Century", ["First Cholera Pandemic", "Second Cholera Pandemic", "Third Cholera Pandemic", "Fourth Cholera Pandemic", "Fifth Cholera Pandemic", "Sixth Cholera Pandemic", "Seventh Cholera Pandemic", "1855 Yunnan Plague", "Yellow Fever in the Mississippi Valley", "Smallpox Epidemics of the Nineteenth Century"]),
    branch("Early Twentieth Century", ["1918 Influenza Pandemic", "1920s Smallpox Epidemics", "1930s Polio Epidemics", "1940s Diphtheria Epidemics", "Asian Influenza Pandemic of 1957", "Hong Kong Influenza Pandemic of 1968", "Seventh Cholera Pandemic"]),
    branch("Late Twentieth Century", ["HIV/AIDS Pandemic", "1977 Russian Influenza", "1980s Measles Resurgence", "1990s Cholera Epidemics", "1997 H5N1 Avian Influenza", "1998 Nipah Virus Outbreak", "1999 West Nile Virus in North America"]),
    branch("Twenty-First Century", ["SARS Outbreak of 2002–2004", "2009 H1N1 Influenza Pandemic", "2014–2016 West Africa Ebola Epidemic", "2015–2016 Zika Epidemic", "MERS Outbreaks", "COVID-19 Pandemic", "2022 Mpox Global Outbreak", "2023–2024 Dengue Epidemics"]),
    branch("Recurring and Ongoing Epidemics", ["Seasonal Influenza Epidemics", "Malaria Epidemics", "Tuberculosis Epidemics", "HIV/AIDS Epidemic", "Dengue Epidemics", "Cholera Epidemics", "Measles Outbreaks", "Yellow Fever Outbreaks", "Polio Outbreaks", "Meningitis Belt Epidemics"])
];
const PANDEMICS_BY_TYPE = [
    branch("Influenza Pandemics", ["1918 Influenza Pandemic", "Asian Influenza Pandemic of 1957", "Hong Kong Influenza Pandemic of 1968", "1977 Russian Influenza", "2009 H1N1 Influenza Pandemic", "Avian Influenza Threats", "Swine Influenza Outbreaks"]),
    branch("Coronavirus Epidemics and Pandemics", ["SARS Outbreak of 2002–2004", "MERS Outbreaks", "COVID-19 Pandemic", "Seasonal Human Coronaviruses", "Animal Coronavirus Spillover"]),
    branch("Cholera and Waterborne Epidemics", ["First Cholera Pandemic", "Second Cholera Pandemic", "Third Cholera Pandemic", "Fourth Cholera Pandemic", "Fifth Cholera Pandemic", "Sixth Cholera Pandemic", "Seventh Cholera Pandemic", "Modern Cholera Outbreaks"]),
    branch("Vector-Borne Epidemics", ["Malaria Epidemics", "Yellow Fever Epidemics", "Dengue Epidemics", "Zika Epidemic", "Chikungunya Epidemics", "West Nile Virus Epidemics", "Plague Epidemics", "Leishmaniasis Epidemics"]),
    branch("Viral Hemorrhagic Fever Epidemics", ["West Africa Ebola Epidemic", "Sudan Ebola Outbreaks", "Marburg Virus Outbreaks", "Lassa Fever Epidemics", "Crimean-Congo Hemorrhagic Fever Outbreaks", "Yellow Fever Epidemics", "Dengue Hemorrhagic Fever Epidemics"]),
    branch("Zoonotic Epidemics", ["COVID-19 Pandemic", "SARS Outbreak of 2002–2004", "MERS Outbreaks", "Nipah Virus Outbreaks", "H5N1 Avian Influenza", "Rabies Epidemics", "Ebola Disease Outbreaks", "Hantavirus Outbreaks", "Mpox Global Outbreak"]),
    branch("Bacterial Epidemics", ["Tuberculosis Epidemics", "Diphtheria Epidemics", "Pertussis Epidemics", "Meningitis Epidemics", "Plague Epidemics", "Typhoid Fever Epidemics", "Scarlet Fever Epidemics", "Drug-Resistant Bacterial Outbreaks"]),
    branch("Childhood and Vaccine-Preventable Epidemics", ["Smallpox Epidemics", "Measles Outbreaks", "Polio Outbreaks", "Rubella Epidemics", "Mumps Outbreaks", "Diphtheria Epidemics", "Pertussis Epidemics"]),
    branch("Regional and Healthcare-Associated Outbreaks", ["Hospital Outbreaks", "Foodborne Outbreaks", "School Outbreaks", "Nursing Home Outbreaks", "Cruise Ship Outbreaks", "Refugee Camp Outbreaks", "Prison Outbreaks", "Mass Gathering Outbreaks"])
];
function buildDiseasesTopic() {
    return branch("Diseases", [
        branch("Viruses & Diseases", [
            branch("By Causative Agent", [
                branch("Viral Diseases", VIRAL_DISEASES),
                branch("Bacterial Diseases", BACTERIAL_DISEASES),
                branch("Fungal Diseases", FUNGAL_DISEASES),
                branch("Parasitic Diseases", PARASITIC_DISEASES),
                branch("Prion Diseases", PRION_DISEASES)
            ]),
            branch("By How They Spread", TRANSMISSION_GROUPS),
            branch("By Body System", BODY_SYSTEM_GROUPS),
            branch("By Main Effects", EFFECT_GROUPS),
            branch("Zoonotic Diseases", ["Rabies", "COVID-19", "SARS", "MERS", "Avian Influenza", "Swine Influenza", "Ebola Disease", "Marburg Virus Disease", "Nipah Virus Disease", "Hantavirus Disease", "Brucellosis", "Leptospirosis", "Anthrax", "Plague", "Lyme Disease", "Chagas Disease", "Toxoplasmosis"]),
            branch("Diseases of Pregnancy and Newborns", ["Congenital Syphilis", "Congenital Rubella Syndrome", "Congenital Toxoplasmosis", "Neonatal Herpes", "Group B Streptococcal Disease", "Neonatal Tetanus", "Congenital Cytomegalovirus", "Zika and Birth Defects"]),
            branch("Emerging and Re-Emerging Diseases", ["COVID-19", "Mpox (Monkeypox)", "Nipah Virus Disease", "H5N1 Avian Influenza", "Drug-Resistant Tuberculosis", "Candida auris", "Ebola Disease", "Zika Virus Disease", "West Nile Virus Disease", "Novel Pathogens"]),
            branch("Impact of Disease on Society", IMPACT_GROUPS),
            branch("Disease History and Discovery", ["Germ Theory", "Early Epidemic Records", "Microscopy and Microbiology", "Vaccine History", "Antibiotic History", "The First Public Health Departments", "Epidemiology", "Disease Naming and Classification", "Disease Eradication Campaigns"]),
            branch("Noninfectious Diseases", ["Cancer", "Heart Disease", "Stroke", "Diabetes", "Asthma", "Autoimmune Disease", "Genetic Disorders", "Neurodegenerative Disease", "Mental Health Conditions", "Environmental Disease", "Occupational Disease"]),
            branch("Prevention and Control", ["Vaccines", "Hand Hygiene", "Clean Water", "Sanitation", "Food Safety", "Vector Control", "Personal Protective Equipment", "Antimicrobial Stewardship", "Disease Surveillance", "Outbreak Preparedness"]),
            branch("Diagnosis and Public Health", ["Laboratory Testing", "Medical Imaging", "Case Definitions", "Disease Reporting", "Contact Tracing", "Genomic Surveillance", "Epidemiology", "Public Health Laboratories", "Health Data and Privacy"]),
            branch("Antimicrobial Resistance", ["Drug-Resistant Tuberculosis", "Drug-Resistant Gonorrhea", "MRSA Infection", "Candida auris", "Antimicrobial Stewardship", "Hospital Infection Control", "New Antibiotic Discovery", "One Health and Resistance"]),
            ...(0, public_health_catalog_1.buildPublicHealthOrganizations)()
        ]),
        branch("Pandemics & Epidemics", [
            branch("By Time Span", PANDEMICS_BY_TIME),
            branch("By Type", PANDEMICS_BY_TYPE),
            branch("Public Health Response", ["Quarantine", "Isolation", "Contact Tracing", "Vaccination Campaigns", "Masking and Respiratory Protection", "Travel Measures", "Emergency Declarations", "International Health Regulations", "Community Response", "Pandemic Preparedness"]),
            branch("How Outbreaks Spread", ["Animal Spillover", "Respiratory Spread", "Water and Sanitation", "Foodborne Spread", "Vector Expansion", "Global Travel", "Crowded Housing", "Healthcare Transmission", "Misinformation During Outbreaks"])
        ])
    ]);
}
exports.DISEASE_CATALOG_SOURCES = [
    "https://www.nih.gov/institutes-nih/list-institutes-centers",
    "https://www.who.int/about/governance/world-health-assembly",
    "https://www.cdc.gov/about/organization/",
    "https://www.nih.gov/nih-style-guide/appendix-biomedical-definitions",
    "https://www.who.int/health-topics/pandemics",
    "https://www.cdc.gov/fungal/about/types-of-fungal-diseases.html",
    "https://www.cdc.gov/healthy-pets/diseases/index.html",
    "https://cdc.gov/parasites/causes/index.html"
];

},
"public-health-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPublicHealthOrganizations = buildPublicHealthOrganizations;
const branch = (label, children, aliases = []) => ({ label, children, aliases });
const NIH_INSTITUTES = [
    "National Cancer Institute (NCI)",
    "National Eye Institute (NEI)",
    "National Heart, Lung, and Blood Institute (NHLBI)",
    "National Human Genome Research Institute (NHGRI)",
    "National Institute on Aging (NIA)",
    "National Institute on Alcohol Abuse and Alcoholism (NIAAA)",
    "National Institute of Allergy and Infectious Diseases (NIAID)",
    "National Institute of Arthritis and Musculoskeletal and Skin Diseases (NIAMS)",
    "National Institute of Biomedical Imaging and Bioengineering (NIBIB)",
    "Eunice Kennedy Shriver National Institute of Child Health and Human Development (NICHD)",
    "National Institute on Deafness and Other Communication Disorders (NIDCD)",
    "National Institute of Dental and Craniofacial Research (NIDCR)",
    "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK)",
    "National Institute on Drug Abuse (NIDA)",
    "National Institute of Environmental Health Sciences (NIEHS)",
    "National Institute of General Medical Sciences (NIGMS)",
    "National Institute of Mental Health (NIMH)",
    "National Institute on Minority Health and Health Disparities (NIMHD)",
    "National Institute of Neurological Disorders and Stroke (NINDS)",
    "National Institute of Nursing Research (NINR)",
    "National Library of Medicine (NLM)"
];
const NIH_CENTERS = [
    "NIH Clinical Center",
    "Center for Information Technology (CIT)",
    "Center for Scientific Review (CSR)",
    "Fogarty International Center (FIC)",
    "National Center for Advancing Translational Sciences (NCATS)",
    "National Center for Complementary and Integrative Health (NCCIH)"
];
const NIH_OFFICES = [
    "Office of the Director",
    "Office of AIDS Research",
    "Office of Behavioral and Social Sciences Research",
    "Office of Disease Prevention",
    "Office of Dietary Supplements",
    "Office of Intramural Research",
    "Office of Research on Women's Health",
    "Office of Science Policy",
    "Office of Data Science Strategy",
    "Office of Portfolio Analysis",
    "Office of Autoimmune Disease Research",
    "Office of Research Integrity"
];
const NIH_PROGRAMS = [
    "NIH Common Fund",
    "All of Us Research Program",
    "BRAIN Initiative",
    "Cancer Moonshot",
    "HEAL Initiative",
    "RECOVER Initiative",
    "Rapid Acceleration of Diagnostics (RADx)",
    "NIH Toolbox",
    "ClinicalTrials.gov",
    "PubMed",
    "MedlinePlus",
    "National Library of Medicine Data Resources",
    "NIH Research Projects",
    "NIH Grants and Funding",
    "Intramural Research",
    "Extramural Research"
];
const NIH_HEALTH_AREAS = [
    "Infectious Diseases",
    "Cancer",
    "Heart, Lung, and Blood Diseases",
    "Neurological Disorders",
    "Mental Health",
    "Aging",
    "Child Health and Development",
    "Genetic and Genomic Conditions",
    "Diabetes and Digestive Diseases",
    "Drug Use and Addiction",
    "Environmental Health",
    "Autoimmune Diseases",
    "Health Disparities",
    "Women's Health",
    "Biomedical Imaging",
    "Nursing Research"
];
const WHO_ASSEMBLIES = [
    ...Array.from({ length: 79 }, (_, index) => `WHA ${index + 1}`),
    "First Special Session of the World Health Assembly (WHASS 1)",
    "Second Special Session of the World Health Assembly (WHASS 2)",
    "Third Special Session of the World Health Assembly (WHASS 3)"
];
const WHO_PROGRAMS = [
    "WHO Health Emergencies Programme",
    "Global Polio Eradication Initiative",
    "Expanded Programme on Immunization",
    "Global Influenza Surveillance and Response System",
    "Pandemic Influenza Preparedness Framework",
    "Global Outbreak Alert and Response Network",
    "Stop TB Partnership",
    "Global Malaria Programme",
    "HIV/AIDS Programme",
    "Neglected Tropical Diseases Programme",
    "Essential Medicines Programme",
    "Antimicrobial Resistance Programme",
    "Global Health Observatory",
    "World Health Statistics",
    "Universal Health Coverage",
    "Primary Health Care",
    "One Health",
    "Research and Development Blueprint",
    "Access to COVID-19 Tools Accelerator (ACT-Accelerator)",
    "COVAX Facility",
    "Global Vaccine Action Plan",
    "WHO Framework Convention on Tobacco Control",
    "Global Action Plan for the Prevention and Control of Noncommunicable Diseases",
    "Mental Health Action Plan",
    "Global Strategy for Women's, Children's and Adolescents' Health"
];
const WHO_GOVERNANCE = [
    "World Health Assembly",
    "Executive Board",
    "Director-General",
    "General Programme of Work",
    "Fourteenth General Programme of Work (2025–2028)",
    "International Health Regulations",
    "WHO Pandemic Agreement",
    "Member States",
    "Regional Offices",
    "WHO Constitution",
    "World Health Report",
    "WHO Emergency Committee"
];
const WHO_REGIONS = [
    "African Region",
    "Region of the Americas",
    "South-East Asia Region",
    "European Region",
    "Eastern Mediterranean Region",
    "Western Pacific Region"
];
const WHO_SYSTEMS = [
    "Health Emergencies",
    "Immunization",
    "Disease Surveillance",
    "Research and Development",
    "Health Data",
    "Health Systems",
    "Health Workforce",
    "Essential Health Services",
    "Health Financing",
    "Quality of Care",
    "Digital Health",
    "Health and Climate Change"
];
const CDC_CENTERS = [
    "Center for Forecasting and Outbreak Analytics",
    "Global Health Center",
    "National Center on Birth Defects and Developmental Disabilities (NCBDDD)",
    "National Center for Chronic Disease Prevention and Health Promotion (NCCDPHP)",
    "National Center for Emerging and Zoonotic Infectious Diseases (NCEZID)",
    "National Center for Environmental Health (NCEH)",
    "Agency for Toxic Substances and Disease Registry (ATSDR)",
    "National Center for Health Statistics (NCHS)",
    "National Center for HIV, Viral Hepatitis, STD, and TB Prevention (NCHHSTP)",
    "National Center for Immunization and Respiratory Diseases (NCIRD)",
    "National Center for Injury Prevention and Control (NCIPC)",
    "National Center for State, Tribal, Local, and Territorial Public Health Infrastructure and Workforce (NCSTLTPHIW)",
    "National Institute for Occupational Safety and Health (NIOSH)"
];
const CDC_OFFICES = [
    "CDC Washington Office",
    "Office of Budget and Policy Analysis",
    "Office of Communications",
    "Office of the Chief Operating Officer",
    "Office of the Chief of Staff",
    "Office of Laboratory Science and Safety",
    "Office of Minority Health and Health Equity",
    "Office of Policy, Performance, and Evaluation",
    "Office of Public Health Data, Surveillance, and Technology",
    "Office of Readiness and Response",
    "Office of Strategy and Innovation"
];
const CDC_PROGRAMS = [
    "Epidemic Intelligence Service",
    "Field Epidemiology Training Program",
    "National Notifiable Diseases Surveillance System",
    "National Healthcare Safety Network",
    "National Syndromic Surveillance Program",
    "Data Modernization Initiative",
    "Public Health Emergency Preparedness",
    "Vaccines for Children",
    "Immunization Information Systems",
    "Global Health Security",
    "One Health",
    "WISQARS",
    "CDC WONDER",
    "National Center for Health Statistics Data",
    "Public Health Laboratory Response Network",
    "Emergency Operations Center",
    "Centers for Public Health Preparedness",
    "Behavioral Risk Factor Surveillance System",
    "Youth Risk Behavior Surveillance System",
    "National Vital Statistics System"
];
const CDC_DISEASE_AREAS = [
    "Infectious Diseases",
    "Respiratory Viruses",
    "HIV, Viral Hepatitis, and Sexually Transmitted Infections",
    "Tuberculosis",
    "Immunization",
    "Chronic Disease",
    "Environmental Health",
    "Injury Prevention",
    "Birth Defects and Developmental Disabilities",
    "Occupational Safety and Health",
    "Food Safety",
    "Vector-Borne Diseases",
    "Global Health",
    "Public Health Infrastructure",
    "Health Equity"
];
function buildPublicHealthOrganizations() {
    return [
        branch("NIH", [
            branch("Institutes", NIH_INSTITUTES),
            branch("Centers", NIH_CENTERS),
            branch("Office of the Director and Offices", NIH_OFFICES),
            branch("NIH Research Programs", NIH_PROGRAMS),
            branch("NIH Disease and Health Areas", NIH_HEALTH_AREAS)
        ]),
        branch("WHO", [
            branch("World Health Assembly Sessions", WHO_ASSEMBLIES),
            branch("WHO Programmes and Initiatives", WHO_PROGRAMS),
            branch("WHO Governance", WHO_GOVERNANCE),
            branch("WHO Regions", WHO_REGIONS),
            branch("WHO Health Systems", WHO_SYSTEMS)
        ]),
        branch("CDC", [
            branch("Centers and Institutes", CDC_CENTERS),
            branch("CDC Offices", CDC_OFFICES),
            branch("CDC Programs and Systems", CDC_PROGRAMS),
            branch("CDC Disease Areas", CDC_DISEASE_AREAS)
        ])
    ];
}

},
"computer-science-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPUTER_SCIENCE_RESUME_TOPICS = void 0;
exports.buildComputerScienceTopic = buildComputerScienceTopic;
const branch = (label, children, aliases = []) => ({ label, children, aliases });
const PROGRAMMING_FUNDAMENTALS = [
    branch("Core Programming Concepts", [
        "Variables", "Constants", "Data Types", "Type Systems", "Type Inference", "Control Flow", "Functions", "Parameters", "Return Values", "Scope", "Closures", "Recursion", "Exceptions", "Error Handling", "Assertions", "Modules", "Packages", "Namespaces", "Generics", "Interfaces", "Traits", "Decorators", "Iterators", "Generators", "Pattern Matching", "Immutability", "Serialization", "Deserialization"
    ]),
    branch("Object-Oriented Programming", ["Classes", "Objects", "Inheritance", "Composition", "Encapsulation", "Polymorphism", "Abstract Classes", "Interfaces", "SOLID Principles", "Design by Contract", "Dependency Injection", "Object Lifecycles"]),
    branch("Functional Programming", ["Pure Functions", "Higher-Order Functions", "First-Class Functions", "Function Composition", "Map and Reduce", "Immutability", "Algebraic Data Types", "Monads", "Functional Error Handling", "Reactive Programming"]),
    branch("Concurrency and Parallelism", [
        "Threads", "Thread Scheduling", "Thread Pools", "Thread-Local Storage", "Mutexes", "Locks", "Read-Write Locks", "Semaphores", "Condition Variables", "Atomics", "Race Conditions", "Deadlocks", "Livelocks", "Starvation", "Critical Sections", "Memory Ordering", "Async and Await", "Event Loops", "Futures and Promises", "Coroutines", "Actors", "Message Passing", "Work Stealing", "Parallel Algorithms", "Python Threading", "Python Asyncio", "Node Worker Threads", "JavaScript Event Loop", "Swift Concurrency", "Grand Central Dispatch", "Operation Queues", "Structured Concurrency"
    ]),
    branch("Runtime and Performance", ["Interpreters", "Compilers", "Just-in-Time Compilation", "Bytecode", "Virtual Machines", "Garbage Collection", "Reference Counting", "Memory Allocation", "Stack and Heap", "Profiling", "Benchmarking", "CPU Profiling", "Memory Profiling", "Latency", "Throughput", "Big O Notation"]),
    branch("Testing and Debugging", ["Unit Testing", "Integration Testing", "End-to-End Testing", "Property-Based Testing", "Test-Driven Development", "Mocking", "Fixtures", "Test Doubles", "Debuggers", "Breakpoints", "Logging", "Tracing", "Reproducible Bugs", "Fuzz Testing", "Static Analysis", "Linters", "Code Coverage"])
];
const LANGUAGE_DETAILS = [
    branch("Python", ["CPython", "Python Type Hints", "Virtual Environments", "pip", "Poetry", "uv", "Python Packaging", "Decorators", "Generators", "Context Managers", "Dataclasses", "Python Asyncio", "Python Threading", "Multiprocessing", "FastAPI", "NumPy", "pandas", "Jupyter Notebook", "scikit-learn"]),
    branch("JavaScript", ["ECMAScript", "Modules", "Promises", "Async Functions", "JavaScript Event Loop", "DOM APIs", "Fetch API", "Web Workers", "Node.js", "npm", "Node Worker Threads", "Chrome Extensions API"]),
    branch("TypeScript", ["Type Annotations", "Interfaces", "Generics", "Union Types", "Type Narrowing", "Decorators", "tsconfig", "TypeScript Compiler", "Type-Safe APIs", "TypeScript with React", "TypeScript with Next.js"]),
    branch("SQL", ["SELECT Queries", "Joins", "Subqueries", "Common Table Expressions", "Window Functions", "Indexes", "Transactions", "Constraints", "Views", "Stored Procedures", "Query Planning", "SQL Optimization"]),
    branch("Swift", ["Swift Value Types", "Optionals", "Protocols", "Generics", "Swift Concurrency", "Actors", "AsyncSequence", "Swift Package Manager", "SwiftUI", "AppKit Interoperability"]),
    branch("HTML", ["Semantic HTML", "Forms", "Accessibility Attributes", "HTML Parsing", "Web Components", "Progressive Enhancement"]),
    branch("CSS", ["Selectors", "Cascade", "Specificity", "Flexbox", "CSS Grid", "Container Queries", "Responsive Design", "Custom Properties", "Animations", "Tailwind CSS", "Design Tokens"]),
    branch("Java", ["JVM", "Garbage Collection", "Threads", "Executors", "Spring", "Maven", "Gradle"]),
    branch("C and C++", ["Pointers", "Manual Memory", "RAII", "Templates", "STL", "CMake", "POSIX Threads"]),
    branch("Rust", ["Ownership", "Borrowing", "Lifetimes", "Traits", "Tokio", "Cargo"]),
    branch("Go", ["Goroutines", "Channels", "Go Modules", "Interfaces", "HTTP Servers"]),
    branch("C# and .NET", ["CLR", "LINQ", "Async Tasks", "ASP.NET", ".NET SDK"]),
    branch("Kotlin", ["Coroutines", "Null Safety", "Kotlin Multiplatform", "Gradle"]),
    branch("Bash and Shells", ["Shell Scripting", "Pipes", "Redirection", "Process Control", "Environment Variables", "Cron"]),
    "Assembly", "Lisp", "R", "MATLAB", "Julia", "Language History"
];
const DATA_STRUCTURES = [
    branch("Linear Structures", ["Arrays", "Dynamic Arrays", "Linked Lists", "Doubly Linked Lists", "Stacks", "Queues", "Deques", "Circular Buffers", "Priority Queues"]),
    branch("Hashing", ["Hash Tables", "Hash Functions", "Collision Resolution", "Bloom Filters", "Count-Min Sketches", "Consistent Hashing"]),
    branch("Trees", ["Binary Trees", "Binary Search Trees", "AVL Trees", "Red-Black Trees", "B-Trees", "B+ Trees", "Heaps", "Tries", "Radix Trees", "Segment Trees", "Fenwick Trees", "Merkle Trees"]),
    branch("Graphs", ["Directed Graphs", "Weighted Graphs", "Adjacency Lists", "Adjacency Matrices", "Disjoint Sets", "Union-Find", "Graph Traversal", "Topological Ordering"]),
    branch("Probabilistic and Spatial Structures", ["Skip Lists", "Suffix Arrays", "Suffix Trees", "K-D Trees", "R-Trees", "Quadtrees", "HyperLogLog", "Locality-Sensitive Hashing"])
];
const ALGORITHMS = [
    branch("Searching and Sorting", ["Linear Search", "Binary Search", "Hash-Based Search", "Bubble Sort", "Insertion Sort", "Merge Sort", "Quick Sort", "Heap Sort", "Counting Sort", "Radix Sort", "External Sorting"]),
    branch("Graph Algorithms", ["Breadth-First Search", "Depth-First Search", "Dijkstra's Algorithm", "Bellman-Ford Algorithm", "A* Search", "Floyd-Warshall Algorithm", "Minimum Spanning Trees", "Kruskal's Algorithm", "Prim's Algorithm", "Max-Flow", "Min-Cut"]),
    branch("Optimization and Dynamic Programming", ["Dynamic Programming", "Memoization", "Greedy Algorithms", "Backtracking", "Branch and Bound", "Linear Programming", "Constraint Solving", "Scheduling Algorithms"]),
    branch("String and Geometry Algorithms", ["String Matching", "Knuth-Morris-Pratt", "Boyer-Moore", "Regular Expressions", "Computational Geometry", "Convex Hulls", "Nearest Neighbor Search"]),
    branch("Theory and Complexity", ["Big O", "Time Complexity", "Space Complexity", "Amortized Analysis", "P versus NP", "NP-Completeness", "Randomized Algorithms", "Approximation Algorithms", "Information Theory"])
];
const ARTIFICIAL_INTELLIGENCE = [
    branch("AI Fundamentals", ["AI History", "Search Algorithms", "Knowledge Representation", "Planning", "Reasoning", "Expert Systems", "Symbolic AI", "Multi-Agent Systems"]),
    branch("Machine Learning", ["Supervised Learning", "Unsupervised Learning", "Semi-Supervised Learning", "Self-Supervised Learning", "Reinforcement Learning", "Classification", "Regression", "Clustering", "Dimensionality Reduction", "Feature Engineering", "Model Evaluation", "Cross-Validation", "Hyperparameter Tuning", "Model Explainability"]),
    branch("Deep Learning", ["Neural Networks", "Backpropagation", "Activation Functions", "Optimization", "Convolutional Neural Networks", "Recurrent Neural Networks", "Long Short-Term Memory", "Transformers", "Attention", "Embeddings", "Autoencoders", "Generative Adversarial Networks", "Diffusion Models"]),
    branch("Generative AI", ["Large Language Models", "Tokens", "Context Windows", "Prompt Engineering", "Structured Outputs", "Function Calling", "Fine-Tuning", "Retrieval-Augmented Generation", "Vector Databases", "Embeddings", "Multimodal AI", "Image Generation", "Video Generation", "Evaluation and Grounding"]),
    branch("Agentic AI", ["AI Agents", "Agent Planning", "Tool Use", "Tool Calling", "Memory for Agents", "Agent Workflows", "Multi-Agent Orchestration", "Human-in-the-Loop Agents", "Agent Evaluation", "Agent Safety", "Google Agent Development Kit (ADK)", "OpenClaw", "Model Context Protocol (MCP)", "MCP Servers", "MCP Tools", "MCP Resources", "MCP Client Design"]),
    branch("Computer Vision", ["Image Classification", "Object Detection", "Image Segmentation", "Pose Estimation", "Optical Flow", "OCR", "Image Embeddings", "OpenCV", "Ultralytics", "YOLO", "Camera Calibration", "Video Tracking"]),
    branch("Natural Language Processing", ["Tokenization", "Language Models", "Sentiment Analysis", "Named-Entity Recognition", "Translation", "Speech Recognition", "Text Embeddings", "Information Extraction", "Question Answering"]),
    branch("Data and ML Libraries", ["PyTorch", "TensorFlow", "scikit-learn", "NumPy", "pandas", "Jupyter Notebook", "Experiment Tracking", "Datasets", "Model Serving", "GPU Computing"]),
    branch("Search, RAG, and Vector Systems", ["RAG", "Retrieval", "Hybrid Search", "Semantic Search", "Vector Search", "Gemini Embeddings", "pgvector", "Chunking", "Reranking", "Citation Grounding", "Knowledge Bases"])
];
const DATABASES = [
    branch("Relational Database Concepts", ["Relational Databases", "Tables", "Rows and Columns", "Primary Keys", "Foreign Keys", "Constraints", "Normalization", "Entity-Relationship Models", "Transactions", "ACID", "Isolation Levels", "Locks", "Deadlocks", "Views", "Triggers"]),
    branch("SQL Databases", ["SQL", "PostgreSQL", "MySQL", "MariaDB", "SQLite", "SQL Server", "Indexes", "B-Tree Indexes", "Full-Text Search", "Query Planning", "EXPLAIN", "Query Optimization", "Connection Pooling"]),
    branch("Database Management", ["Database Design", "Schema Design", "Migrations", "Seed Data", "Backups", "Point-in-Time Recovery", "Replication", "Read Replicas", "Sharding", "Partitioning", "Change Data Capture", "Database Monitoring", "Database Security"]),
    branch("Database Libraries and ORMs", ["SQLAlchemy", "SQLAlchemy Core", "SQLAlchemy ORM", "Prisma", "Prisma Migrations", "Prisma Client", "Object-Relational Mapping", "Query Builders", "Connection Pools"]),
    branch("Non-Relational Databases", ["NoSQL", "Document Databases", "Key-Value Databases", "Wide-Column Databases", "Graph Databases", "Redis", "MongoDB", "DynamoDB", "Neo4j", "Time-Series Databases"]),
    branch("Vector and Analytical Databases", ["Vector Databases", "pgvector", "Similarity Search", "Approximate Nearest Neighbors", "Data Warehouses", "BigQuery", "OLTP", "OLAP", "Columnar Storage"])
];
const WEB_DEVELOPMENT = [
    branch("Frontend Development", ["HTML", "CSS", "JavaScript", "TypeScript", "React", "React Components", "React State", "React Hooks", "Next.js", "Next.js App Router", "Server Components", "Client Components", "Tailwind CSS", "Web Accessibility", "Responsive Interfaces", "Browser Rendering"]),
    branch("Backend Development", ["Node.js", "FastAPI", "Python Web Servers", "REST APIs", "GraphQL", "RPC", "Request Validation", "Middleware", "Background Jobs", "Webhooks", "WebSockets", "Server-Sent Events", "Caching"]),
    branch("Web Platforms", ["Browsers", "DOM", "Fetch API", "HTTP", "HTTPS", "Cookies", "Sessions", "Web Storage", "IndexedDB", "Service Workers", "Progressive Web Apps", "Browser Engines"]),
    branch("Browser Extensions", ["Chrome Extensions API", "Manifest V3", "Extension Service Workers", "Content Scripts", "Popup Pages", "Options Pages", "Chrome Tabs API", "DOM Inspection", "Extension Permissions", "Cross-Origin Requests", "Browser Automation"]),
    branch("Authentication and Web Identity", ["OAuth", "OAuth 2.0", "OpenID Connect", "Sessions", "Cookies", "JSON Web Tokens", "Passkeys", "CSRF", "CORS", "Rate Limiting"])
];
const CLOUD_DEVOPS = [
    branch("CI/CD", ["Continuous Integration", "Continuous Delivery", "Continuous Deployment", "Build Pipelines", "Release Pipelines", "GitHub Actions", "Workflow Files", "Build Artifacts", "Deployment Gates", "Rollback Strategies", "Preview Deployments"]),
    branch("Cloud Platforms", [
        branch("Amazon Web Services (AWS)", ["AWS", "EC2", "S3", "Lambda", "RDS", "DynamoDB", "ECS", "EKS", "CloudFront", "CloudWatch", "IAM", "VPC", "SNS", "SQS"]),
        branch("Microsoft Azure", ["Azure", "Azure App Service", "Azure Functions", "Azure Blob Storage", "Azure SQL", "Cosmos DB", "Azure Kubernetes Service", "Azure Monitor", "Microsoft Entra ID", "Azure DevOps"]),
        branch("Google Cloud Platform (GCP)", ["GCP", "Compute Engine", "Cloud Storage", "Cloud Run", "Google Kubernetes Engine", "BigQuery", "Cloud SQL", "Pub/Sub", "Vertex AI", "Cloud Monitoring", "Google Cloud IAM"]),
        branch("Vercel", ["Vercel Deployments", "Vercel Preview Deployments", "Vercel Serverless Functions", "Vercel Edge Functions", "Vercel Domains", "Vercel Environment Variables"])
    ]),
    branch("Containers and Infrastructure", ["Docker", "Docker Images", "Docker Compose", "Kubernetes", "Pods", "Deployments", "Services", "Ingress", "Helm", "Container Registries", "Virtual Machines", "Serverless Computing", "Infrastructure as Code", "Terraform"]),
    branch("Operations and Observability", ["Observability", "Logging", "Metrics", "Distributed Tracing", "Monitoring", "Alerting", "Health Checks", "SLOs and SLIs", "Incident Response", "Secrets Management", "Configuration Management"])
];
const SYSTEMS = [
    branch("Operating Systems", ["Processes", "Threads", "Scheduling", "Virtual Memory", "Memory Management", "Filesystems", "System Calls", "Kernels", "Drivers", "Permissions", "Linux", "Windows", "macOS", "iOS", "Mobile Operating Systems"]),
    branch("Systems Programming", ["C", "C++", "Rust", "POSIX", "File Descriptors", "Signals", "Sockets", "Memory Mapping", "Shell Processes", "Command-Line Tools"]),
    branch("Computer Architecture", ["CPUs", "Instruction Sets", "Registers", "Cache", "RAM", "Storage", "Buses", "Pipelining", "Branch Prediction", "Multicore CPUs", "GPUs", "ARM", "x86", "RISC", "CISC", "Motherboards"]),
    branch("Distributed Systems", ["Client-Server Architecture", "Service Discovery", "Load Balancing", "Replication", "Consistency", "Availability", "Fault Tolerance", "Scalability", "Rate Limiting", "Message Queues", "Event-Driven Systems", "Microservices", "Monoliths", "CAP Theorem", branch("Scaling and Reliability", ["Scaling", "Horizontal Scaling", "Vertical Scaling", "Auto Scaling", "Elasticity", "Capacity Planning", "Load Testing", "Bottleneck Analysis", "Caching Strategies", "High Availability", "Graceful Degradation", "Circuit Breakers", "Bulkheads", "Disaster Recovery", "Multi-Region Systems", "Service Level Objectives"])]),
    branch("Messaging and Event Systems", ["Message Queues", "Publish-Subscribe", "Event Streams", "Kafka", "RabbitMQ", "Task Queues", "Exactly-Once Processing", "Idempotency", "Retries", "Backpressure"])
];
const SECURITY = [
    branch("Application Security", ["Web Security", "Input Validation", "Output Encoding", "SQL Injection", "Cross-Site Scripting", "CSRF", "SSRF", "Secure Headers", "Dependency Security", "Threat Modeling", "OWASP"]),
    branch("Identity and Access", ["Authentication", "Authorization", "OAuth", "OpenID Connect", "Role-Based Access Control", "Attribute-Based Access Control", "Least Privilege", "Secrets Management", "API Keys"]),
    branch("Cryptography", ["Encryption", "Symmetric Encryption", "Public-Key Cryptography", "Hashing", "Digital Signatures", "TLS", "Key Management", "Randomness"]),
    branch("Infrastructure Security", ["Network Security", "Firewalls", "VPNs", "Cloud Security", "Container Security", "Endpoint Security", "Vulnerability Management", "Security Monitoring", "Incident Response"]),
    branch("Privacy and Safety", ["Privacy by Design", "Data Minimization", "PII", "Anonymization", "Access Logs", "AI Safety", "Model Security", "Prompt Injection", "Data Governance"])
];
const DATA_ENGINEERING = [
    branch("Data Pipelines", ["ETL", "ELT", "Data Ingestion", "Batch Processing", "Stream Processing", "Data Validation", "Data Cleaning", "Data Lineage", "Data Contracts"]),
    branch("Data Science", ["NumPy", "pandas", "DataFrames", "Statistics", "Exploratory Data Analysis", "Feature Engineering", "Data Visualization", "Jupyter Notebook"]),
    branch("Files and Data Formats", ["CSV", "Excel Files", "Google Forms", "JSON", "XML", "Parquet", "Columnar Data", "File Uploads", "Data Serialization"]),
    branch("Analytics Systems", ["Data Warehouses", "BigQuery", "OLAP", "Dashboards", "Reporting", "Experiment Analysis", "Data Quality", "Data Governance"])
];
const MOBILE_DESKTOP = [
    branch("Apple Platforms", ["Swift", "SwiftUI", "macOS Apps", "iOS Apps", "AppKit", "Swift Package Manager", "ScreenCaptureKit", "macOS Accessibility", "Accessibility APIs", "App Sandboxing", "Universal Binaries"]),
    branch("Desktop Automation", ["Browser Automation", "macOS Accessibility", "ScreenCaptureKit", "Keyboard Events", "Mouse Events", "Permission Flows", "Agent-Controlled Workflows"]),
    branch("Document and PDF Software", ["PDF Generation", "fpdf2", "PDF Text Layout", "Document Export", "ReportLab", "Page Breaks", "Fonts and Unicode", "File System Save Dialogs"])
];
const TOOLS_WORKFLOW = [
    branch("Developer Tools", ["VS Code", "Git", "GitHub", "Codex", "GitHub Issues", "GitHub Pull Requests", "Code Search", "Command-Line Interfaces"]),
    branch("Project Workflow", ["Version Control", "Branches", "Commits", "Merges", "Rebases", "Code Review", "Issue Tracking", "Release Management", "Open Source Development"]),
    branch("Build Systems", ["Compilers", "Bundlers", "Package Managers", "npm", "Swift Package Manager", "Make", "CMake", "Build Caching", "Universal Builds"])
];
const OTHER_FIELDS = [
    branch("Compilers and Language Design", ["Lexing", "Parsing", "Abstract Syntax Trees", "Type Checking", "Interpreters", "Compilers", "Bytecode", "Garbage Collection", "Programming Language Design"]),
    branch("Graphics and Games", ["Computer Graphics", "Rendering", "Shaders", "3D Graphics", "Game Development", "Game Engines", "Physics Engines", "Animation"]),
    branch("Human-Computer Interaction", ["User Interfaces", "Interaction Design", "Usability", "Accessibility", "Information Architecture", "User Research"]),
    branch("Embedded and Connected Devices", ["Embedded Systems", "Microcontrollers", "Real-Time Systems", "Internet of Things", "Sensors", "Firmware", "Robotics"]),
    branch("Quantum and Emerging Computing", ["Quantum Computing", "Quantum Algorithms", "Neuromorphic Computing", "Edge Computing", "Spatial Computing", "Emerging Technologies"]),
    branch("Computer History", ["Early Internet History", "Famous Computer Scientists", "Famous Software Bugs", "Operating System History", "Programming Language History", "Computing Oddities"])
];
function buildComputerScienceTopic() {
    return branch("Computer Science", [
        branch("Programming Fundamentals", PROGRAMMING_FUNDAMENTALS),
        branch("Programming Languages", LANGUAGE_DETAILS),
        branch("Data Structures", DATA_STRUCTURES),
        branch("Algorithms", ALGORITHMS),
        branch("Artificial Intelligence", ARTIFICIAL_INTELLIGENCE),
        branch("Networks", ["Internet Fundamentals", "IP Addresses", "IPv4", "IPv6", "TCP", "UDP", "DNS", "HTTP", "HTTPS", "TLS", "Routing", "Switching", "Wi-Fi", "Ethernet", "NAT", "VPNs", "CDNs", "Load Balancers", "Firewalls", "Network Security", "Internet Infrastructure", "Undersea Cables", "WebRTC", "QUIC"]),
        branch("Hardware", ["CPUs", "Instruction Sets", "Registers", "Cache", "RAM", "Storage", "Buses", "Pipelining", "Branch Prediction", "Multicore CPUs", "GPUs", "ARM", "x86", "RISC", "CISC", "Motherboards", "Hardware History"]),
        ...SYSTEMS,
        branch("Databases", DATABASES),
        branch("Web Development", WEB_DEVELOPMENT),
        branch("Security", SECURITY),
        branch("Cloud and DevOps", CLOUD_DEVOPS),
        branch("Software Engineering", ["Git", "Version Control", "Testing", "Unit Testing", "Integration Testing", "Debugging", "Code Review", "Design Patterns", "Software Architecture", "Technical Debt", "Refactoring", "APIs", "Documentation", "Open Source", "Agile Development", "Requirements Engineering"]),
        ...DATA_ENGINEERING,
        ...MOBILE_DESKTOP,
        ...TOOLS_WORKFLOW,
        ...OTHER_FIELDS
    ]);
}
exports.COMPUTER_SCIENCE_RESUME_TOPICS = [
    "Python", "JavaScript", "TypeScript", "SQL", "Swift", "HTML", "CSS", "PyTorch", "TensorFlow", "React", "Next.js", "Node.js", "FastAPI", "OpenCV", "NumPy", "pandas", "scikit-learn", "Tailwind CSS", "SwiftUI", "Google Agent Development Kit (ADK)", "OpenClaw", "RAG", "Gemini Embeddings", "pgvector", "Vector Search", "Gemini API", "Computer Vision", "Prompt Engineering", "VS Code", "Git", "GitHub", "Codex", "Jupyter Notebook", "OAuth", "Vercel", "PostgreSQL", "SQLite", "SQLAlchemy", "Prisma", "Chrome Extensions API", "Manifest V3", "ScreenCaptureKit", "macOS Accessibility", "Ultralytics", "Pose Estimation", "fpdf2"
];

},
"natural-disaster-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURAL_DISASTER_CATALOG_SOURCES = void 0;
exports.buildNaturalDisasterAndExtinctionTopics = buildNaturalDisasterAndExtinctionTopics;
const branch = (label, children, aliases = []) => ({ label, children, aliases });
const EARTHQUAKES = [
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
const VOLCANIC_ERUPTIONS = [
    branch("Explosive Plinian Eruptions", ["79 Vesuvius Eruption", "1815 Mount Tambora Eruption", "1883 Krakatoa Eruption", "1902 Mount Pelée Eruption", "1912 Novarupta Eruption", "1991 Mount Pinatubo Eruption", "2022 Hunga Tonga Eruption", "Other Plinian Eruptions"]),
    branch("Caldera and Supereruptions", ["Toba Eruption", "Lake Taupō Oruanui Eruption", "Campanian Ignimbrite Eruption", "Yellowstone Lava Creek Eruption", "Long Valley Bishop Tuff Eruption", "Aira Caldera Eruption", "Santorini Minoan Eruption", "Other Caldera Eruptions"]),
    branch("Lava, Ash, and Fissure Eruptions", ["1783 Laki Eruption", "1783–1784 Lakagígar Famine", "1961 Mount Agung Eruption", "2010 Eyjafjallajökull Eruption", "2018 Kīlauea Eruption", "2021 Cumbre Vieja Eruption", "2022 Mauna Loa Eruption", "Other Lava and Ash Eruptions"]),
    branch("Pyroclastic Flows and Lahars", ["1902 Mount Pelée Pyroclastic Flow", "1919 Kelud Lahars", "1929 Santiaguito Eruption", "1985 Nevado del Ruiz Lahar", "1991 Mount Pinatubo Lahars", "2010 Merapi Eruption", "2014 Mount Ontake Eruption", "Other Pyroclastic-Flow Disasters"]),
    branch("Volcanic Eruptions and Famine", ["1815 Tambora and the Year Without a Summer", "1783 Laki and the Haze Famine", "1600 Huaynaputina Eruption and Famine", "1257 Samalas Eruption and Climate Shock", "939 Eldgjá Eruption and Famine", "536 Volcanic Climate Shock", "1452 Kuwae Eruption", "Other Eruption-Driven Famines"]),
    "Other Major Volcanic Eruptions"
];
const TSUNAMIS = [
    branch("Earthquake-Generated Tsunamis", ["1755 Lisbon Tsunami", "1896 Sanriku Tsunami", "1946 Aleutian Tsunami", "1960 Chilean Tsunami", "1964 Alaska Tsunami", "2004 Indian Ocean Tsunami", "2011 Tōhoku Tsunami", "2018 Sulawesi Tsunami", "2022 Hunga Tonga Tsunami"]),
    branch("Volcanic Tsunamis", ["1883 Krakatoa Tsunami", "1792 Unzen Tsunami", "1638 Komagatake Tsunami", "1888 Ritter Island Tsunami", "2022 Hunga Tonga Tsunami", "Other Volcanic Tsunamis"]),
    branch("Landslide-Generated Tsunamis", ["1929 Grand Banks Tsunami", "1998 Papua New Guinea Tsunami", "2017 Greenland Karrat Fjord Tsunami", "2018 Anak Krakatau Tsunami", "1958 Lituya Bay Megatsunami", "Other Landslide Tsunamis"]),
    branch("Tsunami Effects and Famine", ["Indian Ocean Coastal Famine After 2004", "Tōhoku Nuclear and Food-System Disruption", "Lisbon Earthquake, Fire, and Tsunami", "Sanriku Coastal Famine and Displacement", "Other Tsunami Humanitarian Crises"]),
    "Other Major Tsunamis"
];
const FLOODS = [
    branch("River Floods", ["1931 China Floods", "1887 Yellow River Flood", "1938 Yellow River Flood", "1998 Yangtze River Floods", "2010 Pakistan Floods", "2022 Pakistan Floods", "2022 Henan Floods", "2023 Libya Floods", "Other Major River Floods"]),
    branch("Coastal Floods and Storm Surges", ["1953 North Sea Flood", "1970 Bhola Cyclone Storm Surge", "1991 Bangladesh Cyclone Storm Surge", "2005 Hurricane Katrina Storm Surge", "2008 Cyclone Nargis Storm Surge", "2013 Typhoon Haiyan Storm Surge", "2020 Cyclone Amphan Storm Surge", "Other Coastal Flood Disasters"]),
    branch("Flash Floods and Urban Floods", ["1976 Big Thompson Canyon Flood", "1998 Vargas Flash Floods", "2003 Bam Floods", "2010 Leh Cloudburst", "2013 Uttarakhand Floods", "2018 Kerala Floods", "2021 Western Europe Floods", "2022 Durban Floods", "Other Flash Floods"]),
    branch("Glacial Lake Outburst and Ice-Dam Floods", ["1941 Huaraz Glacial Lake Flood", "1985 Dig Tsho Glacial Lake Flood", "2013 Kedarnath Floods", "2016 Gongbatongsha Glacial Flood", "2021 Chamoli Flood", "Other Glacial Lake Floods"]),
    branch("Floods, Crop Failure, and Famine", ["1931 China Floods and Famine", "1876–1878 Global Drought and Famine", "1887 Yellow River Flood and Famine", "1938 Yellow River Flood and Displacement", "1959–1961 China Food Crisis", "2022 Pakistan Floods and Food Insecurity", "Other Flood-Driven Famines"]),
    "Other Major Floods"
];
const TROPICAL_CYCLONES = [
    branch("Bay of Bengal Cyclones", ["1737 Calcutta Cyclone", "1876 Bengal Cyclone", "1881 Haiphong Typhoon", "1942 Bengal Cyclone", "1970 Bhola Cyclone", "1991 Bangladesh Cyclone", "2007 Cyclone Sidr", "2008 Cyclone Nargis", "2020 Cyclone Amphan", "Other Bay of Bengal Cyclones"]),
    branch("Western Pacific Typhoons", ["1881 Haiphong Typhoon", "1912 Hong Kong Typhoon", "1959 Miyakojima Typhoon", "1970 Typhoon Sening", "1991 Thelma Tropical Storm", "2013 Typhoon Haiyan", "2018 Typhoon Mangkhut", "Other Western Pacific Typhoons"]),
    branch("Atlantic Hurricanes", ["1780 Great Hurricane", "1900 Galveston Hurricane", "1928 Okeechobee Hurricane", "1935 Labor Day Hurricane", "1969 Hurricane Camille", "1998 Hurricane Mitch", "2005 Hurricane Katrina", "2017 Hurricane Maria", "2022 Hurricane Ian", "Other Atlantic Hurricanes"]),
    branch("Indian Ocean and Southern Hemisphere Cyclones", ["1892 Mauritius Cyclone", "1960 Cyclone of 1960", "1974 Cyclone Tracy", "1999 Odisha Cyclone", "2006 Cyclone Monica", "2016 Cyclone Winston", "2019 Cyclone Idai", "2023 Cyclone Freddy", "Other Southern Hemisphere Cyclones"]),
    branch("Storm Surges and Cyclone Famine", ["1970 Bhola Cyclone and Coastal Famine", "1991 Bangladesh Cyclone and Food Crisis", "2008 Nargis and Myanmar Food Crisis", "2013 Haiyan and Philippine Food Disruption", "2019 Idai and Mozambique Food Insecurity", "Other Cyclone-Driven Famines"]),
    "Other Major Tropical Cyclones"
];
const DROUGHTS_AND_FAMINES = [
    branch("Multiyear Droughts", ["4.2-Kiloyear Event", "Late Antique Little Ice Age Droughts", "Medieval Megadroughts", "Ming Dynasty Droughts", "1876–1878 Great Drought", "1930s Dust Bowl Drought", "1950s Great Plains Drought", "2011–2016 California Drought", "Other Multiyear Droughts"]),
    branch("Monsoon Failure and South Asian Famines", ["Great Bengal Famine of 1770", "Agra Famine of 1837–1838", "Upper Doab Famine of 1860–1861", "Indian Famine of 1876–1878", "Indian Famine of 1896–1897", "Indian Famine of 1899–1900", "Bengal Famine of 1943", "1972 Maharashtra Drought", "Other South Asian Famines"]),
    branch("Chinese Famines and Food-System Collapse", ["1630s Ming Famine", "1876–1879 Northern Chinese Famine", "1928–1930 Chinese Famine", "1936 Sichuan Famine", "1959–1961 Great Chinese Famine", "1970s Sahel-Linked Food Crisis", "Other Chinese Famines"]),
    branch("European and Eurasian Famines", ["Great Famine of 1315–1317", "Russian Famine of 1601–1603", "Great Famine of Ireland", "Russian Famine of 1891–1892", "Persian Famine of 1917–1919", "Soviet Famine of 1932–1933", "Dutch Famine of 1944–1945", "North Korean Famine", "Other European and Eurasian Famines"]),
    branch("African Famines and Sahel Droughts", ["Ethiopian Famine of 1888–1892", "Sahel Drought of 1910–1915", "Ethiopian Famine of 1973–1974", "Sahel Drought of 1968–1974", "Ethiopian Famine of 1983–1985", "Sudan Famine of 1984–1985", "Somalia Famine of 2011", "Horn of Africa Drought of 2020–2023", "Other African Famines"]),
    branch("Middle Eastern and American Drought Crises", ["Persian Famine of 1917–1919", "Levant Famine of World War I", "Dust Bowl", "1930s Canadian Prairies Drought", "1950s Texas Drought", "2010 Russian Drought and Heatwave", "Other Drought Crises"]),
    branch("Desertification and Land Degradation", ["Dust Bowl Soil Erosion", "Sahel Desertification", "Aral Sea Shrinkage", "Great Chinese Dust Storms", "Mongolian Zud and Rangeland Loss", "Soviet Virgin Lands Erosion", "Other Desertification Crises"]),
    "Other Major Droughts and Famines"
];
const WILDFIRES = [
    branch("Forest and Crown Fires", ["1871 Peshtigo Fire", "1894 Great Hinckley Fire", "1910 Great Fire", "1939 Black Friday Bushfires", "1952 Escuminac Fire", "1988 Yellowstone Fires", "2009 Black Saturday Bushfires", "2019–2020 Australian Bushfires", "Other Forest Fire Disasters"]),
    branch("Grassland and Peat Fires", ["1871 Great Michigan Fires", "1930s Dust Bowl Fires", "1950s Great Plains Fires", "1997 Indonesian Peat Fires", "2015 Indonesian Fires", "2023 Canadian Wildfires", "Other Grassland and Peat Fires"]),
    branch("Urban and Firestorm Disasters", ["1906 San Francisco Fire", "1945 Tokyo Firebombing Firestorm", "1943 Hamburg Firestorm", "1945 Dresden Firestorm", "1988 Yellowstone Firestorm", "2018 Camp Fire", "2023 Maui Wildfires", "Other Urban Wildfires"]),
    branch("Wildfire Smoke and Famine", ["1815 Tambora Ash and Crop Failure", "1910 Great Fire Smoke Crisis", "1997 Southeast Asian Haze and Food Disruption", "2019–2020 Australian Fire Season and Agriculture", "2023 Canadian Smoke Season", "Other Smoke and Food-System Crises"]),
    "Other Major Wildfires"
];
const LANDSLIDES_AND_AVALANCHES = [
    branch("Earthquake-Induced Landslides", ["1920 Haiyuan Landslides", "1970 Ancash Earthquake Avalanche", "2005 Kashmir Landslides", "2008 Sichuan Landslides", "2015 Nepal Landslides", "2023 Turkey–Syria Landslides", "Other Earthquake Landslides"]),
    branch("Mudflows and Debris Flows", ["1985 Armero Tragedy", "1999 Vargas Tragedy", "2010 Zhouqu Mudslide", "2014 Oso Mudslide", "2017 Freetown Mudslide", "2021 Atami Mudslide", "2023 Derna Debris Flow", "Other Mudflows"]),
    branch("Rockfalls and Mountain Collapses", ["1963 Vajont Landslide", "1980 Mount St. Helens Debris Avalanche", "2008 Frank Slide-Style Mountain Failures", "2014 Mount Ontake Debris Flows", "2017 Xinmo Landslide", "2021 Chamoli Rock and Ice Avalanche", "Other Mountain Collapses"]),
    branch("Snow and Ice Avalanches", ["1916 White Friday Avalanches", "1954 Blons Avalanche", "1970 Huascarán Avalanche", "1999 Galtür Avalanche", "2010 Afghanistan Avalanches", "2015 Panjshir Avalanches", "Other Deadly Avalanches"]),
    "Other Landslides and Avalanches"
];
const EXTREME_WEATHER = [
    branch("Extreme Heat", ["1540 European Drought and Heat", "1936 North American Heat Wave", "1995 Chicago Heat Wave", "2003 European Heat Wave", "2010 Russian Heat Wave", "2015 Indian Heat Wave", "2021 Pacific Northwest Heat Dome", "2022 European Heat Waves", "2023 Global Heat Extremes", "Other Deadly Heat Waves"]),
    branch("Extreme Cold and Blizzards", ["1888 Great Blizzard", "1899 Great Blizzard", "1921 Iran Blizzard", "1941–1942 Soviet Winter", "1972 Iran Blizzard", "1985 North American Cold Wave", "2010 East Asian Cold Wave", "2021 Texas Cold Wave", "Other Deadly Cold Waves"]),
    branch("Hail, Lightning, and Downbursts", ["1972 Moradabad Hailstorm", "1986 Bangladesh Hailstorm", "1999 Sydney Hailstorm", "2011 India Lightning Disaster", "2017 Bangladesh Lightning Disaster", "2020 Bihar Lightning Disaster", "Other Severe Convective Storms"]),
    branch("Weather-Driven Crop Failures", ["1816 Year Without a Summer", "1876–1878 Global Famine", "1930s Dust Bowl", "1943 Bengal Famine Weather Shock", "1959–1961 China Food Crisis", "2010 Russian Heatwave and Grain Crisis", "Other Weather Crop Failures"]),
    "Other Extreme Weather Events"
];
const TORNADOES_AND_STORMS = [
    branch("Tornado Outbreaks", ["1925 Tri-State Tornado", "1936 Tupelo–Gainesville Tornado Outbreak", "1974 Super Outbreak", "1989 Daulatpur–Saturia Tornado", "1999 Oklahoma Tornado Outbreak", "2011 Super Outbreak", "2011 Joplin Tornado", "2013 Moore Tornado", "Other Deadly Tornadoes"]),
    branch("Severe Thunderstorm Outbreaks", ["1927 Great Mississippi Flood Storms", "1974 Super Outbreak", "1980 United States Derecho", "2009 Southern India Storms", "2010 China Severe Storms", "2019 Southern Plains Storms", "Other Severe Thunderstorm Outbreaks"]),
    branch("Winter Storms and Ice Storms", ["1998 North American Ice Storm", "2008 Afghanistan Winter Storm", "2010 European Winter Storms", "2014 North American Polar Vortex", "2021 Texas Winter Storm", "Other Winter Storm Disasters"]),
    "Other Major Tornadoes and Storms"
];
const SPACE_WEATHER = [
    branch("Geomagnetic Storms", ["1859 Carrington Event", "1872 Chapman–Silverman Storm", "1921 New York Railroad Storm", "1989 Quebec Geomagnetic Storm", "2003 Halloween Solar Storms", "2012 Near-Miss Solar Storm", "2024 Mother's Day Geomagnetic Storm", "Other Geomagnetic Storms"]),
    branch("Solar Flares and Radiation Storms", ["1859 Carrington Solar Flare", "1972 Solar Proton Event", "1989 Solar Storm", "2003 Halloween Solar Flares", "2017 Solar Storm", "Other Solar Radiation Events"]),
    "Other Space-Weather Events"
];
const NATURAL_DISASTER_TOPIC = branch("Natural Disasters", [
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
const POPULATION_COLLAPSE_TOPIC = branch("Population Collapse and Decline", [
    branch("Disease and Epidemic Declines", ["Plague of Athens", "Antonine Plague", "Plague of Cyprian", "Plague of Justinian", "Black Death", "Cocoliztli Epidemics", "Smallpox in the Americas", "Columbian Exchange Population Collapse", "1918 Influenza Pandemic", "HIV/AIDS Population Impact", "COVID-19 Population Impact", "Other Disease-Driven Declines"]),
    branch("Famine and Food-System Collapse", ["Great Famine of 1315–1317", "Great Bengal Famine of 1770", "Great Famine of Ireland", "Indian Famine of 1876–1878", "Persian Famine of 1917–1919", "Soviet Famine of 1932–1933", "Bengal Famine of 1943", "Great Chinese Famine of 1959–1961", "North Korean Famine", "Ethiopian Famine of 1983–1985", "Somalia Famine of 2011", "Other Famine-Driven Declines"]),
    branch("War and Political Catastrophe", ["An Lushan Rebellion Population Losses", "Mongol Conquests Population Losses", "Thirty Years' War Population Losses", "Taiping Rebellion Population Losses", "World War I and Influenza Population Shock", "World War II Population Losses", "Partition of India Population Displacement", "Cambodian Genocide", "Rwandan Genocide", "Other War-Driven Declines"]),
    branch("Climate and Environmental Shocks", ["4.2-Kiloyear Event", "Late Antique Little Ice Age", "Medieval Megadroughts", "Maya Droughts and Classic Collapse", "Cahokia Population Decline", "Greenland Norse Decline", "Ancestral Puebloan Population Changes", "Aral Sea Environmental Collapse", "Dust Bowl Migration", "Other Environmental Declines"]),
    branch("Ancient and Medieval Regional Collapses", ["Akkadian Empire Collapse", "Indus Valley Urban Decline", "Minoan Palatial Collapse", "Tiwanaku Decline", "Classic Maya Collapse", "Angkor Population Decline", "Cahokia Decline", "Norse Greenland Abandonment", "Rapa Nui Population Crisis", "Other Regional Collapses"]),
    branch("Modern Population Decline", ["Japan's Population Decline", "Italy's Population Decline", "Bulgaria's Population Decline", "Latvia's Population Decline", "Eastern Europe Population Decline", "China's Population Decline", "South Korea's Low Birth Rate", "Rural Depopulation", "Aging Populations", "Migration and Population Loss", "Other Modern Declines"]),
    branch("Human Population Bottlenecks", ["Late Pleistocene Human Bottlenecks", "Toba Bottleneck Hypothesis", "Y-Chromosome Bottleneck Hypothesis", "Founder Effects in Human Populations", "Small-Population Genetic Drift", "Other Bottleneck Hypotheses"]),
    "Other Population Collapses and Declines"
]);
const DINOSAURS_TRIASSIC = ["Eoraptor", "Herrerasaurus", "Coelophysis", "Plateosaurus", "Riojasaurus", "Saturnalia", "Mussaurus", "Thecodontosaurus", "Liliensternus", "Guaibasaurus", "Chindesaurus", "Staurikosaurus", "Panphagia", "Buriolestes", "Gnathovorax", "Nyasasaurus", "Tawa", "Zupaysaurus", "Coloradisaurus", "Pisanosaurus"];
const DINOSAURS_JURASSIC = ["Dilophosaurus", "Scelidosaurus", "Massospondylus", "Vulcanodon", "Megalosaurus", "Allosaurus", "Ceratosaurus", "Stegosaurus", "Brachiosaurus", "Diplodocus", "Apatosaurus", "Camarasaurus", "Compsognathus", "Archaeopteryx", "Ornitholestes", "Mamenchisaurus", "Supersaurus", "Torvosaurus", "Metriacanthosaurus", "Eustreptospondylus"];
const DINOSAURS_CRETACEOUS = ["Tyrannosaurus", "Triceratops", "Velociraptor", "Deinonychus", "Spinosaurus", "Giganotosaurus", "Ankylosaurus", "Parasaurolophus", "Hadrosaurus", "Iguanodon", "Utahraptor", "Carnotaurus", "Argentinosaurus", "Patagotitan", "Baryonyx", "Suchomimus", "Therizinosaurus", "Oviraptor", "Protoceratops", "Microraptor"];
const EXTINCT_MAMMALS = [
    branch("Proboscideans", ["Woolly Mammoth", "Columbian Mammoth", "Steppe Mammoth", "Palaeoloxodon", "Straight-Tusked Elephant", "American Mastodon", "Gomphotherium", "Deinotherium", "Cuvieronius", "Dwarf Elephants", "Other Extinct Proboscideans"]),
    branch("Ground Sloths", ["Megatherium", "Mylodon", "Eremotherium", "Nothrotheriops", "Megalonyx", "Other Ground Sloths"]),
    branch("Saber-Toothed Mammals", ["Smilodon", "Homotherium", "Megantereon", "Thylacosmilus", "Barbourofelis", "Other Saber-Toothed Mammals"]),
    branch("Marsupials and Australian Megafauna", ["Thylacine", "Diprotodon", "Procoptodon", "Thylacoleo", "Palorchestes", "Giant Short-Faced Kangaroo", "Genyornis", "Tasmanian Emu", "Other Australian Megafauna"]),
    branch("Hoofed Mammals", ["Irish Elk", "Quagga", "Aurochs", "Bluebuck", "Western Black Rhinoceros", "Woolly Rhinoceros", "Elasmotherium", "Sivatherium", "Tarpan", "Other Extinct Hoofed Mammals"]),
    branch("Extinct Carnivores", ["Cave Lion", "Cave Bear", "Falkland Islands Wolf", "Japanese Wolf", "Caribbean Monk Seal", "Arctodus", "American Cheetah", "Other Extinct Carnivores"]),
    branch("Extinct Primates and Rodents", ["Jamaican Monkey", "Caribbean Sloth", "Giant Beaver", "Josephoartigasia", "Hispaniolan Hutia", "Lesser Antillean Macaw", "Other Extinct Primates and Rodents"]),
    "Other Extinct Mammals"
];
const EXTINCT_BIRDS = [
    branch("Island Birds", ["Dodo", "Rodrigues Solitaire", "Great Auk", "Moa", "Haast's Eagle", "Elephant Birds", "Hawaiian Crow", "Labrador Duck", "Chatham Rail", "Stephens Island Wren", "Other Extinct Island Birds"]),
    branch("Pigeons, Parrots, and Songbirds", ["Passenger Pigeon", "Carolina Parakeet", "Cuban Macaw", "Paradise Parrot", "Poʻouli", "Bachman's Warbler", "Hawaiian Mamo", "Seychelles Parakeet", "Other Extinct Birds"]),
    branch("Extinct Waterbirds and Seabirds", ["Finsch's Duck", "New Zealand Swan", "Jamaican Petrel", "Dusky Seaside Sparrow", "Alaotra Grebe", "Milford Sound Penguin", "Other Extinct Waterbirds"]),
    "Other Extinct Birds"
];
const EXTINCT_REPTILES_AMPHIBIANS = [
    branch("Giant Tortoises and Turtles", ["Pinta Giant Tortoise", "Rodrigues Giant Tortoise", "Réunion Giant Tortoise", "Mauritius Giant Tortoise", "Cylindraspis Tortoises", "Giant Galápagos Tortoise Lineages", "Other Extinct Tortoises"]),
    branch("Extinct Lizards and Snakes", ["Jamaican Giant Galliwasp", "Rodrigues Giant Skink", "Cape Verde Giant Skink", "Waiheke Island Skink", "Other Extinct Reptiles"]),
    branch("Extinct Amphibians", ["Golden Toad", "Gastric-Brooding Frog", "Southern Gastric-Brooding Frog", "Lake Titicaca Water Frog Lineages", "Holdridge's Toad", "Other Extinct Amphibians"]),
    "Other Extinct Reptiles and Amphibians"
];
const EXTINCT_FISH_AQUATIC = [
    branch("Extinct Freshwater Fish", ["Chinese Paddlefish", "Baiji", "Tecopa Pupfish", "Blue Walleye", "New Zealand Grayling", "Thicktail Chub", "Blackfin Cisco", "Other Extinct Freshwater Fish"]),
    branch("Prehistoric Fish", ["Dunkleosteus", "Megalodon", "Helicoprion", "Xiphactinus", "Bothriolepis", "Titanichthys", "Other Prehistoric Fish"]),
    branch("Marine Reptiles", ["Ichthyosaurs", "Plesiosaurs", "Pliosaurs", "Mosasaurs", "Thalattosaurs", "Placodonts", "Other Extinct Marine Reptiles"]),
    branch("Extinct Marine Mammals", ["Steller's Sea Cow", "Caribbean Monk Seal", "Japanese Sea Lion", "Other Extinct Marine Mammals"]),
    "Other Extinct Aquatic Animals"
];
const EXTINCT_INVERTEBRATES = [
    branch("Trilobites", ["Olenellus", "Paradoxides", "Asaphus", "Isotelus", "Calymene", "Other Trilobite Groups"]),
    branch("Ammonites and Belemnites", ["Ammonites", "Goniatites", "Baculites", "Scaphites", "Belemnites", "Other Extinct Cephalopods"]),
    branch("Eurypterids and Sea Scorpions", ["Jaekelopterus", "Pterygotus", "Eurypterus", "Megalograptus", "Other Eurypterids"]),
    branch("Other Extinct Invertebrates", ["Graptolites", "Rugose Corals", "Tabulate Corals", "Archaeocyathids", "Anomalocaris", "Opabinia", "Hallucigenia"])
];
const RECENT_EXTINCTIONS = [
    branch("Declared Extinct or Extinct in the Wild Since 2006", ["Bramble Cay Melomys", "Christmas Island Pipistrelle", "Alaotra Grebe", "Pinta Giant Tortoise", "Chinese Paddlefish", "Other Recent Declared Extinctions"]),
    branch("Functionally Extinct, Presumed Extinct, or Extinct in the Wild", ["Baiji", "Poʻouli", "Bachman's Warbler", "Ivory-Billed Woodpecker", "Northern White Rhinoceros", "Yangtze Giant Softshell Turtle", "Spix's Macaw in the Wild", "Other Presumed or Functional Extinctions"]),
    branch("Recent Local and Island Extinctions", ["Christmas Island Skink", "Christmas Island Shrew", "Western Black Rhinoceros", "Pinta Giant Tortoise", "Hawaiian Crow in the Wild", "Other Recent Local Extinctions"]),
    "Other Recent Extinctions"
];
const SPECIFIC_EXTINCTION_EVENTS = [
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
const EXTINCTION_CAUSES = [
    branch("Habitat Loss", ["Deforestation Extinctions", "Wetland Drainage Extinctions", "Island Habitat Loss", "Grassland Conversion", "Coral Reef Loss", "Other Habitat-Driven Extinctions"]),
    branch("Overhunting and Overfishing", ["Passenger Pigeon Hunting", "Great Auk Hunting", "Steller's Sea Cow Hunting", "Moa Hunting", "Megalodon Prey Collapse", "Other Overexploitation Extinctions"]),
    branch("Invasive Species", ["Island Bird Extinctions", "New Zealand Bird Losses", "Guam Bird Extinctions", "Snake-Driven Island Losses", "Introduced Mammal Impacts", "Other Invasive-Species Extinctions"]),
    branch("Disease and Pathogens", ["Amphibian Chytrid Extinctions", "Avian Malaria", "Tasmanian Devil Disease Risk", "Island Bird Disease", "Other Disease-Driven Extinctions"]),
    branch("Climate Change", ["Pleistocene Climate Change", "Coral Bleaching and Loss", "Sea-Level Change Extinctions", "Warming-Driven Range Loss", "Other Climate-Driven Extinctions"]),
    branch("Pollution and Environmental Change", ["Pesticide-Driven Declines", "Plastic and Marine Pollution", "Acid Rain Extinctions", "Toxic Mine Waste", "Other Pollution-Driven Extinctions"]),
    branch("Population Bottlenecks and Coextinction", ["Genetic Bottlenecks", "Inbreeding Depression", "Host-Dependent Extinctions", "Pollinator Loss", "Food-Web Collapse", "Other Ecological Extinctions"])
];
const EXTINCT_LIFE_TOPIC = branch("Extinction Events and Extinct Life", [
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
function buildNaturalDisasterAndExtinctionTopics() {
    return [NATURAL_DISASTER_TOPIC, POPULATION_COLLAPSE_TOPIC, EXTINCT_LIFE_TOPIC];
}
exports.NATURAL_DISASTER_CATALOG_SOURCES = [
    "https://www.usgs.gov/mission-areas/natural-hazards",
    "https://www.usgs.gov/science/science-explorer/natural-hazards/studying-and-responding-to-disasters",
    "https://www.nps.gov/subjects/fossils/mass-extinctions-through-geologic-time.htm",
    "https://www.nhm.ac.uk/discover/when-did-dinosaurs-live.html",
    "https://repository.library.noaa.gov/view/noaa/48315"
];

},
"war-history-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAR_HISTORY_SOURCES = void 0;
exports.buildWarHistoryTopic = buildWarHistoryTopic;
const branch = (label, children) => ({ label, children });
const aliasBranch = (label, aliases, children) => ({ label, aliases, children });
const grouped = (label, sections) => branch(label, sections.map(([name, children]) => branch(name, children)));
const study = [
    "Origins and Causes",
    "Participants and Alliances",
    "Major Battles and Campaigns",
    "Civilian Life and Home Fronts",
    "Treaties and Outcomes",
    "Memory and Legacy"
];
const conflict = (label, extra = []) => branch(label, [...study, ...extra]);
const battleGroup = (label, battles) => branch(label, battles);
const ancientMediterranean = grouped("Ancient Mediterranean", [
    ["Greek and Persian Wars", [
            "Ionian Revolt", "Battle of Marathon", "Battle of Thermopylae", "Battle of Artemisium", "Battle of Salamis", "Battle of Plataea",
            "Battle of Mycale", "First Persian Invasion of Greece", "Second Persian Invasion of Greece", "Delian League Wars"
        ]],
    ["Greek Civil and Inter-Polis Wars", [
            "Peloponnesian War", "First Peloponnesian War", "Archidamian War", "Sicilian Expedition", "Decelean War", "Corinthian War",
            "Boeotian War", "Theban–Spartan War", "Sacred War", "Third Sacred War", "Lamian War", "Social War"
        ]],
    ["Macedonian and Hellenistic Wars", [
            "Macedonian Wars", "First Macedonian War", "Second Macedonian War", "Third Macedonian War", "Fourth Macedonian War",
            "Wars of the Diadochi", "Lamian War", "Chremonidean War", "Syrian Wars", "Macedonian–Spartan Wars"
        ]],
    ["Roman Conquests and Civil Wars", [
            "Roman–Samnite Wars", "Latin War", "Pyrrhic War", "Punic Wars", "First Punic War", "Second Punic War", "Third Punic War",
            "Macedonian Wars", "Roman–Seleucid War", "Gallic Wars", "Cantabrian Wars", "Roman Civil Wars", "Caesar's Civil War",
            "Liberators' Civil War", "Sicilian Revolt", "Perusine War", "Final War of the Roman Republic", "Year of the Four Emperors",
            "Year of the Five Emperors", "Crisis of the Third Century", "Jewish–Roman Wars", "Great Jewish Revolt", "Bar Kokhba Revolt",
            "Boudican Revolt", "Dacian Wars", "Marcomannic Wars", "Roman–Persian Wars"
        ]]
]);
const warsOfTheRoses = aliasBranch("Wars of the Roses", ["War of the Roses"], [
    "Lancastrian and Yorkist Factions", "First Battle of St Albans", "Battle of Blore Heath", "Battle of Ludford Bridge",
    "Battle of Northampton", "Battle of Wakefield", "Battle of Mortimer's Cross", "Second Battle of St Albans", "Battle of Towton",
    "Battle of Hedgeley Moor", "Battle of Hexham", "Battle of Edgecote Moor", "Battle of Losecoat Field", "Battle of Barnet",
    "Battle of Tewkesbury", "Battle of Bosworth Field", "Battle of Stoke Field", "The Princes in the Tower", "Richard III and the Yorkists",
    "Henry VII and the Tudor Settlement"
]);
const britishIsles = branch("British Isles and Ireland", [
    grouped("Early and Medieval Britain", [
        ["Roman and Post-Roman Conflicts", ["Roman Invasion of Britain", "Boudican Revolt", "Roman Conquest of Wales", "Pictish Wars", "Saxon Wars in Britain"]],
        ["Anglo-Saxon and Viking Wars", ["Bernician–Deiran Wars", "Mercian Wars", "Viking Invasions of England", "Great Heathen Army", "Viking Invasions of Ireland", "Alfred the Great's Wars", "Danelaw Wars", "Battle of Brunanburh"]],
        ["Norman and Angevin Wars", ["Norman Conquest", "Harrying of the North", "Anarchy", "Welsh Wars of Edward I", "Scottish Wars of Independence", "First War of Scottish Independence", "Second War of Scottish Independence", "Anglo-French Wars"]]
    ]),
    warsOfTheRoses,
    branch("British Civil and Constitutional Wars", [
        conflict("Bishops' Wars"),
        conflict("British Civil Wars", [battleGroup("Key Engagements", ["Battle of Edgehill", "Battle of Marston Moor", "Battle of Naseby", "Battle of Preston", "Battle of Dunbar", "Battle of Worcester"])]),
        "First English Civil War", "Second English Civil War", "Third English Civil War", "Irish Confederate Wars", "Scottish Civil War",
        "Wars of the Three Kingdoms", "Glorious Revolution", "Jacobite Rising of 1689", "Jacobite Rising of 1715", "Jacobite Rising of 1745",
        "Irish Rebellion of 1798", "Irish War of Independence", "Irish Civil War", "The Troubles", "Easter Rising"
    ]),
    branch("Anglo-French and European Wars", [
        "Hundred Years' War", "Edwardian War", "Caroline War", "Lancastrian War", "Armagnac–Burgundian Civil War", "Nine Years' War",
        "War of the Spanish Succession", "War of the Austrian Succession", "Seven Years' War", "Napoleonic Wars", "Crimean War",
        "First World War", "Second World War", "Falklands War", "Northern Ireland conflict"
    ]),
    branch("Colonial and Overseas Wars", [
        "King Philip's War", "Queen Anne's War", "King George's War", "French and Indian War", "American Revolutionary War",
        "Anglo-Zulu War", "First Boer War", "Second Boer War", "Mau Mau Uprising", "Malayan Emergency", "Suez Crisis", "Falklands War"
    ])
]);
const frenchWars = branch("French Wars", [
    branch("French Wars and External Campaigns", [
        "Frankish Wars", "Merovingian Civil Wars", "Carolingian Civil Wars", "Albigensian Crusade", "Hundred Years' War", "Italian Wars",
        "French Wars in Italy", "War of the League of Cambrai", "French–Habsburg Wars", "Thirty Years' War", "War of Devolution",
        "Franco-Dutch War", "War of the Reunions", "Nine Years' War", "War of the Spanish Succession", "War of the Austrian Succession",
        "Seven Years' War", "French Revolutionary Wars", "Napoleonic Wars", "Peninsular War", "French Intervention in Spain",
        "Franco-Prussian War", "First Indochina War", "Algerian War", "Suez Crisis", "French Resistance", "French Wars in Africa"
    ]),
    branch("French Civil Wars", [
        branch("French Wars of Religion", [
            "First French War of Religion", "Second French War of Religion", "Third French War of Religion", "Fourth French War of Religion",
            "Fifth French War of Religion", "Sixth French War of Religion", "Seventh French War of Religion", "Eighth French War of Religion",
            "Huguenot Rebellions", "St. Bartholomew's Day Massacre", "Battle of Dreux", "Battle of Jarnac", "Battle of Moncontour",
            "Siege of La Rochelle", "War of the Three Henrys", "Edict of Nantes and Its Wars"
        ]),
        conflict("Fronde", [battleGroup("Fronde Episodes", ["Parliamentary Fronde", "Princes' Fronde", "Siege of Paris", "Battle of Rethel"])]),
        branch("French Revolution Civil Conflicts", [
            "Revolt of Lyon Against the National Convention", "War in the Vendée", "Chouannerie", "Federalist Revolts", "Siege of Toulon",
            "White Terror", "Revolt of the Girondins", "French Revolutionary Civil War"
        ]),
        conflict("Paris Commune", ["Bloody Week", "Communards and Versailles", "Paris Commune Memory"]),
        "Resistance and Collaboration in France", "Corsican Conflict", "New Caledonian Revolt", "French Colonial Rebellions"
    ]),
    branch("Wars in French Colonial Territories", [
        "Haitian Revolution", "Saint-Domingue Expedition", "First Madagascar Expedition", "Second Madagascar Expedition", "Moroccan Crises",
        "Cameroon Campaign", "French West Africa Campaigns", "Syrian Revolt", "Franco-Siamese War", "French–Vietnamese Wars"
    ])
]);
const europe = branch("Europe", [
    ancientMediterranean,
    britishIsles,
    frenchWars,
    branch("Iberian Peninsula", [
        "Umayyad Conquest of Hispania", "Reconquista", "Portuguese Reconquista", "Castilian Civil War", "War of the Castilian Succession",
        "Granada War", "War of the Portuguese Succession", "Portuguese Restoration War", "War of the Spanish Succession", "Peninsular War",
        "Carlist Wars", "First Carlist War", "Second Carlist War", "Third Carlist War", "Spanish Civil War", "Asturian Miners' Strike",
        "Portuguese Colonial War", "Spanish–American War", "Ifni War", "Western Sahara War"
    ]),
    branch("Italy and the Mediterranean", [
        "Italian Wars", "Sicilian Vespers", "War of the Sicilian Vespers", "War of the Eight Saints", "Milanese Wars", "Venetian–Genoese Wars",
        "War of the League of Cambrai", "Italian Wars of Independence", "First Italian War of Independence", "Second Italian War of Independence",
        "Third Italian War of Independence", "Italian Civil War", "Years of Lead", "Greek Civil War", "Cyprus Emergency", "Cyprus Conflict"
    ]),
    branch("Central Europe", [
        conflict("Thirty Years' War", [battleGroup("Key Campaigns", ["Bohemian Revolt", "Danish Intervention", "Swedish Intervention", "French Intervention", "Battle of White Mountain", "Battle of Breitenfeld", "Battle of Lützen"])]),
        "Schmalkaldic War", "War of the Three Kingdoms", "War of the Austrian Succession", "Seven Years' War", "Napoleonic Wars",
        "War of the Sixth Coalition", "War of the Seventh Coalition", "Revolutions of 1848", "Franco-Prussian War", "First World War", "Second World War"
    ]),
    branch("Eastern Europe and the Balkans", [
        "Mongol Invasion of Europe", "Polish–Teutonic Wars", "Northern Crusades", "Polish–Lithuanian Civil Wars", "Deluge",
        "Khmelnytsky Uprising", "Great Northern War", "Partitions of Poland", "Kościuszko Uprising", "November Uprising", "January Uprising",
        "Russo-Turkish Wars", "Crimean War", "Caucasian War", "Russo-Japanese War", "Russian Civil War", "Finnish Civil War",
        "Balkan Wars", "First Balkan War", "Second Balkan War", "Greek–Turkish War", "Yugoslav Wars", "Bosnian War", "Kosovo War",
        "Russo-Ukrainian War", "Russo-Georgian War", "Transnistria War", "Nagorno-Karabakh Conflict"
    ]),
    branch("Nordic and Baltic Conflicts", [
        "Kalmar War", "Northern Seven Years' War", "Torstenson War", "Scanian War", "Great Northern War", "Finnish War", "Dano-Swedish Wars",
        "Norwegian Campaign", "Winter War", "Continuation War", "Lapland War", "Estonian War of Independence", "Latvian War of Independence"
    ])
]);
const middleEastAndNorthAfrica = branch("Middle East and North Africa", [
    branch("Ancient Near East", ["Sumerian Wars", "Akkadian Conquests", "Egyptian–Hittite Wars", "Battle of Kadesh", "Assyrian Wars", "Babylonian–Egyptian Wars", "Achaemenid Conquests", "Greco-Persian Wars"]),
    branch("Arabian and Islamic Conquests", ["Ridda Wars", "Arab Conquest of Persia", "Arab Conquest of Egypt", "Arab–Byzantine Wars", "Umayyad Civil Wars", "Abbasid Revolution", "Fitna", "Zanj Rebellion", "Almohad–Almoravid Wars"]),
    branch("Crusades and Levantine Wars", ["First Crusade", "Second Crusade", "Third Crusade", "Fourth Crusade", "Fifth Crusade", "Sixth Crusade", "Seventh Crusade", "Ayyubid–Mamluk Wars", "Mongol Invasions of the Levant", "Mamluk–Crusader Wars"]),
    branch("Ottoman, Persian, and Arabian Wars", ["Ottoman–Persian Wars", "Ottoman–Mamluk War", "Ottoman–Habsburg Wars", "Ottoman–Venetian Wars", "Wahhabi War", "Egyptian–Ottoman War", "Mahdist War", "Arab Revolt", "Saudi–Rashidi Wars", "North Yemen Civil War"]),
    branch("Modern Middle Eastern Conflicts", ["Turkish War of Independence", "Iranian Revolution", "Iran–Iraq War", "Arab–Israeli War", "1948 Palestine War", "Suez Crisis", "Six-Day War", "War of Attrition", "Yom Kippur War", "Lebanese Civil War", "First Intifada", "Second Intifada", "Gulf War", "Iraq War", "Syrian Civil War", "Yemeni Civil War", "Libyan Civil War", "War in Afghanistan"]),
    branch("North African Wars", ["Numidian Wars", "Punic Wars", "Barbary Wars", "Algerian War", "Tunisian Revolution", "Libyan–Chadian Conflict", "Western Sahara War", "Darfur War", "Egyptian Revolution", "Sinai Insurgency"])
]);
const africa = branch("Africa", [
    branch("West and Central Africa", ["Ashanti Wars", "Anglo-Ashanti Wars", "Sokoto Jihad", "Fulani War", "Maji Maji Rebellion", "Hausa Wars", "Biafran War", "Nigerian Civil War", "First Liberian Civil War", "Second Liberian Civil War", "Sierra Leone Civil War", "Central African Republic Civil War", "Cameroonian Civil War", "Chadian Civil War", "First Congo War", "Second Congo War"]),
    branch("East and Horn of Africa", ["Ethiopian–Adal War", "Mahdist War", "Ethiopian–Egyptian War", "First Italo-Ethiopian War", "Second Italo-Ethiopian War", "Eritrean War of Independence", "Ethiopian Civil War", "Somali Civil War", "Ogaden War", "Rwandan Civil War", "Rwandan Genocide", "Ugandan Bush War", "Lord's Resistance Army Insurgency"]),
    branch("Southern Africa", ["Great Trek Conflicts", "Xhosa Wars", "Anglo-Zulu War", "Basotho Wars", "First Boer War", "Second Boer War", "Herero Wars", "Mfecane", "Rhodesian Bush War", "Mozambican Civil War", "Angolan Civil War", "South African Border War", "Namibian War of Independence"]),
    branch("Anti-Colonial and Independence Wars", ["Algerian War", "Kenya Emergency", "Mau Mau Uprising", "Angolan War of Independence", "Mozambican War of Independence", "Guinea-Bissau War of Independence", "Cape Verde War of Independence", "Zimbabwean War of Liberation", "South African Border War", "Namibian Independence War"]),
    branch("African Wars and Humanitarian Crises", ["Darfur Conflict", "Kivu Conflict", "Somali Famine and War", "Sudanese Civil Wars", "South Sudanese Civil War", "Mali War", "Boko Haram Insurgency", "Sahel Conflicts", "Tigray War", "Insurgency in Cabo Delgado"])
]);
const southAsia = branch("South Asia", [
    branch("Ancient and Medieval South Asia", ["Kalinga War", "Mauryan Wars", "Indo-Greek Wars", "Kushan Wars", "Chola Invasions", "Chola–Srivijaya War", "Delhi Sultanate Wars", "Mughal Conquests", "Mughal–Rajput Wars", "Mughal–Maratha Wars", "Ahom–Mughal Wars", "Anglo-Afghan Wars"]),
    branch("Indian Regional and Colonial Wars", ["Anglo-Mysore Wars", "Anglo-Maratha Wars", "Anglo-Sikh Wars", "Pindari War", "Santal Rebellion", "Sepoy Rebellion", "Indian Rebellion of 1857", "Moplah Rebellion", "Ghadar Movement", "Royal Indian Navy Mutiny"]),
    branch("Partition and South Asian States", ["Partition of India", "Indo-Pakistani War of 1947", "Indo-Pakistani War of 1965", "Indo-Pakistani War of 1971", "Kargil War", "Bangladesh Liberation War", "Sri Lankan Civil War", "Nepalese Civil War", "Bhutanese Conflict", "Balochistan Conflicts"]),
    branch("Afghanistan and Himalayan Conflicts", ["First Anglo-Afghan War", "Second Anglo-Afghan War", "Third Anglo-Afghan War", "Soviet–Afghan War", "Afghan Civil War", "War in Afghanistan", "Kashmir Conflict", "Sino-Indian War", "Doklam Standoff"])
]);
const eastAsia = branch("East Asia", [
    branch("Chinese Dynastic and Civil Wars", ["Spring and Autumn Wars", "Warring States Period", "Qin Wars of Unification", "Chu–Han Contention", "Three Kingdoms Wars", "War of the Eight Princes", "An Lushan Rebellion", "Five Dynasties and Ten Kingdoms Wars", "Song–Liao Wars", "Song–Jin Wars", "Mongol Conquest of China", "Red Turban Rebellion", "Ming–Qing Transition", "Three Feudatories Rebellion", "Taiping Rebellion", "Dungan Revolt", "Nian Rebellion", "Boxer Rebellion", "Chinese Civil War"]),
    branch("Korean Peninsula", ["Three Kingdoms of Korea Wars", "Goguryeo–Sui War", "Goryeo–Khitan Wars", "Mongol Invasions of Korea", "Imjin War", "First Manchu Invasion of Korea", "Second Manchu Invasion of Korea", "Korean War", "Korean Demilitarized Zone Conflict"]),
    branch("Japan and Ryukyu", ["Genpei War", "Mongol Invasions of Japan", "Nanboku-chō Wars", "Ōnin War", "Sengoku Period Wars", "Imagawa–Oda Wars", "Toyotomi Hideyoshi's Invasions of Korea", "Shimabara Rebellion", "Boshin War", "Satsuma Rebellion", "Russo-Japanese War", "Pacific War"]),
    branch("Modern East Asian Wars", ["First Sino-Japanese War", "Second Sino-Japanese War", "Soviet–Japanese War", "Chinese Civil War", "Korean War", "Vietnam War", "Sino-Indian War", "Sino-Soviet Border Conflict", "Sino-Vietnamese War", "Taiwan Strait Crises"]),
    branch("Tibetan, Mongolian, and Steppe Wars", ["Xiongnu–Han War", "Göktürk Civil Wars", "Mongol Conquests", "Timurid Wars", "Dzungar–Qing War", "Mongolian Revolution", "Tibetan–Ladakh War", "Soviet Invasion of Mongolia"])
]);
const southeastAsia = branch("Southeast Asia", [
    branch("Mainland Southeast Asia", ["Khmer–Champa Wars", "Pagan–Mongol War", "Burmese–Siamese Wars", "Toungoo Wars", "Konbaung–Siam Wars", "Anglo-Burmese Wars", "Siamese–French War", "First Indochina War", "Vietnam War", "Cambodian Civil War", "Cambodian–Vietnamese War", "Laotian Civil War", "Myanmar Civil War"]),
    branch("Maritime Southeast Asia", ["Majapahit Wars", "Aceh War", "Java War", "Padri War", "Philippine–American War", "Philippine Revolution", "Indonesian National Revolution", "Malayan Emergency", "Brunei Revolt", "Konfrontasi", "East Timor Conflict", "Papua Conflict"]),
    branch("Anti-Colonial Wars", ["Philippine Revolution", "Vietnamese Declarations of Independence", "Indonesian War of Independence", "Burma Campaign", "Malayan Emergency", "Laotian Independence War", "Cambodian Independence Movement"])
]);
const centralAsia = branch("Central Asia and the Steppe", [
    "Scythian Wars", "Saka Wars", "Xiongnu Wars", "Turkic Khaganate Wars", "Arab Conquest of Transoxiana", "Mongol Conquests", "Golden Horde Wars", "Timurid Wars", "Kazakh–Dzungar Wars", "Dzungar Genocide", "Russian Conquest of Central Asia", "Basmachi Revolt", "Soviet Central Asian Conflicts", "Tajikistani Civil War", "Kyrgyz Revolution", "Afghanistan–Central Asia Conflicts"
]);
const northAmerica = branch("North America", [
    branch("Indigenous and Colonial Wars", ["Beaver Wars", "Pequot War", "King Philip's War", "Tuscarora War", "Yamasee War", "Queen Anne's War", "King George's War", "French and Indian War", "Pontiac's War", "Dunmore's War", "Chickamauga Wars", "Seminole Wars", "Black Hawk War", "Navajo Wars", "Apache Wars", "Sioux Wars", "Modoc War", "Wounded Knee and the Ghost Dance Wars"]),
    branch("United States Revolutionary and Constitutional Wars", ["American Revolutionary War", "Whiskey Rebellion", "Northwest Indian War", "Quasi-War", "Barbary Wars", "War of 1812", "Texas Revolution", "Mexican–American War", "Utah War", "Bleeding Kansas", "American Civil War", "Reconstruction Conflicts"]),
    branch("United States Overseas Wars", ["Spanish–American War", "Philippine–American War", "Banana Wars", "Mexican Border War", "World War I", "World War II", "Korean War", "Vietnam War", "Gulf War", "War in Afghanistan", "Iraq War", "War on Terror"]),
    branch("Canada and Mexico", ["Lower Canada Rebellion", "Upper Canada Rebellion", "North-West Rebellion", "Red River Resistance", "Mexican War of Independence", "Pastry War", "Reform War", "French Intervention in Mexico", "Mexican Revolution", "Cristero War", "Zapatista Uprising"]),
    branch("Caribbean and Central America", ["Haitian Revolution", "Cuban War of Independence", "Spanish–American War", "Banana Wars", "Nicaraguan Civil War", "Salvadoran Civil War", "Guatemalan Civil War", "Costa Rican Civil War", "Dominican Civil War", "Grenada Invasion", "Honduran–Salvadoran War"])
]);
const southAmerica = branch("South America and the Southern Cone", [
    branch("Wars of Independence", ["South American Wars of Independence", "Bolívar's Campaigns", "Argentine War of Independence", "Chilean War of Independence", "Peruvian War of Independence", "Brazilian War of Independence", "Uruguayan War of Independence", "Ecuadorian War of Independence"]),
    branch("Brazil and the Río de la Plata", ["Cisplatine War", "Ragamuffin War", "Balaiada", "Cabanagem", "Sabinada", "War of the Triple Alliance", "Paraguayan War", "Federalist Revolution", "Contestado War", "Brazilian Revolution of 1930"]),
    branch("The War of the Triple Alliance", ["Paraguay and the Triple Alliance", "Uruguayan Civil War and Intervention", "Brazilian Campaign in Paraguay", "Argentine Campaign in Paraguay", "Battle of Riachuelo", "Battle of Tuyutí", "Battle of Curupayty", "Battle of Humaitá", "Battle of Cerro Corá", "Paraguayan Demographic Collapse", "War Memory and Regional Legacy"]),
    branch("Pacific and Andean Wars", ["War of the Confederation", "War of the Pacific", "Ecuadorian–Peruvian War", "Colombian–Peruvian War", "Chaco War", "Leticia Incident", "Cenepa War", "Peruvian Civil Wars", "Bolivian Civil War"]),
    branch("Revolutions and Civil Wars", ["Colombian Civil War", "Thousand Days' War", "La Violencia", "Colombian Conflict", "Venezuelan Federal War", "Venezuelan Crisis and Conflict", "Argentine Civil Wars", "Uruguayan Civil War", "Chilean Civil War of 1891", "Peruvian Civil War", "Bolivian National Revolution"])
]);
const oceania = branch("Oceania and the Pacific", [
    branch("Australia and New Zealand", ["Australian Frontier Wars", "Black War", "New Zealand Wars", "Musket Wars", "Australian Federation Conflicts", "Battle of Gallipoli", "Pacific War", "East Timor Intervention"]),
    branch("Pacific Island Conflicts", ["Fiji Coups and Conflicts", "Bougainville Civil War", "Guadalcanal Campaign", "Solomon Islands Civil Conflict", "Vanuatu Coconut War", "Tonga Civil Conflicts", "New Caledonian Revolt", "Pacific Nuclear Testing and Resistance"]),
    branch("Pacific Theater of World War II", ["Attack on Pearl Harbor", "Battle of Guadalcanal", "Battle of Midway", "Kokoda Track Campaign", "Battle of the Coral Sea", "Battle of Saipan", "Battle of Iwo Jima", "Battle of Okinawa", "Atomic Bombings of Hiroshima and Nagasaki"])
]);
const worldWars = branch("World Wars and Global Conflicts", [
    conflict("World War I", [
        branch("Western Front", ["First Battle of the Marne", "Battle of Verdun", "Battle of the Somme", "Third Battle of Ypres", "Hundred Days Offensive"]),
        branch("Eastern and Northern Fronts", ["Battle of Tannenberg", "Brusilov Offensive", "Baltic Campaign", "Finnish Civil War", "Russian Revolution and Civil War"]),
        branch("Italian and Balkan Fronts", ["Italian Front", "Battles of the Isonzo", "Battle of Caporetto", "Salonika Front", "Gallipoli Campaign"]),
        branch("Middle Eastern and African Fronts", ["Mesopotamian Campaign", "Sinai and Palestine Campaign", "Arab Revolt", "East African Campaign", "South West Africa Campaign"]),
        branch("Naval and Global War", ["Battle of the Atlantic in World War I", "U-boat Campaign", "Blockade of Germany", "Convoy Battles", "War in the Pacific in World War I"]),
        "United States Entry into World War I", "Armistice of 11 November 1918", "Treaty of Versailles", "World War I and the Influenza Pandemic"
    ]),
    conflict("World War II", [
        branch("European Theater", ["Invasion of Poland", "Fall of France", "Battle of Britain", "Operation Barbarossa", "Siege of Leningrad", "Battle of Moscow", "Battle of Stalingrad", "Battle of Kursk", "D-Day", "Liberation of France", "Battle of the Bulge", "Fall of Berlin"]),
        branch("North African and Mediterranean Theaters", ["Western Desert Campaign", "Second Battle of El Alamein", "Tunisia Campaign", "Sicilian Campaign", "Italian Campaign", "Battle of Monte Cassino", "Greek Civil War Roots"]),
        branch("Eastern and Pacific Theaters", ["Second Sino-Japanese War", "Attack on Pearl Harbor", "Battle of Midway", "Guadalcanal Campaign", "Burma Campaign", "New Guinea Campaign", "Island Hopping", "Battle of Leyte Gulf", "Battle of Iwo Jima", "Battle of Okinawa", "Atomic Bombings"]),
        branch("Resistance, Occupation, and Genocide", ["French Resistance", "Warsaw Ghetto Uprising", "Warsaw Uprising", "Yugoslav Partisan War", "Greek Resistance", "Holocaust", "Nazi Occupation of Europe", "Soviet Partisan Movement", "Chinese Resistance"]),
        "Battle of the Atlantic", "Arctic Convoys", "Lend-Lease", "Soviet–Japanese War", "End of World War II", "Postwar Occupations and Settlements"
    ]),
    branch("Cold War Conflicts", ["Greek Civil War", "Chinese Civil War", "Korean War", "First Indochina War", "Vietnam War", "Laotian Civil War", "Cambodian Civil War", "Soviet–Afghan War", "Angolan Civil War", "Mozambican Civil War", "Nicaraguan Revolution", "Cuban Revolution", "Cuban Missile Crisis", "Arab–Israeli Conflicts", "Iran–Iraq War", "Sino-Soviet Border Conflict", "Contra War", "Ogaden War", "Ethiopian Civil War"]),
    branch("Post-Cold War and Twenty-First-Century Conflicts", ["Gulf War", "Yugoslav Wars", "Rwandan Civil War", "First Congo War", "Second Congo War", "Kosovo War", "War in Afghanistan", "Iraq War", "War on Terror", "Syrian Civil War", "Libyan Civil War", "Yemeni Civil War", "Russo-Ukrainian War", "Tigray War", "Nagorno-Karabakh Conflict", "Myanmar Civil War", "Sahel Conflicts"])
]);
const periods = grouped("Wars by Period", [
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
const types = grouped("Wars by Type", [
    ["International Wars", ["Punic Wars", "Hundred Years' War", "Seven Years' War", "Napoleonic Wars", "First World War", "Second World War"]],
    ["Civil Wars", ["Roman Civil Wars", "English Civil War", "French Civil Wars", "American Civil War", "Russian Civil War", "Spanish Civil War", "Chinese Civil War", "Syrian Civil War"]],
    ["Rebellions and Uprisings", ["Boudican Revolt", "Taiping Rebellion", "Sepoy Rebellion", "Maji Maji Rebellion", "Boxer Rebellion", "Warsaw Ghetto Uprising", "Easter Rising"]],
    ["Wars of Succession", ["War of the Castilian Succession", "War of the Spanish Succession", "War of the Austrian Succession", "Wars of the Roses", "Ming–Qing Transition"]],
    ["Religious Wars", ["Crusades", "French Wars of Religion", "Thirty Years' War", "Hussite Wars", "Taiping Rebellion", "Mahdist War"]],
    ["Revolutionary and Independence Wars", ["American Revolutionary War", "Haitian Revolution", "Latin American Wars of Independence", "Greek War of Independence", "Indonesian National Revolution", "Algerian War"]],
    ["Colonial and Anti-Colonial Wars", ["French and Indian War", "Anglo-Zulu War", "Mau Mau Uprising", "Vietnam War", "Algerian War", "Angolan War of Independence"]],
    ["Proxy and Ideological Wars", ["Spanish Civil War", "Korean War", "Vietnam War", "Angolan Civil War", "Soviet–Afghan War", "Contra War"]],
    ["Guerrilla and Insurgency Wars", ["Peninsular War", "Maoist Insurgency", "Malayan Emergency", "Irish War of Independence", "Afghan War", "Iraq Insurgency"]],
    ["Naval and Maritime Wars", ["Punic Wars", "Anglo-Dutch Wars", "Battle of the Atlantic", "Pacific War", "Russo-Japanese War", "War of the Pacific"]],
    ["Sieges and Urban Warfare", ["Siege of Troy", "Siege of Jerusalem", "Siege of Constantinople", "Siege of Orleans", "Siege of La Rochelle", "Siege of Leningrad", "Battle of Stalingrad"]],
    ["Border and Resource Wars", ["War of the Pacific", "Chaco War", "Cod Wars", "War of the Triple Alliance", "Ecuadorian–Peruvian War", "Sino-Soviet Border Conflict"]]
]);
const countryCollections = grouped("Wars by Country and State", [
    ["United States", ["American Revolutionary War", "War of 1812", "Mexican–American War", "American Civil War", "Indian Wars", "Spanish–American War", "World War I", "World War II", "Korean War", "Vietnam War", "Gulf War", "War in Afghanistan", "Iraq War"]],
    ["United Kingdom", ["Norman Conquest", "Hundred Years' War", "Wars of the Roses", "English Civil Wars", "Jacobite Risings", "Seven Years' War", "Napoleonic Wars", "Crimean War", "World War I", "World War II", "Falklands War"]],
    ["France", ["French Wars of Religion", "French Revolutionary Wars", "Napoleonic Wars", "Franco-Prussian War", "French Resistance", "First Indochina War", "Algerian War"]],
    ["Germany and the Holy Roman Empire", ["Thirty Years' War", "Seven Years' War", "Franco-Prussian War", "World War I", "World War II", "German Civil Conflict"]],
    ["Russia and the Soviet Union", ["Russo-Turkish Wars", "Great Northern War", "Crimean War", "Russian Civil War", "Soviet–Polish War", "World War II", "Soviet–Afghan War", "Russo-Ukrainian War"]],
    ["China", ["Warring States Period", "Mongol Conquest of China", "Taiping Rebellion", "Boxer Rebellion", "Second Sino-Japanese War", "Chinese Civil War", "Sino-Indian War", "Sino-Vietnamese War"]],
    ["India and South Asia", ["Mauryan Wars", "Mughal–Maratha Wars", "Anglo-Mysore Wars", "Indian Rebellion of 1857", "Partition of India", "Indo-Pakistani Wars", "Bangladesh Liberation War", "Sri Lankan Civil War"]],
    ["Ottoman Empire and Turkey", ["Ottoman–Habsburg Wars", "Ottoman–Persian Wars", "Crimean War", "Balkan Wars", "Turkish War of Independence", "Cyprus Conflict"]],
    ["Japan", ["Genpei War", "Sengoku Period Wars", "Boshin War", "First Sino-Japanese War", "Russo-Japanese War", "Second Sino-Japanese War", "Pacific War"]],
    ["Paraguay and the Southern Cone", ["War of the Triple Alliance", "Paraguayan War", "War of the Pacific", "Chaco War", "Uruguayan Civil War"]]
]);
function buildWarHistoryTopic() {
    return branch("War History", [
        branch("Wars by Region", [europe, middleEastAndNorthAfrica, africa, southAsia, eastAsia, southeastAsia, centralAsia, northAmerica, southAmerica, oceania]),
        periods,
        types,
        worldWars,
        branch("Civil Wars, Rebellions, and Insurgencies", [
            branch("Europe", ["French Civil Wars", "British Civil Wars", "Wars of the Roses", "Russian Civil War", "Spanish Civil War", "Greek Civil War", "Yugoslav Wars", "Irish Civil War"]),
            branch("Africa", ["Nigerian Civil War", "Ethiopian Civil War", "Rwandan Civil War", "First Congo War", "Second Congo War", "Angolan Civil War", "Mozambican Civil War", "Sudanese Civil Wars"]),
            branch("Asia", ["Chinese Civil War", "Korean War", "Cambodian Civil War", "Laotian Civil War", "Sri Lankan Civil War", "Nepalese Civil War", "Myanmar Civil War"]),
            branch("The Americas", ["American Civil War", "Mexican Revolution", "Colombian Civil War", "Uruguayan Civil War", "Nicaraguan Civil War", "Salvadoran Civil War", "Guatemalan Civil War"])
        ]),
        branch("French Wars and Civil Conflicts", [frenchWars, branch("French Civil Wars: Quick Index", ["French Wars of Religion", "Fronde", "War in the Vendée", "Chouannerie", "Paris Commune"])]),
        branch("Wars of the Roses and English Succession", [warsOfTheRoses, "Anarchy", "English Civil Wars", "Jacobite Risings", "Glorious Revolution"]),
        branch("War of the Triple Alliance and South American Conflicts", ["War of the Triple Alliance", "Paraguayan War", "War of the Pacific", "Chaco War", "War of the Confederation", "South American Wars of Independence"]),
        countryCollections,
        branch("Military Campaigns and Battles", [
            branch("Ancient Battles", ["Battle of Marathon", "Battle of Thermopylae", "Battle of Salamis", "Battle of Cannae", "Battle of Zama", "Battle of Actium"]),
            branch("Medieval Battles", ["Battle of Hastings", "Battle of Tours", "Battle of Manzikert", "Battle of Hattin", "Battle of Crécy", "Battle of Agincourt", "Battle of Towton"]),
            branch("Early Modern Battles", ["Battle of Lepanto", "Battle of White Mountain", "Battle of Breitenfeld", "Battle of Naseby", "Battle of Blenheim", "Battle of Poltava", "Battle of Waterloo"]),
            branch("Modern Battles", ["Battle of Gettysburg", "Battle of Verdun", "Battle of the Somme", "Battle of Stalingrad", "Battle of Midway", "Battle of Dien Bien Phu", "Battle of Khe Sanh", "Battle of Mogadishu"]),
            branch("Sieges and Fortified Cities", ["Siege of Troy", "Siege of Jerusalem", "Siege of Constantinople", "Siege of Orleans", "Siege of Vienna", "Siege of La Rochelle", "Siege of Leningrad", "Siege of Sarajevo"])
        ]),
        branch("War, Society, and Memory", [
            "Military Technology", "Arms and Armor", "Naval Technology", "Air Power", "Logistics and Supply", "Conscription", "Mercenaries",
            "Women and War", "Children and War", "War and Disease", "War and Famine", "War Refugees", "Prisoners of War", "War Crimes",
            "Genocide and Mass Violence", "Peace Treaties", "War Reparations", "War Memorials", "Veterans and Disability", "Archaeology of War", "War Correspondents"
        ]),
        "Other Wars and Conflicts"
    ]);
}
exports.WAR_HISTORY_SOURCES = [
    { label: "National Army Museum, British Civil Wars", url: "https://www.nam.ac.uk/explore/british-civil-wars" },
    { label: "U.S. National Archives, Military Reference", url: "https://www.archives.gov/research/alic/reference/military" },
    { label: "U.S. National Archives, World War II", url: "https://www.archives.gov/seattle/exhibit/picturing-the-century/wwii-era.html" }
];

},
"company-history-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCompaniesTopic = buildCompaniesTopic;
const branch = (label, children) => ({ label, children });
const sector = (label, categories, enterprises) => branch(label, [
    branch("General Categories", categories),
    branch("Notable Companies and Enterprises", enterprises)
]);
const period = (label, sectors, largest) => branch(label, [
    ...sectors,
    branch("Largest Companies and Enterprises of the Period", largest)
]);
function buildCompaniesTopic() {
    return branch("Companies", [
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
}

},
"movie-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOVIE_CATALOG_METADATA = void 0;
exports.buildMoviesTopic = buildMoviesTopic;
const branch = (label, children, aliases = []) => ({ label, children, ...(aliases.length ? { aliases } : {}) });
const movie = (label, aliases = []) => branch(label, [], aliases);
const movies = (titles) => titles.map((title) => movie(title));
const filmSeries = (label, titles, aliases = []) => branch(label, movies(titles), aliases);
const HIGHEST_GROSSING_SERIES = [
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
const RELEASE_ERAS = [
    branch("1910s and 1920s", movies(["The Birth of a Nation", "Intolerance", "Cleopatra (1917)", "Mickey", "The Miracle Man", "Way Down East", "The Four Horsemen of the Apocalypse", "Robin Hood", "The Covered Wagon", "The Sea Hawk", "The Big Parade", "Ben-Hur (1925)", "For Heaven's Sake", "Wings", "The Singing Fool", "The Broadway Melody"])),
    branch("1930s and 1940s", movies(["All Quiet on the Western Front", "Frankenstein", "City Lights", "King Kong", "I'm No Angel", "Cavalcade", "She Done Him Wrong", "The Merry Widow", "It Happened One Night", "Mutiny on the Bounty", "San Francisco", "Snow White and the Seven Dwarfs", "You Can't Take It with You", "Gone with the Wind", "The Wizard of Oz", "Pinocchio", "Boom Town", "Sergeant York", "Bambi", "Mrs. Miniver", "For Whom the Bell Tolls", "This Is the Army", "Going My Way", "Mom and Dad", "The Bells of St. Mary's", "Song of the South", "The Best Years of Our Lives", "Duel in the Sun", "Forever Amber", "Unconquered", "Easter Parade", "The Red Shoes", "The Snake Pit", "Samson and Delilah"])),
    branch("1950s and 1960s", movies(["King Solomon's Mines", "Quo Vadis", "This Is Cinerama", "The Greatest Show on Earth", "Peter Pan", "The Robe", "Rear Window", "White Christmas", "20,000 Leagues Under the Sea", "Lady and the Tramp", "Cinerama Holiday", "Mister Roberts", "The Ten Commandments", "The Bridge on the River Kwai", "South Pacific", "Ben-Hur (1959)", "Swiss Family Robinson", "Spartacus", "Psycho", "One Hundred and One Dalmatians", "West Side Story", "Lawrence of Arabia", "How the West Was Won", "The Longest Day", "Cleopatra (1963)", "From Russia with Love", "My Fair Lady", "Goldfinger", "Mary Poppins", "The Sound of Music", "The Bible: In the Beginning...", "Hawaii", "Who's Afraid of Virginia Woolf?", "The Jungle Book (1967)", "The Graduate", "2001: A Space Odyssey", "Funny Girl"])),
    branch("1970s and 1980s", movies(["Butch Cassidy and the Sundance Kid", "Love Story", "The French Connection", "Fiddler on the Roof", "Diamonds Are Forever", "The Godfather", "The Exorcist", "The Sting", "The Towering Inferno", "Jaws", "Rocky", "Star Wars", "Grease", "Moonraker", "Rocky II", "The Empire Strikes Back", "Raiders of the Lost Ark", "E.T. the Extra-Terrestrial", "Return of the Jedi", "Ghostbusters", "Back to the Future", "Top Gun", "Fatal Attraction", "Rain Man", "Indiana Jones and the Last Crusade"])),
    branch("1990s", movies(["Ghost", "Terminator 2: Judgment Day", "Aladdin (1992)", "Jurassic Park", "The Lion King (1994)", "Toy Story", "Die Hard with a Vengeance", "Independence Day", "Titanic", "Armageddon", "Star Wars: Episode I – The Phantom Menace"])),
    branch("2000s", movies(["Mission: Impossible 2", "Harry Potter and the Philosopher's Stone", "The Lord of the Rings: The Two Towers", "The Lord of the Rings: The Return of the King", "Shrek 2", "Harry Potter and the Goblet of Fire", "Star Wars: Episode III – Revenge of the Sith", "Pirates of the Caribbean: Dead Man's Chest", "Pirates of the Caribbean: At World's End", "The Dark Knight", "Avatar"])),
    branch("2010s", movies(["Toy Story 3", "Harry Potter and the Deathly Hallows – Part 2", "The Avengers", "Frozen", "Transformers: Age of Extinction", "Star Wars: The Force Awakens", "Captain America: Civil War", "Star Wars: The Last Jedi", "Avengers: Infinity War", "Avengers: Endgame"])),
    branch("2020s", movies(["Demon Slayer: Kimetsu no Yaiba – The Movie: Mugen Train", "Spider-Man: No Way Home", "Avatar: The Way of Water", "Barbie", "Inside Out 2", "Ne Zha 2", "Zootopia 2", "Avatar: Fire and Ash", "The Super Mario Bros. Movie", "Deadpool & Wolverine", "Moana 2", "Lilo & Stitch (2025)", "Jurassic World Dominion", "Despicable Me 4", "Oppenheimer", "Spider-Man: Brand New Day"]))
];
const genre = (label, groups) => branch(label, groups.map(([name, titles]) => branch(name, movies(titles))));
const GENRE_BRANCHES = [
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
exports.MOVIE_CATALOG_METADATA = {
    sourceUrl: "https://en.wikipedia.org/wiki/List_of_highest-grossing_films",
    sourceLabel: "Wikipedia's lists of highest-grossing films and film series",
    verifiedAt: "2026-09-21",
    note: "Film-series and film-gross rankings are snapshots and can change after releases, re-releases, and data revisions."
};
function buildMoviesTopic() {
    return branch("Movies", [
        branch("Highest-Grossing Film Series", HIGHEST_GROSSING_SERIES),
        branch("Highest-Grossing Films", HIGHEST_GROSSING_FILMS),
        branch("Highest-Grossing Films Adjusted for Inflation", ADJUSTED_FOR_INFLATION),
        branch("Original Films for Sequel Entries", movies(["Ne Zha", "Zootopia", "Inside Out", "Avatar", "Moana", "Deadpool", "The Fellowship of the Ring", "The Curse of the Black Pearl", "Toy Story", "The Lion King (1994)", "Beauty and the Beast (1991)", "Frozen", "Jurassic Park", "The Fast and the Furious", "Star Wars", "Harry Potter and the Philosopher's Stone"])),
        branch("By Release Era", RELEASE_ERAS),
        branch("By Genre", GENRE_BRANCHES)
    ]);
}

},
"television-music-sports-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEVISION_MUSIC_SPORTS_CATALOG_METADATA = void 0;
exports.buildTelevisionMusicSportsTopics = buildTelevisionMusicSportsTopics;
const branch = (label, children, aliases = []) => ({ label, children, ...(aliases.length ? { aliases } : {}) });
const leaf = (label, aliases = []) => branch(label, [], aliases);
const leaves = (labels) => labels.map((label) => leaf(label));
const grouped = (label, groups) => branch(label, groups.map(([name, items]) => branch(name, leaves(items))));
const team = (label, periods = ["Founding and Early Years", "Defining Franchise Era", "Modern Era"]) => branch(label, leaves(periods));
const league = (label, teams, players, awards, history) => branch(label, [
    branch("History", leaves(history)),
    ...teams.map(([name, periods]) => team(name, periods)),
    branch("Best Players", leaves(players)),
    branch("Awards", leaves(awards))
]);
const TELEVISION_SHOWS = [
    "24", "30 Rock", "Alfred Hitchcock Presents", "Alias", "All in the Family", "American Idol", "The Americans", "The Andy Griffith Show", "Arrested Development", "Atlanta", "Band of Brothers", "Barry", "Battlestar Galactica", "Beavis and Butt-Head", "Better Call Saul", "Beverly Hills, 90210", "Black Mirror", "Boardwalk Empire", "The Bob Newhart Show", "BoJack Horseman", "Borgen", "Breaking Bad", "Buffy the Vampire Slayer", "The Carol Burnett Show", "Chappelle's Show", "Cheers", "Chernobyl", "Columbo", "Community", "The Cosby Show", "The Crown", "Curb Your Enthusiasm", "The Daily Show", "Dallas", "Deadwood", "Dexter", "The Dick Van Dyke Show", "Doctor Who", "Downton Abbey", "ER", "Fargo", "Fawlty Towers", "Firefly", "Fleabag", "Frasier", "Freaks and Geeks", "The Fresh Prince of Bel-Air", "Friday Night Lights", "Friends", "Futurama", "Game of Thrones", "Gilmore Girls", "Girls", "The Golden Girls", "The Good Place", "Good Times", "The Good Wife", "Grey's Anatomy", "Happy Days", "The Handmaid's Tale", "Hill Street Blues", "Homeland", "Homicide: Life on the Street", "The Honeymooners", "House", "House of Cards", "I Love Lucy", "I May Destroy You", "In Living Color", "It's Always Sunny in Philadelphia", "The Jeffersons", "Jeopardy!", "The Larry Sanders Show", "Late Night with David Letterman", "Law & Order", "The Leftovers", "Lost", "Louie", "M*A*S*H", "Mad Men", "The Mary Tyler Moore Show", "Modern Family", "Monty Python's Flying Circus", "The Muppet Show", "My So-Called Life", "Mystery Science Theater 3000", "NYPD Blue", "The Office", "The Oprah Winfrey Show", "Orange Is the New Black", "Oz", "Parks and Recreation", "Prime Suspect", "The Prisoner", "The Real World", "Rick and Morty", "Roots", "Roseanne", "Saturday Night Live", "Seinfeld", "Sesame Street", "Sex and the City", "Sherlock", "The Shield", "The Simpsons", "Six Feet Under", "The Sopranos", "South Park", "St. Elsewhere", "Star Trek: The Next Generation", "Star Trek: The Original Series", "Stranger Things", "Succession", "Survivor", "Taxi", "The Tonight Show Starring Johnny Carson", "True Detective", "The Twilight Zone", "Twin Peaks", "Veep", "Watchmen", "The West Wing", "Will & Grace", "The Wire", "The Wonder Years", "The X-Files", "Your Show of Shows"
];
const TELEVISION_GENRES = [
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
const TELEVISION_ERAS = [
    ["1950s and 1960s", ["I Love Lucy", "The Honeymooners", "The Twilight Zone", "The Dick Van Dyke Show", "The Andy Griffith Show", "The Carol Burnett Show", "Star Trek: The Original Series", "The Prisoner", "The Tonight Show Starring Johnny Carson"]],
    ["1970s", ["All in the Family", "M*A*S*H", "The Mary Tyler Moore Show", "The Bob Newhart Show", "Good Times", "The Jeffersons", "Happy Days", "The Muppet Show", "Roots", "Taxi", "Saturday Night Live"]],
    ["1980s", ["Cheers", "The Golden Girls", "The Cosby Show", "The Oprah Winfrey Show", "Hill Street Blues", "The Wonder Years", "The Simpsons", "The Fresh Prince of Bel-Air", "The X-Files"]],
    ["1990s", ["Seinfeld", "Friends", "ER", "The Sopranos", "The West Wing", "The Larry Sanders Show", "Buffy the Vampire Slayer", "The Real World", "Law & Order", "The Daily Show", "Sex and the City", "The X-Files"]],
    ["2000s", ["The Wire", "Lost", "The Office", "Arrested Development", "Deadwood", "The Shield", "Battlestar Galactica", "House", "Friday Night Lights", "Mad Men", "Futurama", "Survivor"]],
    ["2010s", ["Breaking Bad", "Game of Thrones", "Better Call Saul", "Fleabag", "Atlanta", "Chernobyl", "Black Mirror", "The Crown", "The Handmaid's Tale", "The Good Place", "BoJack Horseman", "Stranger Things", "Orange Is the New Black"]],
    ["2020s", ["Succession", "I May Destroy You", "Watchmen", "The Queen's Gambit", "The Last of Us", "Severance", "The Bear", "The White Lotus", "The Morning Show", "Ted Lasso"]]
];
function buildTelevisionTopic() {
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
const BEST_SELLING_ARTISTS = [
    ["The Beatles", ["Beatles"]], ["Michael Jackson", []], ["Elvis Presley", []], ["Madonna", []], ["Elton John", []], ["Queen", []], ["Led Zeppelin", []], ["Rihanna", []], ["Pink Floyd", []], ["Eminem", []], ["Mariah Carey", []], ["Whitney Houston", []], ["Taylor Swift", []], ["Beyoncé", ["Beyonce"]], ["Ed Sheeran", []], ["AC/DC", ["AC DC"]], ["Eagles", []], ["Celine Dion", []], ["The Rolling Stones", ["Rolling Stones"]], ["Drake", []], ["Garth Brooks", []], ["U2", []], ["Kanye West", []], ["Coldplay", []], ["Billy Joel", []], ["Katy Perry", []], ["Justin Bieber", []], ["Bruno Mars", []], ["Britney Spears", []], ["Metallica", []], ["Bruce Springsteen", []], ["Aerosmith", []], ["Phil Collins", []], ["Barbra Streisand", []], ["ABBA", []], ["Julio Iglesias", []], ["Frank Sinatra", []], ["Chris Brown", []], ["Jay-Z", []], ["Lady Gaga", []], ["Lil Wayne", []], ["Maroon 5", []], ["Adele", []], ["Red Hot Chili Peppers", []], ["Bon Jovi", []], ["Fleetwood Mac", []], ["Rod Stewart", []], ["Bee Gees", []], ["Dire Straits", []], ["Roberto Carlos", []], ["Nicki Minaj", []], ["Linkin Park", []], ["George Strait", []], ["Journey", []], ["Pink", []], ["Christina Aguilera", []], ["Guns N' Roses", []], ["Shania Twain", []], ["B'z", ["B-Z"]], ["Backstreet Boys", []], ["Eric Clapton", []], ["Neil Diamond", []], ["Prince", []], ["Paul McCartney", []], ["Janet Jackson", []], ["Kenny Rogers", []], ["The Doors", []], ["Santana", []], ["Simon & Garfunkel", []], ["The Beach Boys", []], ["George Michael", []], ["Foreigner", []], ["Bob Dylan", []], ["Chicago", []], ["Cher", []], ["Meat Loaf", []], ["The Carpenters", []], ["Earth, Wind & Fire", []], ["David Bowie", []], ["Def Leppard", []], ["Stevie Wonder", []], ["Genesis", []], ["Gloria Estefan", []], ["Tina Turner", []], ["James Taylor", []], ["Olivia Newton-John", []], ["Linda Ronstadt", []], ["Donna Summer", []], ["Diana Ross", []], ["The Supremes", []], ["Shakira", []], ["Ariana Grande", []], ["Alicia Keys", []], ["Tim McGraw", []], ["Lionel Richie", []], ["Andrea Bocelli", []], ["Johnny Cash", []], ["Justin Timberlake", []], ["Pearl Jam", []], ["R.E.M.", ["REM"]], ["Kelly Clarkson", []], ["Post Malone", []], ["Flo Rida", []], ["Usher", []], ["The Black Eyed Peas", []], ["Van Halen", []], ["Ayumi Hamasaki", []], ["Tom Petty", []], ["Johnny Hallyday", []], ["The Weeknd", []], ["Imagine Dragons", []], ["Luke Bryan", []], ["Tupac Shakur", ["2Pac"]], ["Nirvana", []], ["Oasis", []], ["Green Day", []], ["Alabama", []], ["R. Kelly", []], ["Robbie Williams", []], ["Bob Seger", []], ["Kenny G", []], ["Enya", []], ["Bryan Adams", []], ["Bob Marley", []], ["The Police", []], ["Barry Manilow", []], ["Kiss", []], ["Aretha Franklin", []]
];
const MUSIC_GENRES = [
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
function buildMusicTopic() {
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
const NBA_TEAMS = [
    ["Atlanta Hawks", ["Tri-Cities and Milwaukee Years", "St. Louis Hawks Era", "Atlanta and Dominique Wilkins Era", "Modern Era"]], ["Boston Celtics", ["Founding Years", "Bill Russell Dynasty", "Larry Bird Era", "Big Three Era", "Modern Era"]], ["Brooklyn Nets", ["New Jersey Nets Years", "Jason Kidd Era", "Brooklyn Move", "Modern Era"]], ["Charlotte Hornets", ["Original Charlotte Years", "Bobcats Era", "Return of the Hornets", "Modern Era"]], ["Chicago Bulls", ["Founding Years", "Michael Jordan Dynasty", "Post-Jordan Rebuild", "Modern Era"]], ["Cleveland Cavaliers", ["Founding Years", "LeBron James First Era", "2016 Championship", "Modern Era"]], ["Dallas Mavericks", ["Founding Years", "Dirk Nowitzki Era", "2011 Championship", "Luka Dončić Era"]], ["Denver Nuggets", ["ABA and Early NBA Years", "Alex English Era", "Carmelo Anthony Era", "Nikola Jokić Era"]], ["Detroit Pistons", ["Bad Boys Era", "Going to Work Era", "Modern Rebuild"]], ["Golden State Warriors", ["Philadelphia Warriors Years", "Run TMC Era", "We Believe Era", "Stephen Curry Dynasty"]], ["Houston Rockets", ["San Diego and Early Houston Years", "Hakeem Olajuwon Era", "Yao Ming Era", "Modern Era"]], ["Indiana Pacers", ["ABA Pacers Era", "Reggie Miller Era", "Malcolm Brogdon and Modern Era"]], ["LA Clippers", ["Buffalo and San Diego Years", "Lob City Era", "Kawhi Leonard Era"]], ["Los Angeles Lakers", ["Minneapolis Lakers Years", "Showtime Era", "Shaq and Kobe Era", "Kobe and Pau Era", "LeBron James Era"]], ["Memphis Grizzlies", ["Vancouver Years", "Grit and Grind Era", "Ja Morant Era"]], ["Miami Heat", ["Expansion Years", "Alonzo Mourning Era", "Heatles Era", "Jimmy Butler Era"]], ["Milwaukee Bucks", ["Expansion Years", "Kareem Abdul-Jabbar Era", "Big Three and 2001 Run", "Giannis Antetokounmpo Era"]], ["Minnesota Timberwolves", ["Expansion Years", "Kevin Garnett Era", "Modern Era"]], ["New Orleans Pelicans", ["Charlotte and New Orleans Hornets Years", "Anthony Davis Era", "Modern Era"]], ["New York Knicks", ["Founding Years", "Early Championship Era", "1970s Championship Teams", "Patrick Ewing Era", "Modern Era"]], ["Oklahoma City Thunder", ["Seattle SuperSonics Years", "Kevin Durant and Russell Westbrook Era", "Modern Era"]], ["Orlando Magic", ["Expansion Years", "Shaquille O'Neal and Penny Hardaway Era", "Dwight Howard Era", "Modern Era"]], ["Philadelphia 76ers", ["Syracuse Nationals Years", "Wilt Chamberlain Era", "Julius Erving Era", "Allen Iverson Era", "Modern Era"]], ["Phoenix Suns", ["Expansion Years", "The Original Suns Finals Run", "Steve Nash Era", "Charles Barkley Era", "Modern Era"]], ["Portland Trail Blazers", ["Founding Years", "1977 Championship", "Clyde Drexler Era", "Modern Era"]], ["Sacramento Kings", ["Rochester and Cincinnati Years", "Kansas City-Omaha Years", "Chris Webber Era", "Modern Era"]], ["San Antonio Spurs", ["Dallas Chaparrals and ABA Years", "David Robinson Era", "Twin Towers Era", "Tim Duncan Dynasty", "Modern Era"]], ["Toronto Raptors", ["Expansion Years", "Vince Carter Era", "2019 Championship", "Modern Era"]], ["Utah Jazz", ["New Orleans Jazz Years", "Stockton and Malone Era", "Modern Era"]], ["Washington Wizards", ["Baltimore Bullets Years", "1978 Championship", "Wes Unseld and Elvin Hayes Era", "Modern Era"]]
];
const NBA_TOP_100 = [
    "Michael Jordan", "LeBron James", "Kareem Abdul-Jabbar", "Bill Russell", "Magic Johnson", "Wilt Chamberlain", "Larry Bird", "Tim Duncan", "Shaquille O'Neal", "Hakeem Olajuwon", "Kobe Bryant", "Stephen Curry", "Kevin Durant", "Oscar Robertson", "Jerry West", "Julius Erving", "Moses Malone", "Karl Malone", "Kevin Garnett", "Dirk Nowitzki", "Giannis Antetokounmpo", "David Robinson", "Charles Barkley", "John Havlicek", "Elgin Baylor", "Dwyane Wade", "Isiah Thomas", "Chris Paul", "John Stockton", "Scottie Pippen", "Kawhi Leonard", "Nikola Jokić", "Jason Kidd", "Steve Nash", "Bob Pettit", "Rick Barry", "George Gervin", "Patrick Ewing", "Clyde Drexler", "Allen Iverson", "Russell Westbrook", "James Harden", "Dominique Wilkins", "Reggie Miller", "Paul Pierce", "Ray Allen", "Kevin McHale", "Willis Reed", "Walt Frazier", "Bob Cousy", "Dave Cowens", "Elvin Hayes", "Wes Unseld", "Robert Parish", "Dwight Howard", "Damian Lillard", "Anthony Davis", "Chris Webber", "Carmelo Anthony", "Tracy McGrady", "Vince Carter", "Gary Payton", "Manu Ginóbili", "Pau Gasol", "Dennis Rodman", "Draymond Green", "Klay Thompson", "Jimmy Butler", "Kyrie Irving", "Jayson Tatum", "Joel Embiid", "Luka Dončić", "James Worthy", "Bill Walton", "Artis Gilmore", "Nate Thurmond", "Dave DeBusschere", "Bernard King", "Grant Hill", "Yao Ming", "Amar'e Stoudemire", "LaMarcus Aldridge", "Tony Parker", "Chauncey Billups", "Ben Wallace", "Dikembe Mutombo", "Chris Bosh", "DeMar DeRozan", "Paul George", "Andre Iguodala", "Shawn Marion", "Rasheed Wallace", "Alex English", "Mitch Richmond", "Sidney Moncrief", "Jo Jo White", "Lou Hudson", "Shawn Kemp", "Mark Price", "Tim Hardaway"
];
const NBA_AWARDS = ["Most Valuable Player", "Finals Most Valuable Player", "Defensive Player of the Year", "Rookie of the Year", "Most Improved Player", "Sixth Man of the Year", "Coach of the Year", "All-NBA Teams", "All-Defensive Teams", "All-Star Game", "Scoring Champion", "Rebounding Leader", "Assist Leader", "Steals Leader", "Blocks Leader", "Three-Point Contest", "Slam Dunk Contest"];
const NFL_TEAMS = [
    ["Arizona Cardinals", ["Chicago Cardinals Years", "St. Louis Cardinals Years", "Arizona Move", "Modern Era"]], ["Atlanta Falcons", ["Expansion Years", "1998 Super Bowl Run", "Michael Vick Era", "Modern Era"]], ["Baltimore Ravens", ["Expansion Years", "2000 Championship Defense", "Joe Flacco Era", "Lamar Jackson Era"]], ["Buffalo Bills", ["AFL Years", "K-Gun and Four Super Bowls", "1990s Rebuild", "Modern Era"]], ["Carolina Panthers", ["Expansion Years", "1996 NFC Championship Run", "Cam Newton Era", "Modern Era"]], ["Chicago Bears", ["Decatur Staleys Years", "Monsters of the Midway", "1985 Championship", "Modern Era"]], ["Cincinnati Bengals", ["Expansion Years", "Freezer Bowl Era", "The 2000s Rebuild", "Joe Burrow Era"]], ["Cleveland Browns", ["AAFC and Founding Years", "Paul Brown Era", "The Kardiac Kids", "Modern Era"]], ["Dallas Cowboys", ["Founding Years", "Doomsday Defense", "Triplets Dynasty", "Tony Romo Era", "Modern Era"]], ["Denver Broncos", ["AFL and Early Years", "Orange Crush Defense", "John Elway Era", "Peyton Manning Era", "Modern Era"]], ["Detroit Lions", ["Portsmouth and Early Years", "Bobby Layne Era", "Barry Sanders Era", "Modern Era"]], ["Green Bay Packers", ["Curly Lambeau Era", "Vince Lombardi Dynasty", "Brett Favre Era", "Aaron Rodgers Era", "Modern Era"]], ["Houston Texans", ["Expansion Years", "Andre Johnson Era", "J.J. Watt Era", "Modern Era"]], ["Indianapolis Colts", ["Baltimore Colts Years", "Johnny Unitas Era", "Peyton Manning Era", "Andrew Luck Era"]], ["Jacksonville Jaguars", ["Expansion Years", "1990s Playoff Era", "Modern Era"]], ["Kansas City Chiefs", ["Dallas Texans Years", "Hank Stram Era", "Len Dawson Era", "Patrick Mahomes Era"]], ["Las Vegas Raiders", ["Oakland AFL Years", "John Madden Dynasty", "Los Angeles Years", "Las Vegas Move"]], ["Los Angeles Chargers", ["Los Angeles and San Diego Years", "Air Coryell Era", "Philip Rivers Era", "Modern Era"]], ["Los Angeles Rams", ["Cleveland Rams Years", "Greatest Show on Turf", "St. Louis Years", "Sean McVay Era"]], ["Miami Dolphins", ["Expansion Years", "Perfect Season", "Dan Marino Era", "Modern Era"]], ["Minnesota Vikings", ["Expansion Years", "Purple People Eaters", "Four Super Bowl Era", "Modern Era"]], ["New England Patriots", ["Boston Patriots Years", "Parcells Era", "Brady-Belichick Dynasty", "Modern Era"]], ["New Orleans Saints", ["Expansion Years", "Dome Patrol", "Drew Brees Era", "Modern Era"]], ["New York Giants", ["Founding Years", "1950s Championship Teams", "Parcells Era", "Manning Era", "Modern Era"]], ["New York Jets", ["Titans Years", "1968 Championship", "Namath Era", "Modern Era"]], ["Philadelphia Eagles", ["Founding Years", "1960 Championship", "Buddy Ryan Era", "Reid and McNabb Era", "Modern Era"]], ["Pittsburgh Steelers", ["Founding Years", "Steel Curtain Dynasty", "Bradshaw Era", "Ben Roethlisberger Era", "Modern Era"]], ["San Francisco 49ers", ["Founding Years", "Montana and Walsh Dynasty", "Young Era", "Harbaugh Era", "Modern Era"]], ["Seattle Seahawks", ["Expansion Years", "Legion of Boom", "Russell Wilson Era", "Modern Era"]], ["Tampa Bay Buccaneers", ["Expansion Years", "1979 Defense", "Gruden Championship", "Modern Era"]], ["Tennessee Titans", ["Houston Oilers Years", "Run and Shoot Era", "Music City Miracle", "Modern Era"]], ["Washington Commanders", ["Boston and Early Years", "Hogs and Gibbs Dynasty", "1991 Championship", "Modern Era"]]
];
const NFL_BEST_PLAYERS = ["Tom Brady", "Jerry Rice", "Jim Brown", "Lawrence Taylor", "Joe Montana", "Peyton Manning", "Walter Payton", "Emmitt Smith", "Reggie White", "Johnny Unitas", "Randy Moss", "Deion Sanders", "Barry Sanders", "Gale Sayers", "Ray Lewis", "Anthony Munoz", "Joe Greene", "Dick Butkus", "Rob Gronkowski", "Tony Gonzalez", "Drew Brees", "Aaron Rodgers", "Patrick Mahomes", "Dan Marino", "Steve Young", "John Elway", "Bruce Smith", "Alan Page", "Earl Campbell", "Eric Dickerson", "Marshall Faulk", "Adrian Peterson", "LaDainian Tomlinson", "Junior Seau", "Ronnie Lott", "Rod Woodson", "Darrell Green", "Willie Brown", "Troy Polamalu", "Ed Reed", "J.J. Watt", "Aaron Donald", "Calvin Johnson", "Terrell Owens", "Devin Hester", "Adam Vinatieri", "Morten Andersen", "Hugh McElhenny", "Franco Harris", "Lynn Swann"];
const NFL_AWARDS = ["Most Valuable Player", "Super Bowl Most Valuable Player", "Defensive Player of the Year", "Offensive Player of the Year", "Offensive Rookie of the Year", "Defensive Rookie of the Year", "Comeback Player of the Year", "Coach of the Year", "Walter Payton Man of the Year", "All-Pro Teams", "Pro Bowl", "Passing Champion", "Rushing Champion", "Receiving Champion", "Defensive Interceptions Leader", "Sack Leader"];
const MLB_TEAMS = [
    ["Arizona Diamondbacks", ["Expansion Years", "2001 World Series", "Modern Era"]], ["Atlanta Braves", ["Boston and Milwaukee Years", "1990s Division Dynasty", "John Smoltz and Chipper Jones Era", "Modern Era"]], ["Baltimore Orioles", ["St. Louis Browns Years", "Brooks Robinson Era", "Earl Weaver Era", "Modern Era"]], ["Boston Red Sox", ["Early Years", "Babe Ruth and Curse of the Bambino", "2004 Championship", "Modern Era"]], ["Chicago Cubs", ["Early Years", "1908 Championship and Drought", "2016 Championship", "Modern Era"]], ["Chicago White Sox", ["Early Years", "1917 Championship", "Black Sox Scandal", "2005 Championship", "Modern Era"]], ["Cincinnati Reds", ["Early Years", "Big Red Machine", "1990 Championship", "Modern Era"]], ["Cleveland Guardians", ["Cleveland Spiders and Early Years", "1948 Championship", "Modern Era"]], ["Colorado Rockies", ["Expansion Years", "1995 Wild Card Era", "Modern Era"]], ["Detroit Tigers", ["Early Years", "Ty Cobb Era", "1968 Championship", "1984 Championship", "Modern Era"]], ["Houston Astros", ["Colt .45s Years", "Killer B's Era", "2017 Championship", "Modern Era"]], ["Kansas City Royals", ["Expansion Years", "1985 Championship", "2015 Championship", "Modern Era"]], ["Los Angeles Angels", ["Los Angeles and California Angels Years", "1979 Playoff Era", "2002 Championship", "Modern Era"]], ["Los Angeles Dodgers", ["Brooklyn Dodgers Years", "Sandy Koufax Era", "Fernandomania", "Gibson and Hershiser Era", "Modern Era"]], ["Miami Marlins", ["Florida Marlins Years", "1997 and 2003 Championships", "Modern Era"]], ["Milwaukee Brewers", ["Seattle Pilots Years", "1982 Pennant", "Modern Era"]], ["Minnesota Twins", ["Washington Senators Years", "Killer B's Era", "1987 and 1991 Championships", "Modern Era"]], ["New York Mets", ["Expansion Years", "1969 Miracle Mets", "1986 Championship", "Modern Era"]], ["New York Yankees", ["Early Years", "Babe Ruth and Murderers' Row", "Casey Stengel Dynasty", "Reggie and Steinbrenner Era", "Jeter Dynasty", "Modern Era"]], ["Oakland Athletics", ["Philadelphia Athletics Years", "Swingin' A's", "Bash Brothers Era", "Moneyball Era", "Modern Era"]], ["Philadelphia Phillies", ["Early Years", "1950 Whiz Kids", "1980 Championship", "2008 Championship", "Modern Era"]], ["Pittsburgh Pirates", ["Early Years", "Honus Wagner Era", "We Are Family", "Andrew McCutchen Era", "Modern Era"]], ["San Diego Padres", ["Expansion Years", "Tony Gwynn Era", "1998 World Series Run", "Modern Era"]], ["San Francisco Giants", ["New York Giants Years", "Willie Mays Era", "2010s Championships", "Modern Era"]], ["Seattle Mariners", ["Expansion Years", "Ken Griffey Jr. Era", "2001 Record Season", "Modern Era"]], ["St. Louis Cardinals", ["Early Years", "Gashouse Gang", "Stan Musial Era", "Whiteyball", "Modern Era"]], ["Tampa Bay Rays", ["Devil Rays Years", "2008 Pennant", "Modern Era"]], ["Texas Rangers", ["Washington Senators Years", "Early Rangers Years", "2010 and 2011 World Series Runs", "Modern Era"]], ["Toronto Blue Jays", ["Expansion Years", "1992 and 1993 Championships", "Modern Era"]], ["Washington Nationals", ["Montreal Expos Years", "Washington Move", "2019 Championship", "Modern Era"]]
];
const MLB_BEST_PLAYERS = ["Babe Ruth", "Willie Mays", "Hank Aaron", "Ty Cobb", "Walter Johnson", "Ted Williams", "Lou Gehrig", "Stan Musial", "Mickey Mantle", "Cy Young", "Honus Wagner", "Jackie Robinson", "Sandy Koufax", "Barry Bonds", "Rogers Hornsby", "Tris Speaker", "Christy Mathewson", "Joe DiMaggio", "Frank Robinson", "Roberto Clemente", "Pete Rose", "Greg Maddux", "Nolan Ryan", "Tom Seaver", "Randy Johnson", "Pedro Martínez", "Albert Pujols", "Ichiro Suzuki", "Derek Jeter", "Mike Trout", "Rickey Henderson", "Cal Ripken Jr.", "George Brett", "Tony Gwynn", "Ozzie Smith", "Cal Ripken Sr.", "Yogi Berra", "Johnny Bench", "Mike Schmidt", "Ernie Banks", "Eddie Mathews", "Eddie Collins", "Jimmie Foxx", "Mel Ott", "Carl Yastrzemski", "Roberto Alomar", "Jeff Bagwell", "Chipper Jones", "Ken Griffey Jr.", "Adrian Beltre"];
const MLB_AWARDS = ["Most Valuable Player", "Cy Young Award", "Rookie of the Year", "Manager of the Year", "Reliever of the Year", "Comeback Player of the Year", "World Series Most Valuable Player", "Gold Glove Award", "Silver Slugger Award", "Batting Champion", "Home Run Leader", "Runs Batted In Leader", "Stolen Base Leader", "Strikeout Leader", "No-Hitter", "Perfect Game", "All-Star Game"];
const SOCCER_LEAGUES = [
    ["Premier League", [["Arsenal", ["Early Years", "Invincibles Era", "Modern Era"]], ["Chelsea", ["Founding Years", "Mourinho Era", "Abramovich Era", "Modern Era"]], ["Liverpool", ["Founding Years", "Shankly and Paisley Dynasty", "Premier League Rebuild", "Klopp Era"]], ["Manchester City", ["Founding Years", "First Division Era", "Abu Dhabi Era", "Modern Era"]], ["Manchester United", ["Busby Babes", "Ferguson Dynasty", "Post-Ferguson Era"]], ["Tottenham Hotspur", ["Early Years", "Bill Nicholson Era", "Modern Era"]]]],
    ["La Liga", [["Barcelona", ["Founding Years", "Cruyff and Dream Team", "Guardiola Era", "Modern Era"]], ["Real Madrid", ["Early Years", "Di Stéfano Era", "Galácticos Era", "Modern Era"]], ["Atlético Madrid", ["Early Years", "Simeone Era", "Modern Era"]], ["Athletic Bilbao", ["Founding Years", "Basque Policy Era", "Modern Era"]]]],
    ["Bundesliga", [["Bayern Munich", ["Founding Years", "Beckenbauer Era", "Heynckes Era", "Modern Dynasty"]], ["Borussia Dortmund", ["Founding Years", "Hitzfeld Era", "Klopp Era", "Modern Era"]], ["Bayer Leverkusen", ["Founding Years", "Neverkusen Era", "2024 Championship"]], ["Schalke 04", ["Founding Years", "Ruhr Rivalry Era", "Modern Era"]]]],
    ["Serie A", [["Juventus", ["Founding Years", "Trapattoni Era", "Calciopoli", "Modern Era"]], ["AC Milan", ["Gre-No-Li Era", "Sacchi Dynasty", "Ancelotti Era", "Modern Era"]], ["Inter Milan", ["Founding Years", "Grande Inter", "Treble Era", "Modern Era"]], ["Roma", ["Founding Years", "Totti Era", "Modern Era"]]]],
    ["Ligue 1", [["Paris Saint-Germain", ["Founding Years", "QSI Era", "Modern Era"]], ["Olympique de Marseille", ["Founding Years", "1993 Champions League", "Modern Era"]], ["Lyon", ["Founding Years", "Seven-Time Dynasty", "Modern Era"]], ["Monaco", ["Founding Years", "1990s Era", "Modern Era"]]]],
    ["Major League Soccer", [["LA Galaxy", ["Founding Years", "Beckham Era", "Modern Era"]], ["Seattle Sounders", ["MLS Arrival", "2010s Championships", "Modern Era"]], ["Atlanta United", ["Founding Years", "2018 Championship", "Modern Era"]], ["Inter Miami", ["Founding Years", "Messi Era"]]]]
];
const SOCCER_PLAYERS = ["Pelé", "Lionel Messi", "Diego Maradona", "Cristiano Ronaldo", "Johan Cruyff", "Franz Beckenbauer", "Zinedine Zidane", "Ronaldo Nazário", "Alfredo Di Stéfano", "Michel Platini", "Ferenc Puskás", "Garrincha", "George Best", "Paolo Maldini", "Xavi", "Andrés Iniesta", "Ronaldinho", "Eusébio", "Bobby Charlton", "Lev Yashin"];
const SOCCER_AWARDS = ["Ballon d'Or", "FIFA World Cup Golden Ball", "Golden Boot", "UEFA Player of the Year", "FIFA World Player of the Year", "UEFA Champions League Records", "World Cup Records", "Manager of the Year"];
const CRICKET_NATIONAL_TEAMS = [
    ["Australia", ["Early Test Cricket", "Bradman Era", "World Series Cricket", "Ponting Era", "Modern Era"]], ["England", ["Early Test Cricket", "Bodyline Series", "1980s Rebuild", "Bazball Era", "Modern Era"]], ["India", ["Early Test Cricket", "Gavaskar Era", "1983 World Cup", "Tendulkar and Ganguly Era", "Kohli Era", "Modern Era"]], ["New Zealand", ["Early Test Cricket", "Hadlee Era", "2015 and 2019 World Cups", "Modern Era"]], ["Pakistan", ["Early Test Cricket", "Hanif Mohammad Era", "Imran Khan World Cup", "Wasim and Waqar Era", "Modern Era"]], ["South Africa", ["Early Test Cricket", "Isolation Years", "Return to International Cricket", "Modern Era"]], ["Sri Lanka", ["Early Test Cricket", "1996 World Cup", "Murali Era", "Modern Era"]], ["West Indies", ["Early Test Cricket", "Sobers Era", "Clive Lloyd Dynasty", "T20 Era", "Modern Era"]], ["Bangladesh", ["Associate Years", "Test Status", "2015 World Cup", "Modern Era"]], ["Afghanistan", ["Associate Years", "Full Member Era", "Modern Era"]], ["Zimbabwe", ["Early Test Cricket", "1999 World Cup", "Modern Era"]], ["Ireland", ["Associate Years", "2011 World Cup", "Test Status", "Modern Era"]]
];
const CRICKET_FORMATS = ["Test Cricket", "One Day Internationals", "Twenty20 Internationals", "First-Class Cricket", "List A Cricket", "Twenty20 Cricket", "The Hundred", "T10 Cricket"];
const IPL_TEAMS = [["Chennai Super Kings", ["Founding Years", "2008–2013 Core", "2018 Return", "Modern Era"]], ["Delhi Capitals", ["Delhi Daredevils Years", "2019 Rebrand", "Modern Era"]], ["Gujarat Titans", ["Expansion Years", "2022 Championship", "Modern Era"]], ["Kolkata Knight Riders", ["Founding Years", "2012 and 2014 Championships", "Modern Era"]], ["Lucknow Super Giants", ["Expansion Years", "Modern Era"]], ["Mumbai Indians", ["Founding Years", "2013–2020 Dynasty", "Modern Era"]], ["Punjab Kings", ["Kings XI Punjab Years", "2008 Final", "Rebrand Era"]], ["Rajasthan Royals", ["2008 Inaugural Championship", "Rebuilding Years", "2022 Final"]], ["Royal Challengers Bengaluru", ["Founding Years", "Three Finals Era", "Modern Era"]], ["Sunrisers Hyderabad", ["Founding Years", "2016 Championship", "Modern Era"]]];
const CRICKET_BEST_PLAYERS = ["Don Bradman", "Sachin Tendulkar", "Garfield Sobers", "Shane Warne", "Muttiah Muralitharan", "Jacques Kallis", "Viv Richards", "Brian Lara", "Wasim Akram", "Imran Khan", "Ricky Ponting", "Kumar Sangakkara", "Virat Kohli", "MS Dhoni", "AB de Villiers", "Glenn McGrath", "Wasim Bari", "Kapil Dev", "Sunil Gavaskar", "Babar Azam", "Ben Stokes", "Joe Root", "James Anderson", "Kane Williamson", "Steve Smith", "Lasith Malinga", "Adam Gilchrist", "Matthew Hayden", "Chris Gayle", "Dale Steyn"];
const OTHER_SPORTS = [
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
function buildSportsTopic() {
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
exports.TELEVISION_MUSIC_SPORTS_CATALOG_METADATA = {
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
};
function buildTelevisionMusicSportsTopics() {
    return [buildTelevisionTopic(), buildMusicTopic(), buildSportsTopic()];
}

},
"history-science-taxonomy-catalog":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHumanOriginsTopic = buildHumanOriginsTopic;
exports.buildGeologyTopic = buildGeologyTopic;
exports.buildOrganismsTopic = buildOrganismsTopic;
const branch = (label, children, aliases = []) => ({
    label,
    children,
    ...(aliases.length ? { aliases } : {})
});
const leaf = (label, aliases = []) => branch(label, [], aliases);
/**
 * Fossil ranges are incomplete and taxonomic boundaries are debated. The order
 * below follows the latest generally reported occurrence where possible, while
 * preserving the user's requested first three Homo topics. Debated and
 * historical Homo names are grouped separately rather than implying that all
 * are accepted species or have comparable date ranges.
 */
function buildHumanOriginsTopic() {
    return branch("Human Origins and Evolution", [
        branch("Archaeological Ages and Periods", [
            branch("Stone Age", [
                branch("Paleolithic", ["Lower Paleolithic", "Middle Paleolithic", "Upper Paleolithic"], ["Palaeolithic"]),
                leaf("Mesolithic", ["Epipaleolithic"]),
                branch("Neolithic", ["Agriculture and Domestication", "Permanent Settlements", "Pottery and Weaving", "Megalithic Sites"])
            ]),
            branch("Copper Age (Chalcolithic)", ["Early Copper Age", "Late Copper Age"], ["Chalcolithic", "Eneolithic"]),
            branch("Bronze Age", [
                "Early Bronze Age",
                "Middle Bronze Age",
                branch("Late Bronze Age", [
                    leaf("Bronze Age Collapse", ["Late Bronze Age Collapse"]),
                    "Late Bronze Age Trade and Diplomacy",
                    "Late Bronze Age Kingdoms"
                ])
            ]),
            branch("Iron Age", ["Early Iron Age", "Late Iron Age", "Iron Age Technologies"]),
            branch("Regional Archaeological Chronologies", [
                "African Archaeological Chronologies",
                "Near Eastern Archaeological Chronologies",
                "South and East Asian Archaeological Chronologies",
                "European Archaeological Chronologies",
                "Mesoamerican and Andean Archaeological Chronologies",
                "Oceanian Archaeological Chronologies"
            ])
        ]),
        branch("Hominin Genera and Species", [
            branch("Homo", [
                leaf("Homo sapiens", ["Early Homo sapiens", "Homo idaltu", "Homo sapiens idaltu"]),
                leaf("Homo neanderthalensis", ["Neanderthals"]),
                leaf("Homo erectus", ["Pithecanthropus erectus", "Sinanthropus pekinensis", "Homo pekinensis", "Homo soloensis"]),
                leaf("Homo luzonensis"),
                leaf("Homo floresiensis", ["Flores Man", "the Hobbit"]),
                leaf("Denisovan fossils and populations (Homo sp.; placement debated)", ["Denisovans", "Homo altaiensis"]),
                leaf("Homo juluensis (proposed classification)"),
                leaf("Homo longi (classification debated)"),
                leaf("Homo heidelbergensis (classification debated)"),
                leaf("Homo naledi"),
                leaf("Homo helmei (classification debated)"),
                leaf("Homo rhodesiensis (classification debated)"),
                leaf("Homo cepranensis (classification debated)"),
                leaf("Homo mauritanicus (historical classification)"),
                leaf("Homo antecessor"),
                leaf("Homo ergaster (often grouped with Homo erectus)"),
                leaf("Homo habilis"),
                leaf("Homo georgicus (often grouped with Homo erectus)"),
                leaf("Homo rudolfensis"),
                branch("Other Named or Historical Homo Taxa (status disputed)", [
                    leaf("Homo bodoensis (proposed classification)"),
                    leaf("Homo gautengensis (proposed; classification debated)"),
                    leaf("Homo narmadensis (proposed; status disputed)"),
                    leaf("Homo tsaichangensis (proposed; status disputed)"),
                    leaf("Homo njarasensis (historical name)"),
                    leaf("Homo saldanensis (historical name)"),
                    leaf("Homo steinheimensis (historical name)"),
                    leaf("Homo mousteriensis (historical name)"),
                    leaf("Homo primigenius (historical name)"),
                    leaf("Homo antiquus (historical name)"),
                    leaf("Homo spelaeus (historical name)")
                ])
            ], ["Homo genus"]),
            branch("Paranthropus", [
                leaf("Paranthropus robustus"),
                leaf("Paranthropus boisei"),
                leaf("Paranthropus aethiopicus")
            ]),
            branch("Australopithecus", [
                leaf("Australopithecus sediba"),
                leaf("Australopithecus africanus"),
                leaf("Australopithecus garhi"),
                leaf("Australopithecus afarensis"),
                leaf("Australopithecus bahrelghazali (classification debated)"),
                leaf("Australopithecus deyiremeda (classification debated)"),
                leaf("Australopithecus prometheus (proposed; classification debated)"),
                leaf("Australopithecus anamensis")
            ], ["Australopithecines"]),
            branch("Kenyanthropus", [leaf("Kenyanthropus platyops")]),
            branch("Ardipithecus", [
                leaf("Ardipithecus ramidus"),
                leaf("Ardipithecus kadabba")
            ]),
            branch("Orrorin", [leaf("Orrorin tugenensis")]),
            branch("Sahelanthropus", [leaf("Sahelanthropus tchadensis")])
        ]),
        branch("Human Evolution and Culture", [
            leaf("Human Evolution"),
            "Human Migration",
            "Stone Tools",
            "Fire",
            "Hunting",
            "Clothing",
            "Cave Art",
            "Ancient DNA",
            "Extinct Human Relatives"
        ])
    ]);
}
function buildGeologyTopic() {
    return branch("Geology", [
        branch("Geologic Processes", [
            "Plate Tectonics", "Volcanoes", "Earthquakes", "Weathering and Erosion", "Rock Cycle",
            "Mountain Building", "Faults and Folds", "Sedimentation", "Landslides", "Glaciation"
        ]),
        branch("Earth Materials", [
            "Minerals", "Rocks", "Igneous Rocks", "Sedimentary Rocks", "Metamorphic Rocks", "Ores",
            "Crystals and Gemstones", "Soils"
        ]),
        branch("Earth Structure", ["Earth's Crust", "Earth's Mantle", "Earth's Core", "Earth's Interior", "Geothermal Systems"]),
        branch("Historical Geology", [
            "Earth's Formation", "Geologic Time Scale", "Stratigraphy", "Fossils and the Rock Record",
            "Continental Drift", "Ancient Supercontinents", "Mass Extinctions"
        ]),
        branch("Applied and Regional Geology", [
            "Economic Geology", "Engineering Geology", "Hydrogeology", "Geologic Maps", "Caves and Karst",
            "Geology of the Ocean Floor", "Planetary Geology"
        ])
    ]);
}
function buildOrganismsTopic() {
    return branch("Organisms", [
        branch("Animals", [
            branch("Invertebrates", [
                branch("Arthropods", [
                    branch("Insects", ["Ants", "Bees and Wasps", "Beetles", "Butterflies and Moths", "Dragonflies", "Grasshoppers", "Termites"]),
                    "Arachnids", "Crustaceans", "Centipedes and Millipedes"
                ]),
                "Mollusks", "Worms", "Cnidarians", "Echinoderms", "Sponges"
            ]),
            branch("Vertebrates", [
                branch("Mammals", [
                    branch("Cats", ["Lions", "Tigers", "Leopards", "Jaguars", "Cheetahs", "Domestic Cats"]),
                    branch("Elephants", ["African Savanna Elephants", "African Forest Elephants", "Asian Elephants"]),
                    branch("Canids", ["Wolves", "Foxes", "Coyotes", "Domestic Dogs"]),
                    branch("Primates", ["Great Apes", "Monkeys", "Lemurs", "Tarsiers"]),
                    "Bears", "Cetaceans", "Bats", "Hoofed Mammals", "Marsupials", "Monotremes", "Pangolins", "Other Mammals"
                ]),
                branch("Birds", ["Raptors", "Waterfowl", "Seabirds", "Songbirds", "Parrots", "Penguins", "Other Birds"]),
                branch("Reptiles", ["Crocodilians", "Turtles", "Lizards", "Snakes", "Tuataras"]),
                branch("Amphibians", ["Frogs and Toads", "Salamanders", "Caecilians"]),
                branch("Fish", ["Sharks and Rays", "Bony Fish", "Jawless Fish"])
            ])
        ]),
        branch("Plants", [
            branch("Flowering Plants", ["Grasses", "Orchids", "Roses", "Trees", "Carnivorous Plants"]),
            "Conifers", "Ferns and Horsetails", "Mosses and Liverworts", "Plant Evolution", "Plant Adaptations"
        ]),
        branch("Non-Animal and Non-Plant Organisms", [
            branch("Fungi", ["Mushrooms", "Molds", "Yeasts", "Lichens"]),
            branch("Bacteria", ["Cyanobacteria", "Extremophilic Bacteria", "Nitrogen-Fixing Bacteria", "Other Bacteria"]),
            branch("Archaea", ["Methanogens", "Halophiles", "Thermophiles"]),
            branch("Protists", ["Amoebae", "Ciliates", "Flagellates", "Other Protists"]),
            branch("Algae", ["Green Algae", "Red Algae", "Brown Algae", "Diatoms"])
        ])
    ]);
}

},
"topic-suggestions":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_SEARCH_VERSION = void 0;
exports.normalizeCustomTopicLabel = normalizeCustomTopicLabel;
exports.createCustomTopicId = createCustomTopicId;
exports.validateTopicPlan = validateTopicPlan;
exports.localTopicPlan = localTopicPlan;
exports.shouldEnrichTopics = shouldEnrichTopics;
exports.topicSearchRecords = topicSearchRecords;
exports.diffTopicSearchRecords = diffTopicSearchRecords;
exports.createTopicSuggestionIndex = createTopicSuggestionIndex;
exports.updateTopicSuggestionIndex = updateTopicSuggestionIndex;
exports.searchTopicIndex = searchTopicIndex;
exports.suggestTopics = suggestTopics;
exports.searchTopicIndexYielding = searchTopicIndexYielding;
const search_1 = require("./search");
exports.TOPIC_SEARCH_VERSION = 8;
/** Compare user-created topic labels without turning punctuation into collisions. */
function normalizeCustomTopicLabel(label) {
    return label.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}
/** Make a readable custom-topic ID, adding a suffix when punctuation shares a slug. */
function createCustomTopicId(label, existingIds) {
    const base = `custom-${label.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "topic"}`;
    const ids = new Set(existingIds);
    if (!ids.has(base))
        return base;
    let suffix = 2;
    while (ids.has(`${base}-${suffix}`))
        suffix += 1;
    return `${base}-${suffix}`;
}
const STOP = new Set("a about an and are as at be by can did do does explain find for from how i in into is it me of on or our please show some that the their them there these this to was were what when where which who why with would tell topics learn learning want know".split(" "));
const CONCEPTS = [
    { label: "information technology", equivalents: ["information technology", "computer technology"], related: ["computer science"] },
    { label: "earthquakes", equivalents: ["earthquake", "earthquakes", "quake", "quakes", "tremors", "ground shaking", "shaking ground", "ground shake", "seismic activity", "earth tremor"], related: ["plate tectonics", "geology", "tsunamis", "faults", "seismic waves"] },
    { label: "volcanoes", equivalents: ["volcano", "volcanoes", "volcanic eruption", "erupting mountain", "molten rock", "lava flow", "magma", "ash cloud", "volcanology"], related: ["geology", "plate tectonics", "natural disasters"] },
    { label: "paleontology", equivalents: ["paleontology", "fossils", "fossil record", "fossil hunting", "prehistoric creatures", "ancient life", "extinct animals"], related: ["dinosaurs", "evolution", "mass extinctions", "archaeology"] },
    { label: "ancient dna", equivalents: ["ancient dna", "ancient genetics", "old human dna", "genetic ancestry"], related: ["genetics", "human origins", "archaeology", "evolution"] },
    { label: "extraterrestrial life", equivalents: ["extraterrestrial life", "life beyond earth", "alien life", "life on other planets", "search for extraterrestrial life"], related: ["astronomy", "space exploration", "planets", "astrophysics"] },
    { label: "astronomy", equivalents: ["astronomy", "outer space", "the cosmos"], related: ["space exploration", "astrophysics", "spaceflight"] },
    { label: "gravitational lensing", equivalents: ["gravitational lensing", "bending starlight", "light bending", "gravity bends light"], related: ["astrophysics", "astronomy", "general relativity", "gravity"] },
    { label: "psychology", equivalents: ["psychology", "human behavior", "how people think", "people think", "the mind", "mental processes"], related: ["cognitive science", "neuroscience", "philosophy of mind"] },
    { label: "climate change", equivalents: ["climate change", "climate crisis", "global warming", "rising temperatures", "changing climate"], related: ["climatology", "environmental science", "renewable energy", "conservation"] },
    { label: "artificial intelligence", equivalents: ["artificial intelligence", "machine intelligence", "thinking machines", "computer intelligence", "generative ai"], related: ["computer science", "robotics", "machine learning"] },
    { label: "economics", equivalents: ["economics", "how money works", "economic systems"], related: ["history of money", "finance", "economic history", "business"] },
    { label: "religion", equivalents: ["religion", "world religions", "spiritual traditions", "belief systems"], related: ["religious history", "philosophy", "mythology", "theology", "sacred texts"] },
    { label: "archaeology", equivalents: ["archaeology", "lost civilizations", "early human societies", "how societies began"], related: ["ancient history", "human origins", "anthropology"] },
    { label: "film", equivalents: ["film", "films", "movie", "movies", "cinema"], related: ["directors", "screenwriting"] },
    { label: "television", equivalents: ["television", "tv", "tv shows"], related: ["series"] },
    { label: "writers", equivalents: ["writers", "writer", "authors", "author", "novelists", "novelist"], related: ["poets", "literature", "essays"] },
    { label: "population", equivalents: ["population", "demography", "human population", "population growth"], related: ["migration", "urbanization"] },
    { label: "evolution", equivalents: ["evolution", "natural selection", "species evolve"], related: ["biology", "genetics", "darwin"] },
    { label: "japan", equivalents: ["japan", "japanese"], related: [] },
    { label: "united states", equivalents: ["united states", "usa", "american"], related: [] },
    { label: "united kingdom", equivalents: ["united kingdom", "uk", "british", "britain"], related: [] }
];
const wordCache = new Map();
const words = (s) => {
    const cached = wordCache.get(s);
    if (cached)
        return cached;
    const required = new Set((0, search_1.protectedSearchTerms)(s).flatMap(term => term.split(" ")));
    const result = (0, search_1.normalizeSearchText)(s).split(" ").filter(w => required.has(w) || w.length > 1 && !STOP.has(w));
    if (wordCache.size >= 500)
        wordCache.delete(wordCache.keys().next().value);
    wordCache.set(s, result);
    return result;
};
const contains = (s, t) => Boolean(t) && (` ${s} `).includes(` ${t} `);
const fieldTokens = new Map();
const termCache = new Map();
function matches(s, t) {
    let term = termCache.get(t);
    if (!term) {
        term = { text: (0, search_1.normalizeSearchText)(t), tokens: (0, search_1.protectedSearchTerms)(t).includes((0, search_1.normalizeSearchText)(t)) ? (0, search_1.normalizeSearchText)(t).split(" ") : words(t) };
        termCache.set(t, term);
        if (termCache.size > 500)
            termCache.delete(termCache.keys().next().value);
    }
    if (contains(s, term.text))
        return true;
    if (!term.tokens.length)
        return false;
    let candidates = fieldTokens.get(s);
    if (!candidates) {
        candidates = s.split(" ");
        if (fieldTokens.size >= 100000)
            fieldTokens.clear();
        fieldTokens.set(s, candidates);
    }
    return term.tokens.every(w => candidates.includes(w) || w.length >= 5 && candidates.some(v => Math.abs(v.length - w.length) <= 2 && (v.startsWith(w) || w.startsWith(v))));
}
const conceptAliases = new Map(CONCEPTS.flatMap(c => c.equivalents.map(e => [(0, search_1.normalizeSearchText)(e), c.equivalents])));
const conceptsByPhrase = CONCEPTS.flatMap(c => c.equivalents.map(p => ({ phrase: (0, search_1.normalizeSearchText)(p), concept: c }))).sort((a, b) => b.phrase.length - a.phrase.length);
function validateTopicPlan(value) {
    const v = value;
    const clean = (a) => Array.isArray(a) ? Array.from(new Set(a.filter((x) => typeof x === "string").map(search_1.contextualSearchText).filter(x => x.length > 1 && x.length <= 120))).slice(0, 12) : [];
    return { groups: (Array.isArray(v?.groups) ? v.groups : []).slice(0, 8).flatMap(g => {
            if (!g || typeof g !== "object")
                return [];
            const equivalents = clean(g.equivalents);
            return equivalents.length ? [{ label: typeof g.label === "string" ? g.label.slice(0, 120) : equivalents[0], equivalents, related: clean(g.related) }] : [];
        }), alternatives: v?.alternatives === true };
}
function localTopicPlan(query) {
    query = (0, search_1.contextualSearchText)(query);
    const clauses = query.split(/\bor\b/i);
    if (clauses.length > 1) {
        const plans = clauses.map(localTopicPlan);
        const groups = plans.flatMap(p => p.groups);
        let offset = 0;
        const anyOf = plans.map(p => { const indices = p.groups.map((_, i) => offset + i); offset += p.groups.length; return indices; }).filter(a => a.length);
        return { groups, anyOf };
    }
    let remaining = (0, search_1.normalizeSearchText)(query);
    const groups = [];
    for (const term of (0, search_1.protectedSearchTerms)(query)) {
        groups.push({ label: term, equivalents: [term], related: [] });
        remaining = (` ${remaining} `).split(` ${term} `).join(" ").trim();
    }
    for (const { phrase, concept } of conceptsByPhrase)
        if (contains(remaining, phrase)) {
            if (!groups.includes(concept))
                groups.push(concept);
            remaining = (` ${remaining} `).split(` ${phrase} `).join(" ").trim();
        }
    for (const w of words(remaining))
        groups.push({ label: w, equivalents: [w], related: [] });
    return { groups, alternatives: /\bor\b/i.test(query) };
}
function shouldEnrichTopics(query, completeCoverage) { return (0, search_1.shouldExpandNaturalSearch)(query, completeCoverage); }
function geographicContext(value) { const s = (0, search_1.normalizeSearchText)(value); return /\b(tohoku|kanto|sanriku|kobe|tokyo|osaka|kyoto|fukushima|nankai)\b/.test(s) ? "japan japanese" : ""; }
/** Transfer searchable fields only; selection, expansion and weights never invalidate an index. */
function topicSearchRecords(nodes, parentPath = []) {
    return nodes.flatMap(node => {
        const path = [...parentPath, node.label];
        return [{ id: node.id, label: node.label, aliases: node.aliases, path }, ...topicSearchRecords(node.children ?? [], path)];
    });
}
function diffTopicSearchRecords(indexed, next) {
    const upserts = [], removeIds = [], ids = new Set();
    const previousOrder = indexed.keys();
    let orderChanged = indexed.size !== next.length;
    for (const topic of next) {
        ids.add(topic.id);
        if (previousOrder.next().value !== topic.id)
            orderChanged = true;
        const prior = indexed.get(topic.id);
        if (!prior || prior.label !== topic.label || prior.path.length !== topic.path.length || prior.path.some((value, i) => value !== topic.path[i]) ||
            (prior.aliases?.length ?? 0) !== (topic.aliases?.length ?? 0) || prior.aliases?.some((value, i) => value !== topic.aliases?.[i]))
            upserts.push(topic);
    }
    for (const id of indexed.keys())
        if (!ids.has(id))
            removeIds.push(id);
    return { upserts, removeIds, orderIds: orderChanged ? next.map(topic => topic.id) : undefined };
}
function topicSearchEntry(originalTopic) {
    const additions = (0, search_1.commonNameAliases)(originalTopic.label).filter(alias => !originalTopic.aliases?.includes(alias));
    const topic = additions.length ? { ...originalTopic, aliases: [...new Set([...(originalTopic.aliases ?? []), ...additions])] } : originalTopic;
    const fields = [topic.label, ...topic.aliases || [], topic.path.join(" ")].map(value => (0, search_1.searchTextForms)((0, search_1.contextualSearchText)(value)).join(" "));
    return { topic, fields, context: geographicContext(fields.join(" ")), order: 0 };
}
function orderTopicEntries(index, entries) {
    const pathIds = new Map(entries.map(entry => [entry.topic.path.join("\0"), entry.topic.id]));
    entries.forEach((entry, order) => {
        entry.order = order;
        entry.parent = pathIds.get(entry.topic.path.slice(0, -1).join("\0"));
    });
    index.entries = entries;
}
function createTopicSuggestionIndex(topics) {
    const entries = topics.map(topicSearchEntry);
    const index = { entries, byId: new Map(entries.map(e => [e.topic.id, e])) };
    orderTopicEntries(index, entries);
    return index;
}
/** Reuse normalized built-in and unchanged custom entries. Callers cancel old searches first. */
function updateTopicSuggestionIndex(index, upserts, removeIds, orderIds) {
    if (!removeIds.length && !orderIds && upserts.every(topic => {
        const prior = index.byId.get(topic.id)?.topic;
        return prior && prior.path.length === topic.path.length && prior.path.every((value, i) => value === topic.path[i]);
    })) {
        for (const topic of upserts) {
            const prior = index.byId.get(topic.id);
            const entry = { ...topicSearchEntry(topic), order: prior.order, parent: prior.parent };
            index.byId.set(topic.id, entry);
            index.entries[entry.order] = entry;
        }
        return;
    }
    for (const id of removeIds)
        index.byId.delete(id);
    for (const topic of upserts)
        index.byId.set(topic.id, topicSearchEntry(topic));
    const entries = orderIds ? orderIds.flatMap(id => { const entry = index.byId.get(id); return entry ? [entry] : []; }) : [...index.byId.values()];
    if (orderIds)
        index.byId = new Map(entries.map(entry => [entry.topic.id, entry]));
    orderTopicEntries(index, entries);
}
function rank(entry, query, plan) {
    const queryWords = words(query), q = (0, search_1.normalizeSearchText)(query);
    const direct = queryWords.length ? Math.max(...entry.fields.map((f, i) => contains(f, q) ? 600 - i * 80 : queryWords.every(w => matches(f, w)) ? 350 - i * 70 : 0), 0) : 0;
    let covered = 0, score = 0;
    const coveredGroups = new Set();
    const support = new Set();
    for (const [groupIndex, g] of plan.groups.entries()) {
        const equivalents = g.equivalents;
        let best = 0;
        for (const term of equivalents) {
            if (matches(entry.fields[0], term))
                best = Math.max(best, 160);
            else if (entry.fields.slice(1, -1).some(f => matches(f, term)))
                best = Math.max(best, 140);
            else if (matches(entry.fields[entry.fields.length - 1], term))
                best = Math.max(best, 100);
            else if (matches(entry.context, term))
                best = Math.max(best, 95);
        }
        if (best) {
            const fieldIndex = entry.fields.findIndex(f => equivalents.some(term => matches(f, term)));
            if (fieldIndex === 0)
                support.add(`Name: “${entry.topic.label}”`);
            else if (fieldIndex === entry.fields.length - 1)
                support.add(`Topic path: “${entry.topic.path.join(" → ")}”`);
            else if (fieldIndex > 0)
                support.add(`Alias: “${entry.topic.aliases?.[fieldIndex - 1]}”`);
            else
                support.add(`Geographic context: “${entry.topic.label}” (${entry.context})`);
            covered++;
            coveredGroups.add(groupIndex);
            score += best;
        }
        else if (g.related.some(t => entry.fields.slice(0, -1).some(f => matches(f, t))))
            score += 30;
    }
    const complete = plan.groups.length > 0 && (plan.anyOf?.length ? plan.anyOf.some(clause => clause.every(i => coveredGroups.has(i))) : plan.alternatives ? covered > 0 : covered === plan.groups.length);
    const clauses = plan.anyOf?.length ? plan.anyOf : plan.alternatives ? plan.groups.map((_, i) => [i]) : [plan.groups.map((_, i) => i)];
    const missingConcepts = clauses.map(clause => clause.filter(i => !coveredGroups.has(i))).sort((a, b) => a.length - b.length)[0] || [];
    return { entry, complete, direct, covered, support: [...support], matchedConcepts: [...coveredGroups], missingConcepts, score: score + (complete ? 10000 : 0) + covered * 500 + direct };
}
function finalize(index, query, ranked) {
    const byOrder = [...ranked];
    ranked.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);
    const direct = ranked.filter(r => r.direct > 0).slice(0, 10), used = new Set(direct.map(r => r.entry.topic.id));
    const anchors = ranked.filter(r => r.covered > 0 || r.score > 0).slice(0, 20);
    const related = ranked.filter(r => !used.has(r.entry.topic.id)).map(r => {
        let proximity = 0;
        if (!r.score)
            for (const a of anchors) {
                let shared = 0;
                while (shared < a.entry.topic.path.length && shared < r.entry.topic.path.length && a.entry.topic.path[shared] === r.entry.topic.path[shared])
                    shared++;
                if (shared >= 2)
                    proximity = Math.max(proximity, 15 + shared);
            }
        return { ...r, score: r.score || proximity };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.entry.order - b.entry.order).slice(0, 100 - direct.length);
    for (const r of related)
        used.add(r.entry.topic.id);
    let hash = 2166136261;
    for (const c of (0, search_1.normalizeSearchText)(query))
        hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    const fallback = [];
    const start = (hash >>> 0) % Math.max(1, index.entries.length);
    for (let i = 0; fallback.length + direct.length + related.length < 100 && i < index.entries.length; i++) {
        const entry = index.entries[(start + i * 7919) % index.entries.length];
        if (used.has(entry.topic.id))
            continue;
        used.add(entry.topic.id);
        fallback.push({ ...byOrder[entry.order], score: 0, direct: 0 });
    }
    // A stride may share factors with a custom catalog's size.
    for (const entry of index.entries) {
        if (fallback.length + direct.length + related.length >= 100)
            break;
        if (!used.has(entry.topic.id)) {
            used.add(entry.topic.id);
            fallback.push({ ...byOrder[entry.order], score: 0, direct: 0 });
        }
    }
    const suggest = (r, group) => ({ id: r.entry.topic.id, label: r.entry.topic.label, path: r.entry.topic.path, group: group === "related" && !r.complete ? "broader" : group, support: r.support, explanation: r.complete ? "Matches the requested concepts in the topic metadata." : r.support.length ? "Broader recommendation: matches only part of the query." : "Broader catalog recommendation; no direct metadata match.", coverage: { matchedConcepts: r.matchedConcepts, missingConcepts: r.missingConcepts, complete: r.complete } });
    const matched = ranked.filter(r => r.complete), visible = new Set(), ancestors = new Set();
    for (const { entry } of matched) {
        visible.add(entry.topic.id);
        let parent = entry.parent;
        while (parent) {
            visible.add(parent);
            ancestors.add(parent);
            parent = index.byId.get(parent)?.parent;
        }
    }
    return { suggestions: [...direct.map(r => suggest(r, "keyword")), ...related.map(r => suggest(r, "related")), ...fallback.map(r => suggest(r, "explore"))], matchedIds: matched.map(r => r.entry.topic.id), completeCoverage: matched.length > 0, visibleIds: [...visible], matchingDescendants: [...ancestors], directScores: matched.map(r => [r.entry.topic.id, r.score]) };
}
function enrichTopicGroup(group, enriched) {
    const equivalents = new Set(group.equivalents.flatMap(t => conceptAliases.get((0, search_1.normalizeSearchText)(t)) || [(0, search_1.normalizeSearchText)(t)]));
    const matches = enriched.filter(other => other.equivalents.some(t => equivalents.has((0, search_1.normalizeSearchText)(t))));
    const added = matches.flatMap(g => g.equivalents).filter(term => { const known = conceptAliases.get((0, search_1.normalizeSearchText)(term)); return !known || known.some(value => equivalents.has((0, search_1.normalizeSearchText)(value))); });
    return { ...group, equivalents: [...new Set([...group.equivalents, ...added])], related: [...group.related, ...matches.flatMap(g => g.related)] };
}
function planFor(query, enrichment) {
    const p = Array.isArray(enrichment) ? enrichment.length ? { groups: [{ label: "subject", equivalents: enrichment, related: [] }] } : localTopicPlan(query) : validateTopicPlan(enrichment);
    const original = localTopicPlan(query);
    // Each recognized idea remains a distinct requirement, even if enrichment combines them.
    const protectedGroups = original.groups.filter(g => CONCEPTS.includes(g));
    const enriched = p.groups.length ? p.groups : original.groups;
    const groups = original.anyOf?.length ? original.groups.map(group => enrichTopicGroup(group, enriched)) : [
        ...enriched.filter(group => !protectedGroups.some(original => original.equivalents.some(term => group.equivalents.includes((0, search_1.normalizeSearchText)(term))))),
        ...protectedGroups.map(group => enrichTopicGroup(group, enriched))
    ];
    return { groups: groups.map(g => ({ ...g, equivalents: Array.from(new Set(g.equivalents.flatMap(t => conceptAliases.get((0, search_1.normalizeSearchText)(t)) || [t]))) })), anyOf: original.anyOf, alternatives: false };
}
function searchTopicIndex(index, query, enrichment = []) {
    if (!query.trim())
        return { suggestions: [], matchedIds: [], completeCoverage: false, visibleIds: [], matchingDescendants: [], directScores: [] };
    query = (0, search_1.contextualSearchText)(query);
    const plan = planFor(query, enrichment);
    return finalize(index, query, index.entries.map(e => rank(e, query, plan)));
}
function suggestTopics(index, query, enrichment = []) { return searchTopicIndex(index, query, enrichment).suggestions; }
async function searchTopicIndexYielding(index, query, enrichment = [], isCurrent = () => true) {
    query = (0, search_1.contextualSearchText)(query);
    const plan = planFor(query, enrichment), ranked = [];
    for (let start = 0; start < index.entries.length; start += 400) {
        if (!isCurrent())
            return null;
        for (const e of index.entries.slice(start, start + 400))
            ranked.push(rank(e, query, plan));
        if (start + 400 < index.entries.length)
            await new Promise(r => setTimeout(r, 0));
    }
    return isCurrent() ? finalize(index, query, ranked) : null;
}

},
"search":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSearchText = normalizeSearchText;
exports.searchTextForms = searchTextForms;
exports.commonNameAliases = commonNameAliases;
exports.contextualSearchText = contextualSearchText;
exports.protectedSearchTerms = protectedSearchTerms;
exports.shouldExpandNaturalSearch = shouldExpandNaturalSearch;
exports.searchScoreNormalized = searchScoreNormalized;
exports.searchScore = searchScore;
exports.rankSearchResults = rankSearchResults;
/** Small, deterministic fuzzy matching helpers used by the local search UI. */
function foldSearchText(value, preserveHyphens = false) {
    const folded = value.replace(/[\u2010-\u2015\u2212]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(preserveHyphens ? /[^a-z0-9\u0080-\uFFFF-]+/g : /[^a-z0-9\u0080-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();
    return folded;
}
function normalizeSearchText(value) { return foldSearchText(value); }
/** Retain the compound spelling as well as its spaced search equivalent. */
function searchTextForms(value) {
    return [...new Set([foldSearchText(value, true), normalizeSearchText(value)])];
}
// Alternate spellings are search metadata, never additional catalog nodes.
const NAME_VARIANTS = [
    ["Fyodor Dostoevsky", "Fyodor Dostoyevsky", "Dostoevsky", "Dostoyevsky"],
    ["J.R.R. Tolkien", "J. R. R. Tolkien", "JRR Tolkien", "Tolkien"]
];
const nameKey = (value) => normalizeSearchText(value).replace(/\s/g, "");
const nameVariants = new Map(NAME_VARIANTS.flatMap(variants => variants.map(name => [nameKey(name), variants])));
function commonNameAliases(label) {
    return (nameVariants.get(nameKey(label)) ?? []).filter(name => name !== label);
}
const SHORT_ALIASES = {
    us: { expansion: "united states", context: /\b(?:united states|american|presidents?|congress|senate|constitution|elections?|politics|political|history|government|states|federal)\b/ },
    ai: { expansion: "artificial intelligence", context: /\b(?:artificial|intelligence|machine|learning|neural|models?|robots?|robotics|generative|algorithms?|computers?|automation|chatbots?|tools|ethics)\b/ },
    it: { expansion: "information technology", context: /\b(?:information|technology|computers?|networks?|networking|software|hardware|cybersecurity|security|support|infrastructure|systems|services|jobs|careers|departments?)\b/ }
};
/** Case alone is not disambiguation: require nearby domain words, not pronoun syntax. */
function contextualSearchText(value) {
    const text = foldSearchText(value, true);
    return text.replace(/\b(?:us|ai|it)\b/g, (token, offset) => {
        const alias = SHORT_ALIASES[token];
        const before = normalizeSearchText(text.slice(0, offset)).split(" ").slice(-3).join(" ");
        const after = normalizeSearchText(text.slice(offset + token.length)).split(" ").slice(0, 3).join(" ");
        if (token === "us" && (/\b(?:tell|show|teach|help|give|let|ask|makes?|made) us$/.test(before + " us") || /^(?:about|how|why|what|when|where|who|to|with|the|a|an)\b/.test(after)))
            return "";
        if (token === "it" && (/\b(?:does|did|do|is|was|were|can|could|will|would|has|have|had) it$/.test(before + " it") || /^(?:is|was|does|did|can|will|would|has|seems|means|works)\b/.test(after)))
            return "";
        return alias.context.test(before + " " + after) ? alias.expansion : "";
    }).replace(/\s+/g, " ").trim();
}
const compoundCache = new Map();
/** Keep prefixes and short components together before stop-word filtering. */
function protectedSearchTerms(value) {
    const cached = compoundCache.get(value);
    if (cached)
        return cached;
    const original = foldSearchText(value, true);
    const spaced = normalizeSearchText(value);
    const compounds = [...original.matchAll(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g)].map(match => normalizeSearchText(match[0]));
    const variants = [...spaced.matchAll(/\b(?:x ray|(?:non|post|pre|anti|pro|neo) [a-z0-9]+)\b/g)].map(match => match[0]);
    const terms = [...new Set([...compounds, ...variants])].sort((a, b) => b.length - a.length);
    if (compoundCache.size >= 500)
        compoundCache.delete(compoundCache.keys().next().value);
    compoundCache.set(value, terms);
    return terms;
}
const NATURAL_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "how", "i", "in", "into", "is", "it", "of", "on", "or", "the", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with", "explain", "find", "show", "tell", "please", "me", "learn", "understand", "video", "videos", "topics"]);
/** Coverage is authoritative: one complete match beats any number of weak recommendations. */
function shouldExpandNaturalSearch(query, completeCoverage = false) {
    if (completeCoverage)
        return false;
    const contentWords = normalizeSearchText(query).split(" ").filter(word => word.length > 1 && !NATURAL_SEARCH_STOP_WORDS.has(word));
    return contentWords.length >= 2;
}
function distance(left, right) {
    if (left === right)
        return 0;
    if (!left.length)
        return right.length;
    if (!right.length)
        return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[right.length];
}
function tokenScore(queryToken, textToken) {
    if (queryToken === textToken)
        return 20;
    if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken))
        return 13;
    const limit = queryToken.length >= 8 ? 2 : 1;
    return queryToken.length >= 4 && textToken.length >= 4 && distance(queryToken, textToken) <= limit ? 7 : 0;
}
function searchScoreNormalized(normalizedQuery, normalizedText) {
    if (!normalizedQuery || !normalizedText)
        return 0;
    if (normalizedText.includes(normalizedQuery))
        return 100 + normalizedQuery.length;
    const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
    const textTokens = normalizedText.split(" ").filter(Boolean);
    if (!queryTokens.length)
        return 0;
    let score = 0;
    let matched = 0;
    queryTokens.forEach((queryToken) => {
        const best = Math.max(...textTokens.map((textToken) => tokenScore(queryToken, textToken)), 0);
        if (best > 0) {
            matched += 1;
            score += best;
        }
    });
    if (!matched)
        return 0;
    const coverage = matched / queryTokens.length;
    if (coverage < (queryTokens.length > 1 ? 0.5 : 1))
        return 0;
    return score * coverage + (matched === queryTokens.length ? 12 : 0);
}
function searchScore(query, text) {
    return searchScoreNormalized(normalizeSearchText(query), normalizeSearchText(text));
}
function rankSearchResults(query, items, getText, limit = items.length) {
    return items
        .map((item, index) => ({ item, index, score: searchScore(query, getText(item)) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, limit)
        .map((entry) => entry.item);
}

},
"topic-tree":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleTopicSelection = exports.summarizeSelection = exports.selectionState = exports.selectedLeafTopics = exports.selectedLeafCount = exports.selectWeightedTopicPaths = exports.migrateTopicTree = exports.flattenTopics = void 0;
exports.updateTopicTree = updateTopicTree;
exports.collapseTopicBranches = collapseTopicBranches;
exports.removeTopicTree = removeTopicTree;
exports.clearTopicSelections = clearTopicSelections;
const topic_catalog_1 = require("./topic-catalog");
var topic_catalog_2 = require("./topic-catalog");
Object.defineProperty(exports, "flattenTopics", { enumerable: true, get: function () { return topic_catalog_2.flattenTopics; } });
Object.defineProperty(exports, "migrateTopicTree", { enumerable: true, get: function () { return topic_catalog_2.migrateTopicTree; } });
Object.defineProperty(exports, "selectWeightedTopicPaths", { enumerable: true, get: function () { return topic_catalog_2.selectWeightedTopicPaths; } });
Object.defineProperty(exports, "selectedLeafCount", { enumerable: true, get: function () { return topic_catalog_2.selectedLeafCount; } });
Object.defineProperty(exports, "selectedLeafTopics", { enumerable: true, get: function () { return topic_catalog_2.selectedLeafTopics; } });
Object.defineProperty(exports, "selectionState", { enumerable: true, get: function () { return topic_catalog_2.selectionState; } });
Object.defineProperty(exports, "summarizeSelection", { enumerable: true, get: function () { return topic_catalog_2.summarizeSelection; } });
Object.defineProperty(exports, "toggleTopicSelection", { enumerable: true, get: function () { return topic_catalog_2.toggleTopicSelection; } });
function updateTopicTree(nodes, id, update) {
    return (0, topic_catalog_1.updateTopicTreeById)(nodes, id, update);
}
function collapseTopicBranches(nodes) {
    let changed = false;
    const next = nodes.map((node) => {
        const children = node.children ? collapseTopicBranches(node.children) : node.children;
        if (!node.expanded && children === node.children)
            return node;
        changed = true;
        return (0, topic_catalog_1.preserveTopicSelectionStats)(node, { ...node, expanded: false, children });
    });
    return changed ? (0, topic_catalog_1.preserveTopicPathIndex)(nodes, next) : nodes;
}
function removeTopicTree(nodes, id) {
    let changed = false;
    const result = [];
    for (const node of nodes) {
        if (node.id === id) {
            changed = true;
            continue;
        }
        if (!node.children?.length) {
            result.push(node);
            continue;
        }
        const children = removeTopicTree(node.children, id);
        if (children !== node.children) {
            changed = true;
            result.push({ ...node, children });
        }
        else
            result.push(node);
    }
    return changed ? (0, topic_catalog_1.preserveTopicPathIndex)(nodes, result) : nodes;
}
function clearTopicSelections(nodes) {
    const cleared = nodes.map((node) => ({
        ...node,
        selected: false,
        children: node.children ? clearTopicSelections(node.children) : undefined
    }));
    return (0, topic_catalog_1.preserveTopicPathIndex)(nodes, cleared);
}

},
"topic-preferences":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactTopicPreferences = compactTopicPreferences;
exports.restoreTopicPreferences = restoreTopicPreferences;
const topic_catalog_1 = require("./topic-catalog");
const compactPreferencesByTree = new WeakMap();
function compactTopicPreferences(nodes) {
    const cached = compactPreferencesByTree.get(nodes);
    if (cached)
        return cached;
    const selected = [];
    const expanded = [];
    const weights = {};
    const custom = [];
    const visit = (items, parentSelected = false) => {
        for (const node of items) {
            if (node.custom) {
                custom.push(node);
                continue;
            }
            if (node.selected && !parentSelected)
                selected.push(node.id);
            if (node.expanded)
                expanded.push(node.id);
            if (node.weight !== 10)
                weights[node.id] = node.weight;
            visit(node.children ?? [], parentSelected || node.selected);
        }
    };
    visit(nodes);
    const compact = { format: "learned-media-topic-preferences-v1", selected, expanded, weights, custom };
    compactPreferencesByTree.set(nodes, compact);
    return compact;
}
function restoreTopicPreferences(value, collapseExpanded = false, catalogTopics) {
    if (!value || typeof value !== "object" || value.format !== "learned-media-topic-preferences-v1")
        return null;
    const preferences = value;
    const selected = new Set(Array.isArray(preferences.selected) ? preferences.selected : []);
    const expanded = new Set(Array.isArray(preferences.expanded) ? preferences.expanded : []);
    const weights = preferences.weights && typeof preferences.weights === "object" ? preferences.weights : {};
    const custom = Array.isArray(preferences.custom) ? preferences.custom : [];
    const sourceCatalog = catalogTopics ?? (0, topic_catalog_1.createCatalogTopics)();
    if (!collapseExpanded && !selected.size && !expanded.size && !Object.keys(weights).length) {
        return custom.length ? (0, topic_catalog_1.preserveTopicPathIndex)(sourceCatalog, [...sourceCatalog, ...custom]) : sourceCatalog;
    }
    const apply = (items, inheritedSelection = false) => {
        let changed = false;
        const result = items.map((node) => {
            const isSelected = inheritedSelection || selected.has(node.id);
            const children = node.children?.length ? apply(node.children, isSelected) : node.children;
            const nextSelected = children?.length ? children.every((child) => child.selected) : isSelected;
            const nextExpanded = !collapseExpanded && expanded.has(node.id);
            const storedWeight = weights[node.id];
            const nextWeight = Number.isFinite(storedWeight) ? storedWeight : node.weight;
            if (nextSelected === node.selected && nextExpanded === node.expanded && nextWeight === node.weight && children === node.children)
                return node;
            changed = true;
            return { ...node, selected: nextSelected, expanded: nextExpanded, weight: nextWeight, children };
        });
        return changed ? result : items;
    };
    const catalog = apply(sourceCatalog);
    const restored = custom.length ? [...catalog, ...custom] : catalog;
    return (0, topic_catalog_1.preserveTopicPathIndex)(sourceCatalog, restored);
}

},
"demo-data":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPLORE_CATEGORIES = exports.DEFAULT_SETTINGS = void 0;
exports.createDefaultTopics = createDefaultTopics;
const topic_catalog_1 = require("./topic-catalog");
exports.DEFAULT_SETTINGS = {
    obscurity: 5,
    displayMode: "picture-text",
    sentenceLength: 3,
    surpriseMe: false
};
function createDefaultTopics() {
    return (0, topic_catalog_1.createCatalogTopics)();
}
exports.EXPLORE_CATEGORIES = [
    { label: "History", description: "Forgotten inventions, turning points, and people", tone: "blue", topics: ["Ancient History", "History of Technology", "U.S. History"] },
    { label: "Science", description: "Explore the natural world and the ideas behind the systems we use every day", tone: "mint", topics: ["Biology", "Space", "Physics", "Computer Science"] },
    { label: "Geography", description: "Unusual places, borders, landscapes, and cities", tone: "sand", topics: ["Cities", "Rivers", "Biomes"] },
    { label: "Entertainment", description: "Stories, music, screens, and ideas people love", tone: "rose", topics: ["Literature", "Movies", "Television", "Music"] }
];

},
"card-search-text":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardSearchText = cardSearchText;
/** Search original text even when gradual reveal or an alternative is visible. */
function cardSearchText(card) {
    return `${card.hook ?? ''} ${card.title} ${card.body} ${card.topicPath.join(' ')} ${card.sources.map(source => source.title).join(' ')}`;
}

},
"youtube-policy":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPROVED_INDIVIDUAL_VIDEOS = exports.DEFAULT_YOUTUBE_RECENCY_PREFERENCES = exports.APPROVED_YOUTUBE_CHANNELS = exports.YOUTUBE_CATALOG_VERSION = exports.YOUTUBE_TOPICS = void 0;
exports.mergeYouTubeActivity = mergeYouTubeActivity;
exports.createYouTubeProgressStore = createYouTubeProgressStore;
exports.createYouTubeListMemo = createYouTubeListMemo;
exports.partitionYouTubeVideoResults = partitionYouTubeVideoResults;
exports.mergeYouTubeRecencyPreferences = mergeYouTubeRecencyPreferences;
exports.selectRandomVideos = selectRandomVideos;
exports.relatedYouTubeVideos = relatedYouTubeVideos;
exports.createYouTubeTopicPools = createYouTubeTopicPools;
exports.createYouTubeChannelPools = createYouTubeChannelPools;
exports.isApprovedYouTubeVideo = isApprovedYouTubeVideo;
exports.isYouTubeShortMetadata = isYouTubeShortMetadata;
function mergeYouTubeActivity(legacy = {}, canonical = {}) {
    const merged = { ...legacy, ...canonical };
    const uniqueStrings = (primary, secondary) => {
        const values = [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])];
        return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0)));
    };
    const savedIds = uniqueStrings(canonical.savedIds, legacy.savedIds);
    if (savedIds.length || Array.isArray(canonical.savedIds) || Array.isArray(legacy.savedIds))
        merged.savedIds = savedIds;
    const history = [
        ...(Array.isArray(canonical.history) ? canonical.history : []),
        ...(Array.isArray(legacy.history) ? legacy.history : [])
    ];
    const seenHistory = new Set();
    const mergedHistory = history.filter((entry) => {
        const id = typeof entry?.videoId === "string" ? entry.videoId : "";
        if (!id)
            return true;
        if (seenHistory.has(id))
            return false;
        seenHistory.add(id);
        return true;
    });
    if (mergedHistory.length || Array.isArray(canonical.history) || Array.isArray(legacy.history))
        merged.history = mergedHistory.slice(0, 200);
    for (const field of ["playbackPositions", "prioritizeRecentByChannel"]) {
        const before = legacy[field];
        const after = canonical[field];
        if (before && typeof before === "object" && !Array.isArray(before) || after && typeof after === "object" && !Array.isArray(after)) {
            merged[field] = { ...(before && typeof before === "object" && !Array.isArray(before) ? before : {}), ...(after && typeof after === "object" && !Array.isArray(after) ? after : {}) };
        }
    }
    return merged;
}
function scheduleYouTubeProgressFrame(callback) {
    if (typeof requestAnimationFrame === "function")
        return { kind: "animation", id: requestAnimationFrame(callback) };
    return { kind: "timeout", id: setTimeout(callback, 16) };
}
function cancelYouTubeProgressFrame(frame) {
    if (frame.kind === "animation" && typeof cancelAnimationFrame === "function")
        cancelAnimationFrame(frame.id);
    else
        clearTimeout(frame.id);
}
function createYouTubeProgressStore(initial, scheduleFrame = scheduleYouTubeProgressFrame, cancelFrame = cancelYouTubeProgressFrame) {
    let snapshot = initial;
    let latest = initial;
    let frame = null;
    const listeners = new Set();
    const flush = () => {
        frame = null;
        if (snapshot === latest)
            return;
        snapshot = latest;
        listeners.forEach((listener) => listener());
    };
    const publish = (next, immediate = false) => {
        const phaseChanged = next.phase !== latest.phase;
        latest = next;
        const terminal = next.phase === "idle" || next.phase === "complete" || next.phase === "paused" || next.phase === "error";
        if (immediate || phaseChanged || terminal) {
            if (frame)
                cancelFrame(frame);
            flush();
            return;
        }
        if (!frame)
            frame = scheduleFrame(flush);
    };
    const update = (change, immediate = false) => {
        publish(change(latest), immediate);
    };
    return {
        getSnapshot: () => snapshot,
        getLatest: () => latest,
        getServerSnapshot: () => initial,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        publish,
        update,
        flush
    };
}
function createYouTubeListMemo() {
    let previousKey;
    let previousValue;
    return (key, create) => {
        if (previousKey && previousKey.length === key.length && key.every((value, index) => Object.is(value, previousKey[index])))
            return previousValue;
        previousKey = key;
        previousValue = create();
        return previousValue;
    };
}
function partitionYouTubeVideoResults(videos, reasons) {
    let strong;
    let broader;
    for (let index = 0; index < videos.length; index += 1) {
        const video = videos[index];
        if (reasons?.[video.id]?.relevance === "broader") {
            if (!broader) {
                strong = videos.slice(0, index);
                broader = [];
            }
            broader.push(video);
        }
        else if (strong) {
            strong.push(video);
        }
    }
    return strong && broader ? { strong, broader } : { strong: videos, broader: [] };
}
exports.YOUTUBE_TOPICS = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"];
exports.YOUTUBE_CATALOG_VERSION = 5;
exports.APPROVED_YOUTUBE_CHANNELS = [
    { name: "History Matters", channelId: "UC22BdTgxefuvUivrjesETjg" },
    { name: "Election History", channelId: "UCKfTfhaihmkvdvPF5DSGaow" },
    { name: "Secret Base", channelId: "UCDRmGMSgrtZkOsh_NQl4_xw" },
    { name: "Geo History", channelId: "UC2Cl2g2xFTZoAEldxYVzQFg" },
    { name: "Great Books Explained", channelId: "UCSzITlgppFAIRbQGIwcInCA" },
    { name: "BooneU", channelId: "UC7ZwKfpjiQEaZpdPql7VVPA" },
    { name: "Joon Lee", channelId: "UC8Ks8V76mHziboEtTAwMV8A" },
    { name: "TLDR News Global", channelId: "UC-uhvujip5deVcEtLxnW8qg" },
    { name: "Mr. Beat", channelId: "UCmYesELO6axBrCuSpf7S9DQ" },
    { name: "The Generalist Papers", channelId: "UCN9UPjA8I-uwvAy0-N9maOA" },
    { name: "CGP Grey", handle: "@CGPGrey", channelId: "UC2C_jShtL725hvbm1arSV9w" },
    { name: "Power Politics", channelId: "UCy0vqn9lOSWBToKU5ggTOUw" },
    { name: "Half as Interesting", channelId: "UCuCkxoKLYO_EQ2GeFtbM_bw" },
    { name: "Hoser", channelId: "UCAiEWppTvoNSHU939xhMb2g" },
    { name: "The History Guy: History Deserves to Be Remembered", channelId: "UC4sEmXUuWIFlxRIFBRV6VXQ" },
    { name: "History Buffs Hub", channelId: "UC2P1qb3jXoTnh3D16O1x7hQ" },
    { name: "Ceramic", handle: "@ceramic01", channelId: "UC01XCPlLs4ysH9LYs6Y4J6A" },
    { name: "Reading Through History", channelId: "UChyG2JVCWQACzzTbzS3Z3jg" },
    { name: "Atlas Pro", channelId: "UCz1oFxMrgrQ82-276UCOU9w" },
    { name: "African Biographics", channelId: "UCJmmxwdAsR7lD8fBA_qbEMw" },
    { name: "Phil Edwards", channelId: "UCb_MAhL8Thb3HJ_wPkH3gcw" },
    { name: "Tor’s Cabinet of Curiosities", channelId: "UC8oMvYlwaS7m5VpMwOTvgzw" },
    { name: "Extra History", channelId: "UCCODtTcd5M1JavPCOr_Uydg" },
    { name: "Justin Portela", channelId: "UChMicznKldDUO5vxIzu2L0w" },
    { name: "Patrick Kelly", handle: "@PatKellyTeaches", channelId: "UCXGtJRfZ_pmJgKKE67PeCEA" },
    { name: "Historically", channelId: "UCoZd78hRUdxxsuGiABuHF_A" },
    { name: "Mental Floss", channelId: "UCpZ5qUqpW4hW4zdfuBxMSJA" },
    { name: "Crash Course", handle: "@crashcourse", channelId: "UCX6b17PVsYBQ0ip5gyeme-Q", titleAliases: ["CrashCourse"] },
    { name: "SciShow", channelId: "UCZYTClx2T1of7BRZ86-8fow" },
    { name: "OverSimplified", channelId: "UCNIuvl7V8zACPpTmmNIqP2A" },
    { name: "vlogbrothers", channelId: "UCGaVdbSav8xWuFWTadK6loA" },
    { name: "Sam O’Nella Academy", channelId: "UC1DTYW241WD64ah5BFWn4JA" },
    { name: "3Blue1Brown", channelId: "UCYO_jab_esuFRV4b17AJtAw", playlistIds: ["PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"] },
    { name: "Shawn Grows", channelId: "UCzOXodveGcVO5xqLyc5l_Zg" },
    { name: "General Knowledge", channelId: "UCnD4jogYqIgUWY1ZYPU-Dew" },
    { name: "Jay Hona", channelId: "UCxSn-rKHu1FUFxjHyY1nKmw" },
    { name: "Veritasium", channelId: "UCHnyfMqiRRG1u-2MsSQLbXA" },
    { name: "theweeklyjack", handle: "@theweeklyjack1", channelId: "UCMWYB9dXQtv_1t_DgyhSWeg" },
    { name: "Jackdaw", handle: "@JackdawJPG", channelId: "UCvhjLch7MMc9O8toGFW0hSg" },
    { name: "Grist", handle: "@Grist", channelId: "UC7ga3FLMFOOpMQwaYoW42bw" },
    { name: "Bizarre Beasts", channelId: "UC9Lp_AA5M2cMGrlvnnIns-g" },
    { name: "Ze Frank", channelId: "UCVpankR4HtoAVtYnFDUieYA" },
    { name: "Make Thing With Hand", channelId: "UCP8HNHLFff9xAtKHS0a0qGQ" },
    { name: "Be Smart", channelId: "UCH4BNI0-FOK2dMXoFtViWHw" },
    { name: "PBS Eons", channelId: "UCzR-rom72PHN9Zg7RML9EbA" },
    { name: "Deep Look", channelId: "UC-3SbfTPJsL8fJAPKiVqBLg" },
    { name: "MinuteEarth", channelId: "UCeiYXex_fwgYDonaTcSIk6w" },
    { name: "minutephysics", channelId: "UCUHW94eEFW7hkUMVaZz4eDg" },
    { name: "Brailor", channelId: "UCufSP4vHIwEWyL5pQ_s1Geg" },
    { name: "hydn", channelId: "UCc2ujf1IwvhGv0co1FzkDkQ" },
    { name: "ExtinctZoo", handle: "@ExtinctZoo", channelId: "UC0ggS8bt4v7NiZpDfGqNpZQ" },
    { name: "PBS Terra", handle: "@pbsterra", channelId: "UCpxYSWgxVt3Pyn1ovXsGQ0g" },
    { name: "PolyMatter", handle: "@PolyMatter", channelId: "UCgNg3vwj3xt7QOrcIDaHdFg" },
    { name: "AlternateHistoryHub", handle: "@AlternateHistoryHub", channelId: "UClfEht64_NrzHf8Y0slKEjw" },
    { name: "J.J. McCullough", handle: "@JJMcCullough", channelId: "UCyhOl6uRlxryALlT5yifldw" },
    { name: "Primer", handle: "@PrimerBlobs", channelId: "UCKzJFdi57J53Vr_BkTfN3uQ" },
    { name: "Primal Space", handle: "@primalspace", channelId: "UClZbmi9JzfnB2CEb0fG8iew" },
    { name: "Mitsi Studio", handle: "@mitsistudio", channelId: "UCuXCgyOCMXic7j0_wghXnRA" },
    { name: "Jabroni Baseball", handle: "@JabroniBaseball", channelId: "UCfBXZotQqPlpDWXTbRbi2qA" }
];
exports.DEFAULT_YOUTUBE_RECENCY_PREFERENCES = Object.fromEntries(exports.APPROVED_YOUTUBE_CHANNELS.map(({ name }) => [name, name === "Crash Course" || name === "Mental Floss"]));
function mergeYouTubeRecencyPreferences(legacy = {}, activeWorkspace = {}) {
    const merged = { ...exports.DEFAULT_YOUTUBE_RECENCY_PREFERENCES };
    for (const preferences of [legacy, activeWorkspace]) {
        for (const [channel, enabled] of Object.entries(preferences))
            if (typeof enabled === "boolean")
                merged[channel] = enabled;
    }
    return merged;
}
exports.APPROVED_INDIVIDUAL_VIDEOS = [
    { creator: "melodysheep", title: "TIMELAPSE OF THE ENTIRE UNIVERSE", videoId: "TBikbn5XJhg" },
    { creator: "melodysheep", title: "TIMELAPSE OF THE UNIVERSE: 13 Billion Years in 10 Minutes • Updated and Remastered", videoId: "QTQVZuBV9oA" },
    { creator: "Ollie Bye", title: "The History of the World: Every Year", videoId: "-6Wu0Q7x5D0" },
    { creator: "Ollie Bye", title: "Top 5 Tallest Buildings Throughout History", videoId: "0MobSmVpvTM" },
    { creator: "Ollie Bye", title: "The Largest Cities Throughout History: Every Year", videoId: "kptMVQRud5c" },
    { creator: "Ollie Bye", title: "The Spread of Writing: Every Year", videoId: "eUpJ4yVCNrI" },
    { creator: "American Museum of Natural History", title: "Human Population Through Time (Updated in 2023)", videoId: "vJ5p3pZlBi4" }
];
const APPROVED_3BLUE_PLAYLIST_SOURCE_IDS = new Set((exports.APPROVED_YOUTUBE_CHANNELS.find((seed) => seed.name === "3Blue1Brown")?.playlistIds ?? []).map((id) => `playlist:${id}`));
function normalized(value) {
    return value.toLocaleLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function hasExplicitShortMarker(title, description, tags) {
    return /(?:^|[^a-z0-9])#shorts?\b/i.test(`${title}\n${description}`)
        || /\byoutube shorts?\b|\bshorts video\b/i.test(title)
        || tags.some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalized(tag)));
}
function isYouTubeShortMetadata(video) {
    if (hasExplicitShortMarker(video.title, video.description, video.tags))
        return true;
    // Shorts published before 15 October 2024 are limited to 60 seconds; later
    // Shorts can be up to three minutes. The Data API has no isShort field, so
    // combine that duration rule with the aspect ratio reported for thumbnails.
    const publishedAt = Date.parse(video.publishedAt);
    const threeMinuteShortsLaunch = Date.parse("2024-10-15T00:00:00Z");
    const maxShortDuration = publishedAt >= threeMinuteShortsLaunch ? 180 : 60;
    if (!Number.isFinite(publishedAt) || video.durationSeconds <= 0 || video.durationSeconds > maxShortDuration)
        return false;
    return (video.thumbnails ?? []).some((thumbnail) => {
        if (!thumbnail?.width || !thumbnail.height)
            return false;
        return thumbnail.width / thumbnail.height <= 1.05;
    });
}
const discoveryMetadata = new WeakMap();
function selectRandomVideos(videos, count, exclude = [], prioritizeRecentByChannel = {}) {
    const excluded = new Set(exclude);
    const extraRecentBias = new Set(Object.entries(prioritizeRecentByChannel).filter(([, enabled]) => enabled).map(([name]) => normalized(name)));
    const currentTime = Date.now();
    const yearInMs = 365.25 * 24 * 60 * 60 * 1000;
    const targetCount = Math.max(0, Math.floor(count));
    const recentPool = [];
    const olderPreferredPool = [];
    for (const video of videos) {
        if (excluded.has(video.id))
            continue;
        let metadata = discoveryMetadata.get(video);
        if (!metadata || metadata.publishedAt !== video.publishedAt || metadata.channelName !== video.channelName) {
            metadata = {
                publishedAt: video.publishedAt, channelName: video.channelName,
                timestamp: Date.parse(video.publishedAt), normalizedChannel: normalized(video.channelName)
            };
            discoveryMetadata.set(video, metadata);
        }
        const ageInYears = Number.isFinite(metadata.timestamp) ? Math.max(0, (currentTime - metadata.timestamp) / yearInMs) : 0;
        const recentBias = extraRecentBias.has(metadata.normalizedChannel);
        const candidate = { video, ageInYears, halfLifeInYears: recentBias ? 1.5 : 8 };
        if (recentBias && ageInYears > 5)
            olderPreferredPool.push(candidate);
        else
            recentPool.push(candidate);
    }
    // The feed needs only a small random sample from a potentially large
    // imported catalog. A full sort here made choosing the first 24 videos
    // increasingly expensive as the library grew. Keep only the best weighted
    // random keys in a max heap, which bounds work to O(library * log(sample)).
    const weightedSample = (pool, sampleCount) => {
        const limit = Math.min(pool.length, Math.max(0, sampleCount));
        if (!limit)
            return [];
        if (limit === pool.length)
            return pool.map(({ video }) => video);
        const heap = [];
        for (const { video, ageInYears, halfLifeInYears } of pool) {
            const recencyWeight = Math.pow(0.5, ageInYears / halfLifeInYears);
            const random = Math.max(Math.random(), Number.MIN_VALUE);
            const candidate = { video, randomKey: -Math.log(random) / recencyWeight };
            if (heap.length < limit) {
                let index = heap.push(candidate) - 1;
                while (index > 0) {
                    const parent = Math.floor((index - 1) / 2);
                    if (heap[parent].randomKey >= heap[index].randomKey)
                        break;
                    [heap[parent], heap[index]] = [heap[index], heap[parent]];
                    index = parent;
                }
                continue;
            }
            if (candidate.randomKey >= heap[0].randomKey)
                continue;
            heap[0] = candidate;
            let index = 0;
            while (true) {
                const left = index * 2 + 1;
                const right = left + 1;
                let largest = index;
                if (left < heap.length && heap[left].randomKey > heap[largest].randomKey)
                    largest = left;
                if (right < heap.length && heap[right].randomKey > heap[largest].randomKey)
                    largest = right;
                if (largest === index)
                    break;
                [heap[index], heap[largest]] = [heap[largest], heap[index]];
                index = largest;
            }
        }
        return heap.map(({ video }) => video);
    };
    const olderVideoLimit = olderPreferredPool.length ? Math.max(1, Math.ceil(targetCount / 24)) : 0;
    const recentVideos = weightedSample(recentPool, Math.max(0, targetCount - olderVideoLimit));
    const olderVideos = weightedSample(olderPreferredPool, Math.min(olderVideoLimit, targetCount - recentVideos.length));
    const selected = [...recentVideos, ...olderVideos];
    for (let index = selected.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [selected[index], selected[swap]] = [selected[swap], selected[index]];
    }
    return selected;
}
function relatedYouTubeVideos(videos, current, count = 6, prioritizeRecentByChannel = {}) {
    const shared = videos.filter((video) => video.id !== current.id && isApprovedYouTubeVideo(video) && video.topics.some((topic) => current.topics.includes(topic)));
    return selectRandomVideos(shared, count, [current.id], prioritizeRecentByChannel);
}
function createYouTubeTopicPools(videos) {
    const pools = new Map([["All", []]]);
    for (const video of videos) {
        if (!isApprovedYouTubeVideo(video))
            continue;
        pools.get("All").push(video);
        for (const topic of video.topics) {
            const matches = pools.get(topic) ?? [];
            matches.push(video);
            pools.set(topic, matches);
        }
    }
    return pools;
}
function createYouTubeChannelPools(videos) {
    const pools = new Map();
    for (const video of videos) {
        if (!isApprovedYouTubeVideo(video))
            continue;
        const matches = pools.get(video.channelId) ?? [];
        matches.push(video);
        pools.set(video.channelId, matches);
    }
    return pools;
}
function isApprovedYouTubeVideo(video) {
    if (!video.approved || hasExplicitShortMarker(video.title, video.description, video.tags ?? []))
        return false;
    if (normalized(video.channelName) === normalized("3Blue1Brown") || video.channelId === "UCYO_jab_esuFRV4b17AJtAw")
        return video.special === true || Boolean(video.sourceIds?.some((sourceId) => APPROVED_3BLUE_PLAYLIST_SOURCE_IDS.has(sourceId)));
    return true;
}

}},cache={};function load(name){if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};modules[name](module,module.exports,function(relative){const parts=name.split('/');parts.pop();for(const part of relative.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}return load(parts.join('/'));});return module.exports;}scope.LEARNED_MEDIA_SHARED=Object.assign({},load('topic-catalog'),load('topic-tree'),load('topic-preferences'),load('demo-data'),{search:load('search'),cards:load('card-search-text'),youtube:load('youtube-policy')});})(globalThis);
