import type { TopicNode } from "./types";
import { buildUnitedStatesPoliticalHistory, buildWorldPoliticalHistory, POLITICAL_TOPIC_LABEL_MIGRATIONS, POLITICAL_TOPIC_MIGRATIONS } from "./political-history-catalog";
import { buildDiseasesTopic } from "./disease-catalog";
import { buildComputerScienceTopic } from "./computer-science-catalog";
import { buildNaturalDisasterAndExtinctionTopics } from "./natural-disaster-catalog";
import { buildWarHistoryTopic } from "./war-history-catalog";
import { buildCompaniesTopic } from "./company-history-catalog";
import { buildMoviesTopic } from "./movie-catalog";
import { buildTelevisionMusicSportsTopics } from "./television-music-sports-catalog";
import { buildGeologyTopic, buildHumanOriginsTopic, buildOrganismsTopic } from "./history-science-taxonomy-catalog";

export const TOPIC_CATALOG_VERSION = 26;

export type TopicSeed = string | { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[]): TopicSeed => ({ label, children });
const series = (label: string, aliases: string[] = []): TopicSeed => ({ label, children: [], aliases });

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

// This expansion is kept as catalog data (rather than generated search results) so
// it is available offline, has stable path-based IDs, and can be migrated like
// every other topic. Repeated works are intentional when they fit more than one
// subject, but each placement remains a distinct contextual topic ID.
const BOOK_EXPANSION: TopicSeed[] = [
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
    "Moby-Dick", "The Count of Monte Cristo", "Don Quixote", "Frankenstein", "Dracula", "The Brothers Karamazov", "Great Expectations"
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

function bookSortKey(seed: TopicSeed) {
  const label = typeof seed === "string" ? seed : seed.label;
  const translated = label === "Paul et Virginie" ? "Paul and Virginia" : label;
  return englishLiteratureLabel(translated).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function orderBookSeeds(seeds: TopicSeed[]) {
  const order = new Map(BEST_SELLING_BOOK_ORDER.map((title, index) => [bookSortKey(title), index]));
  return seeds
    .map((seed, index) => ({ seed, index, rank: order.get(bookSortKey(seed)) ?? BEST_SELLING_BOOK_ORDER.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ seed }) => seed);
}

const REMOVED_BOOK_LIST_LABELS = new Set<string>();

function isEnglishBookTitle(seed: TopicSeed) {
  const title = typeof seed === "string" ? seed : seed.label;
  const englishTitle = englishLiteratureLabel(title);
  return /[A-Za-z]/.test(englishTitle)
    && /^[A-Za-z0-9\s'’.,:;!?&—–¾-]+$/.test(englishTitle);
}

function keepBookFromList(seed: TopicSeed) {
  return isEnglishBookTitle(seed);
}

const booksFromList = BOOK_EXPANSION.at(-1);
if (booksFromList && typeof booksFromList !== "string") {
  const keptBooks = booksFromList.children.filter((seed) => {
    if (keepBookFromList(seed)) return true;
    const title = typeof seed === "string" ? seed : seed.label;
    REMOVED_BOOK_LIST_LABELS.add(title.toLowerCase());
    const englishTitle = englishLiteratureLabel(title);
    if (englishTitle) REMOVED_BOOK_LIST_LABELS.add(englishTitle.toLowerCase());
    return false;
  });
  booksFromList.children = orderBookSeeds(keptBooks);
}

const BEST_SELLING_BOOK_SERIES: TopicSeed = branch("Best-Selling Book Series", [
  series("Harry Potter"), series("Goosebumps"), series("Perry Mason"), series("Diary of a Wimpy Kid"), series("Choose Your Own Adventure"), series("The Berenstain Bears"), series("Mr. Men and Little Miss"), series("Sweet Valley High"), series("Noddy"), series("Jack Reacher"), series("The Railway Series / Thomas & Friends"), series("Nancy Drew"), series("San-Antonio"), series("Robert Langdon"), series("Geronimo Stilton"), series("Percy Jackson & the Olympians"), series("The Baby-Sitters Club"), series("American Girl"), series("Twilight"), series("Star Wars"),
  series("One Piece"), series("Little Critter"), series("Peter Rabbit"), series("Fifty Shades"), series("Chicken Soup for the Soul"), series("Clifford the Big Red Dog"), series("Frank Merriwell"), series("Dirk Pitt"), series("Musashi", ["宮本武蔵"]), series("The Chronicles of Narnia"), series("SAS"), series("A Song of Ice and Fire"), series("The Hunger Games"), series("James Bond"), series("Martine"), series("Millennium"), series("The Wheel of Time"), series("Discworld"), series("Miffy", ["Nijntje"]), series("Alex Cross"), series("Anpanman", ["アンパンマン"]), series("Captain Underpants"), series("Fear Street"), series("Pippi Longstocking", ["Pippi Långstrump"]), series("The Vampire Chronicles"), series("OSS 117"), series("Winnie-the-Pooh"), series("Magic Tree House"), series("Left Behind"), series("A Series of Unfortunate Events"), series("Arthur"), series("Little House on the Prairie"), series("All Creatures Great and Small"), series("The Magic School Bus"), series("Where’s Wally?", ["Where's Wally?", "Where’s Waldo?", "Where's Waldo?"]), series("Men Are from Mars, Women Are from Venus"), series("The Hardy Boys"), series("The Bobbsey Twins"), series("Tarzan")
]);

/**
 * Sales totals and ordering are reported worldwide estimates, not audited
 * rankings. Keep the provenance with the catalog so both clients can explain
 * what the series branch represents without putting source text into searches.
 */
export const BEST_SELLING_BOOK_SERIES_METADATA = {
  sourceUrl: "https://en.wikipedia.org/wiki/List_of_best-selling_books#List_of_best-selling_book_series",
  sourceLabel: "Wikipedia's List of best-selling book series",
  verifiedAt: "2026-09-20",
  note: "Worldwide sales and rank are reported estimates."
} as const;

const FAMOUS_AUTHORS: TopicSeed = branch("Famous Authors", [
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

const WRITERS_BY_REGION: Array<[string, string[]]> = [
  ["United States", [
    "Benjamin Franklin", "Phillis Wheatley", "Washington Irving", "James Fenimore Cooper", "Edgar Allan Poe", "Nathaniel Hawthorne", "Herman Melville", "Henry David Thoreau", "Ralph Waldo Emerson", "Walt Whitman", "Emily Dickinson", "Mark Twain", "Henry James", "Kate Chopin", "Edith Wharton", "Willa Cather", "Robert Frost", "William Carlos Williams", "T. S. Eliot", "Wallace Stevens", "Zora Neale Hurston", "Langston Hughes", "William Faulkner", "F. Scott Fitzgerald", "Ernest Hemingway", "John Steinbeck", "Carson McCullers", "Richard Wright", "Ralph Ellison", "Flannery O'Connor", "J. D. Salinger", "Harper Lee", "James Baldwin", "Lorraine Hansberry", "Gwendolyn Brooks", "Sylvia Plath", "Allen Ginsberg", "James Agee", "Kurt Vonnegut", "Ray Bradbury", "Isaac Asimov", "Philip K. Dick", "Ursula K. Le Guin", "Octavia E. Butler", "Toni Morrison", "Maya Angelou", "Alice Walker", "Joyce Carol Oates", "Toni Cade Bambara", "John Updike", "Philip Roth", "Cormac McCarthy", "Don DeLillo", "Joan Didion", "bell hooks", "Sandra Cisneros", "Amy Tan", "Maxine Hong Kingston", "Louise Erdrich", "Louise Glück", "Rita Dove", "Audre Lorde", "Stephen King", "John Ashbery", "David Foster Wallace", "George Saunders", "Colson Whitehead", "Jesmyn Ward", "Ta-Nehisi Coates"
  ]],
  ["United Kingdom", [
    "Geoffrey Chaucer", "Thomas More", "William Shakespeare", "John Milton", "John Donne", "Daniel Defoe", "Jonathan Swift", "Samuel Johnson", "William Blake", "Jane Austen", "Walter Scott", "Mary Shelley", "William Wordsworth", "Samuel Taylor Coleridge", "Lord Byron", "Percy Bysshe Shelley", "John Keats", "Elizabeth Barrett Browning", "Christina Rossetti", "Charles Dickens", "Charlotte Brontë", "Emily Brontë", "Anne Brontë", "George Eliot", "Thomas Hardy", "Robert Louis Stevenson", "Arthur Conan Doyle", "H. G. Wells", "Rudyard Kipling", "Virginia Woolf", "E. M. Forster", "D. H. Lawrence", "Aldous Huxley", "George Orwell", "Evelyn Waugh", "Graham Greene", "J. R. R. Tolkien", "C. S. Lewis", "Agatha Christie", "Ian Fleming", "Anthony Burgess", "Doris Lessing", "Angela Carter", "Terry Pratchett", "J. K. Rowling", "Neil Gaiman", "Philip Pullman", "Kazuo Ishiguro", "Ian McEwan", "Hilary Mantel", "Zadie Smith", "Jeanette Winterson", "Bernardine Evaristo", "Alan Moore", "Kate Atkinson", "Malorie Blackman"
  ]],
  ["France", [
    "Christine de Pizan", "François Rabelais", "Michel de Montaigne", "Pierre Corneille", "Molière", "Jean Racine", "Madame de Lafayette", "Voltaire", "Denis Diderot", "Montesquieu", "Honoré de Balzac", "Victor Hugo", "Alexandre Dumas", "George Sand", "Stendhal", "Gustave Flaubert", "Charles Baudelaire", "Émile Zola", "Guy de Maupassant", "Jules Verne", "Arthur Rimbaud", "Paul Verlaine", "Marcel Proust", "Colette", "André Gide", "Antoine de Saint-Exupéry", "Jean-Paul Sartre", "Simone de Beauvoir", "Albert Camus", "Marguerite Yourcenar", "Marguerite Duras", "Aimé Césaire", "Annie Ernaux", "Patrick Modiano", "Leïla Slimani"
  ]],
  ["Italy", [
    "Dante Alighieri", "Francesco Petrarca", "Giovanni Boccaccio", "Niccolò Machiavelli", "Ludovico Ariosto", "Torquato Tasso", "Carlo Goldoni", "Ugo Foscolo", "Alessandro Manzoni", "Giacomo Leopardi", "Giovanni Verga", "Gabriele D'Annunzio", "Luigi Pirandello", "Italo Svevo", "Giuseppe Tomasi di Lampedusa", "Alberto Moravia", "Elsa Morante", "Primo Levi", "Natalia Ginzburg", "Cesare Pavese", "Italo Calvino", "Dario Fo", "Umberto Eco", "Andrea Camilleri", "Oriana Fallaci", "Gianni Rodari", "Elena Ferrante", "Roberto Saviano", "Dacia Maraini", "Alessandro Baricco"
  ]],
  ["Russia", [
    "Alexander Pushkin", "Mikhail Lermontov", "Nikolai Gogol", "Ivan Turgenev", "Fyodor Dostoevsky", "Leo Tolstoy", "Nikolai Leskov", "Ivan Goncharov", "Anton Chekhov", "Maxim Gorky", "Ivan Bunin", "Andrei Bely", "Yevgeny Zamyatin", "Isaac Babel", "Vladimir Mayakovsky", "Anna Akhmatova", "Marina Tsvetaeva", "Osip Mandelstam", "Boris Pasternak", "Mikhail Bulgakov", "Mikhail Sholokhov", "Andrei Platonov", "Varlam Shalamov", "Aleksandr Solzhenitsyn", "Joseph Brodsky", "Sergei Dovlatov", "Vasily Grossman", "Viktor Pelevin", "Lyudmila Ulitskaya", "Guzel Yakhina", "Yevgeny Yevtushenko", "Olga Slavnikova"
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

const WRITERS_BY_ERA: Array<[string, string[]]> = [
  ["Ancient and Classical", ["Homer", "Sappho", "Aeschylus", "Sophocles", "Euripides", "Virgil", "Ovid", "Herodotus", "Thucydides", "Confucius", "Laozi", "Zhuangzi", "Sun Tzu", "Valmiki", "Vyasa", "Kalidasa", "Qu Yuan", "Sima Qian"]],
  ["Medieval", ["Dante Alighieri", "Geoffrey Chaucer", "Rumi", "Ferdowsi", "Saadi Shirazi", "Hafez", "Murasaki Shikibu", "Sei Shōnagon", "Ibn Khaldun", "Christine de Pizan", "Li Bai", "Du Fu", "Omar Khayyam", "Wang Wei", "Kabir", "Mirabai", "Marie de France", "Nizami Ganjavi"]],
  ["Renaissance and Early Modern", ["William Shakespeare", "Miguel de Cervantes", "Niccolò Machiavelli", "Giovanni Boccaccio", "Molière", "Lope de Vega", "Teresa of Ávila", "Luís de Camões", "John Milton", "Ben Jonson", "John Donne", "Sor Juana Inés de la Cruz", "Matsuo Bashō", "François Rabelais", "Torquato Tasso", "Edmund Spenser", "Philip Sidney", "Mary Sidney"]],
  ["Eighteenth Century and Enlightenment", ["Voltaire", "Denis Diderot", "Montesquieu", "Jean-Jacques Rousseau", "Samuel Johnson", "Jonathan Swift", "Alexander Pope", "Mary Wollstonecraft", "Phillis Wheatley", "Olaudah Equiano", "Jane Austen", "Johann Wolfgang von Goethe", "William Blake", "Henry Fielding", "Daniel Defoe", "Benjamin Franklin", "Immanuel Kant", "Ann Radcliffe", "Frances Burney", "Mercy Otis Warren"]],
  ["Nineteenth Century", ["Jane Austen", "Mary Shelley", "Charlotte Brontë", "Emily Brontë", "Anne Brontë", "Charles Dickens", "George Eliot", "Thomas Hardy", "Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola", "Fyodor Dostoevsky", "Leo Tolstoy", "Anton Chekhov", "Alexander Pushkin", "Edgar Allan Poe", "Herman Melville", "Walt Whitman", "Emily Dickinson", "Mark Twain", "Jules Verne", "Henrik Ibsen", "Luigi Pirandello", "Rabindranath Tagore", "José Martí", "Machado de Assis", "Natsume Sōseki", "Hans Christian Andersen", "Oscar Wilde"]],
  ["Early Twentieth Century", ["James Joyce", "Virginia Woolf", "Marcel Proust", "Franz Kafka", "T. S. Eliot", "William Faulkner", "Ernest Hemingway", "D. H. Lawrence", "Lu Xun", "Rabindranath Tagore", "Federico García Lorca", "Boris Pasternak", "Mikhail Bulgakov", "Jorge Luis Borges", "Katherine Mansfield", "Rainer Maria Rilke", "Edith Wharton", "Zora Neale Hurston", "Nella Larsen", "Italo Svevo", "Yasunari Kawabata", "Fernando Pessoa", "Maya Angelou", "W. B. Yeats"]],
  ["Mid-Twentieth Century", ["George Orwell", "Albert Camus", "Simone de Beauvoir", "James Baldwin", "Chinua Achebe", "Toni Morrison", "Gabriel García Márquez", "Naguib Mahfouz", "Ursula K. Le Guin", "Octavia E. Butler", "Italo Calvino", "Primo Levi", "Pablo Neruda", "Derek Walcott", "Margaret Laurence", "Milan Kundera", "Mikhail Sholokhov", "Maya Angelou", "Flann O'Brien", "José Saramago", "Nadine Gordimer", "J. M. Coetzee", "Margaret Atwood", "Kurt Vonnegut"]],
  ["Contemporary", ["J. K. Rowling", "Margaret Atwood", "Kazuo Ishiguro", "Salman Rushdie", "Haruki Murakami", "Chimamanda Ngozi Adichie", "Zadie Smith", "Elena Ferrante", "Cixin Liu", "Mo Yan", "Orhan Pamuk", "Arundhati Roy", "Jhumpa Lahiri", "Ocean Vuong", "Han Kang", "Olga Tokarczuk", "Colson Whitehead", "Yaa Gyasi", "Tana French", "Sally Rooney", "Isabel Allende", "Roberto Bolaño", "Kiran Desai", "David Grossman", "Annie Ernaux", "George Saunders", "Eleanor Catton"]]
];

const WRITERS_SEED: TopicSeed = branch("Writers", [
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

const FAMOUS_SCIENTISTS: TopicSeed = branch("Famous Scientists", [
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

const PHILOSOPHY_SEED: TopicSeed = branch("Philosophy", [
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

const literatureChildren = (LITERATURE_SEED as { label: string; children: TopicSeed[] }).children;
const booksBranch = literatureChildren.find((child): child is { label: string; children: TopicSeed[] } => typeof child !== "string" && child.label === "Books");
booksBranch?.children.unshift(BOOK_EXPANSION[BOOK_EXPANSION.length - 1]);
booksBranch?.children.push(...BOOK_EXPANSION.slice(0, -1));
literatureChildren.push(BEST_SELLING_BOOK_SERIES, FAMOUS_AUTHORS);

const [TELEVISION_SEED, MUSIC_SEED, SPORTS_SEED] = buildTelevisionMusicSportsTopics();
const ENTERTAINMENT_SEED: TopicSeed = branch("Entertainment", [
  LITERATURE_SEED,
  WRITERS_SEED,
  PHILOSOPHY_SEED,
  SPORTS_SEED,
  buildMoviesTopic(),
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

const TOPIC_SEEDS: TopicSeed[] = [
  branch("History", [
    branch("United States", [
      buildUnitedStatesPoliticalHistory(),
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
    buildWorldPoliticalHistory(),
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
    buildHumanOriginsTopic(),
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
    buildWarHistoryTopic(),
    buildCompaniesTopic()
  ]),
  branch("Science", [
    buildComputerScienceTopic(),
    branch("Chemistry", ["Atoms", "Elements", "Periodic Table", "Chemical Bonds", "Reactions", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Biochemistry", "Materials Chemistry", "Electrochemistry", "Nuclear Chemistry", "Strange Chemical Properties", "Everyday Chemistry"]),
    branch("Biology", ["Evolution", "Genetics", "DNA", "Cells", "Microbiology", "Viruses", "Zoology", "Ecology", "Marine Biology", "Human Biology", "Anatomy", "Neuroscience", "Immunology", "Animal Behavior", "Extreme Organisms", "Symbiosis", buildOrganismsTopic()]),
    buildDiseasesTopic(),
    ...buildNaturalDisasterAndExtinctionTopics(),
    branch("Physics", ["Mechanics", "Motion", "Gravity", "Electricity", "Magnetism", "Waves", "Sound", "Light", "Thermodynamics", "Fluid Mechanics", "Quantum Physics", "Particle Physics", "Nuclear Physics", "Relativity", "Strange Physical Phenomena"]),
    branch("Natural History", ["Ancient DNA", "Volcanoes", "Earthquakes", "Paleontology"]),
    branch("Earth Science", [buildGeologyTopic(), "Oceans", "Atmosphere", "Weather", "Climate"]),
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

const LOWERCASE_TOPIC_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
const SCIENTIFIC_GENERA = new Set(["Ardipithecus", "Australopithecus", "Homo", "Kenyanthropus", "Orrorin", "Paranthropus", "Sahelanthropus"]);

/** Title Case is for catalog labels only; book and video titles keep their original styling. */
export function titleCaseTopicLabel(label: string) {
  const normalized = label.replace(/\s+/gu, " ").trim();
  const scientificName = normalized.match(/^([A-Z][a-z]+) ([a-z][a-z-]+)(?:\s|$)/u);
  if (scientificName && SCIENTIFIC_GENERA.has(scientificName[1])) return normalized;
  const words = normalized.split(/(\s+)/);
  const wordIndexes = words.map((word, index) => (/^\s+$/.test(word) ? -1 : index)).filter((index) => index >= 0);
  const first = wordIndexes[0];
  const last = wordIndexes.at(-1);
  return words.map((word, index) => {
    if (!word.trim()) return word;
    const isAcronymOrStyled = /^[A-Z0-9][A-Z0-9.+/#-]*$/.test(word) || /[a-z].*[A-Z]/.test(word);
    if (isAcronymOrStyled) return word;
    const lower = word.toLowerCase();
    if (index === first || index === last) return lower.charAt(0).toUpperCase() + lower.slice(1);
    if (LOWERCASE_TOPIC_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
}

function buildNode(seed: TopicSeed, parentPath: string[], depth: number, rootIndex: number): TopicNode | null {
  const label = (typeof seed === "string" ? seed : titleCaseTopicLabel(seed.label)).replace(/\s+/gu, " ").trim();
  if (!label) return null;
  const children = typeof seed === "string" ? undefined : seed.children;
  const path = [...parentPath, label];
  return {
    id: nodeId(path), label, selected: false, expanded: false,
    weight: 10,
    aliases: typeof seed === "string" ? undefined : seed.aliases,
    children: children?.map((child) => buildNode(child, path, depth + 1, rootIndex)).filter((child): child is TopicNode => Boolean(child))
  };
}

export function englishLiteratureLabel(label: string) {
  const translated: Record<string,string> = {
    "Paul et Virginie": "Paul and Virginia",
    "Rokusei Senjutsu (Six-Star Astrology) Tells Your Fortune": "Six-Star Astrology Tells Your Fortune",
    "六星占術によるあなたの運命 (Rokusei Senjutsu: Six-Star Astrology Tells Your Fortune)": "Six-Star Astrology Tells Your Fortune",
    "六星占術によるあなたの運命": "Six-Star Astrology Tells Your Fortune"
  };
  return (translated[label] ?? label.replace(/\s*\([^)]*\)/g, "")).normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\x00-\x7F’—–¾]/g, "").replace(/\s+/g, " ").trim();
}

export function createCatalogTopics(): TopicNode[] {
  // Keep original IDs and aliases while presenting English-only Literature labels.
  const clean = (node: TopicNode): TopicNode | null => {
    const label = englishLiteratureLabel(node.label);
    if (!label) return null;
    const children = node.children?.map(clean).filter((child): child is TopicNode => Boolean(child));
    return {...node, label, aliases: Array.from(new Set([...(node.aliases ?? []), node.label])), children};
  };
  return TOPIC_SEEDS.map((seed, index) => buildNode(seed, [], 0, index)).filter((node): node is TopicNode => Boolean(node)).map(node => node.label === "Literature" ? clean(node) : node).filter((node): node is TopicNode => Boolean(node));
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

export function migrateTopicTree(saved: TopicNode[] | undefined, collapseInitial = false, migrateLegacyRootWeights = false): TopicNode[] {
  if (!saved?.length) return createCatalogTopics();
  let next = createCatalogTopics();
  const fresh = flattenTopics(next);
  const byId = new Map(fresh.map(topic => [topic.id, topic]));
  const byPath = new Map(fresh.map((topic) => [topic.path.join("\u0000").toLowerCase(), topic]));
  const byLabel = new Map<string, typeof fresh>();
  const byAlias = new Map<string, typeof fresh>();
  fresh.forEach((topic) => byLabel.set(topic.label.toLowerCase(), [...(byLabel.get(topic.label.toLowerCase()) ?? []), topic]));
  fresh.forEach((topic) => (topic.aliases ?? []).forEach((alias) => byAlias.set(alias.toLowerCase(), [...(byAlias.get(alias.toLowerCase()) ?? []), topic])));
  const missingCustom = new Map<string, TopicNode>();
  const selectedIds = new Set<string>();
  const legacySeriesParents = new Map<string, { selected: boolean; weight?: number }>();
  const resolveMigratedPath = (path: string[]): (typeof fresh)[number] | undefined => {
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
    if (wasRemovedFromBookList) return;
    const migratedPath = POLITICAL_TOPIC_MIGRATIONS[key] ?? POLITICAL_TOPIC_LABEL_MIGRATIONS[oldTopic.label.toLowerCase()];
    const target = (migratedPath ? resolveMigratedPath(migratedPath) : undefined)
      ?? byId.get(oldTopic.id) ?? byPath.get(key)
      ?? (byLabel.get(oldTopic.label.toLowerCase())?.length === 1 ? byLabel.get(oldTopic.label.toLowerCase())?.[0] : undefined)
      ?? (byAlias.get(oldTopic.label.toLowerCase())?.length === 1 ? byAlias.get(oldTopic.label.toLowerCase())?.[0] : undefined);
    if (target) {
      const isLegacyBuiltInRoot = migrateLegacyRootWeights && oldTopic.path.length === 1 && [30, 25, 20, 25].includes(oldTopic.weight ?? 10);
      next = updateById(next, target.id, (node) => ({ ...node, weight: isLegacyBuiltInRoot ? 10 : (oldTopic.weight || node.weight), expanded: collapseInitial ? false : oldTopic.expanded }));
      if (oldTopic.selected) selectedIds.add(target.id);
      return;
    }
    const seriesParentPath = oldTopic.path.length > 3 && oldTopic.path[0] === "Literature" && oldTopic.path[1] === "Best-Selling Book Series" ? oldTopic.path.slice(0, 3).join("\u0000").toLowerCase() : undefined;
    if (seriesParentPath && !legacySeriesParents.has(seriesParentPath)) legacySeriesParents.set(seriesParentPath, { selected: Boolean(oldTopic.selected), weight: oldTopic.weight });
    if (migratedPath) return;
    if (oldTopic.custom || oldTopic.selected) {
      const customKey = oldTopic.label.toLowerCase();
      if (!missingCustom.has(customKey)) missingCustom.set(customKey, { id: `custom-${slug(oldTopic.label)}`, label: oldTopic.label, selected: oldTopic.selected, expanded: false, weight: oldTopic.weight || 10, custom: true });
    }
  });
  legacySeriesParents.forEach((legacy, path) => {
    const parent = byPath.get(path);
    if (!parent) return;
    next = updateById(next, parent.id, (node) => ({ ...node, selected: legacy.selected || node.selected, weight: legacy.weight || node.weight }));
    if (legacy.selected) selectedIds.add(parent.id);
  });
  selectedIds.forEach((id) => { next = updateById(next, id, (node) => setBranchSelected(node, true)); });
  return [...next, ...Array.from(missingCustom.values())];
}
