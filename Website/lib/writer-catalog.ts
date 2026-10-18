import type { TopicSeed } from "./topic-catalog";

const branch = (label: string, children: TopicSeed[]): TopicSeed => ({ label, children });

const WRITERS_BY_REGION: Array<[string, string[]]> = [
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

const WRITERS_BY_ERA: Array<[string, string[]]> = [
  ["Ancient and Classical", ["Homer", "Sappho", "Aeschylus", "Sophocles", "Euripides", "Virgil", "Ovid", "Herodotus", "Thucydides", "Confucius", "Laozi", "Zhuangzi", "Sun Tzu", "Valmiki", "Vyasa", "Kalidasa", "Qu Yuan", "Sima Qian"]],
  ["Medieval", ["Dante Alighieri", "Geoffrey Chaucer", "Rumi", "Ferdowsi", "Saadi Shirazi", "Hafez", "Murasaki Shikibu", "Sei Shōnagon", "Ibn Khaldun", "Christine de Pizan", "Li Bai", "Du Fu", "Omar Khayyam", "Wang Wei", "Kabir", "Mirabai", "Marie de France", "Nizami Ganjavi"]],
  ["Renaissance and Early Modern", ["William Shakespeare", "Miguel de Cervantes", "Niccolò Machiavelli", "Giovanni Boccaccio", "Molière", "Lope de Vega", "Teresa of Ávila", "Luís de Camões", "John Milton", "Ben Jonson", "John Donne", "Sor Juana Inés de la Cruz", "Matsuo Bashō", "François Rabelais", "Torquato Tasso", "Edmund Spenser", "Philip Sidney", "Mary Sidney", "Jean de La Fontaine"]],
  ["Eighteenth Century and Enlightenment", ["Voltaire", "Denis Diderot", "Montesquieu", "Jean-Jacques Rousseau", "Samuel Johnson", "Jonathan Swift", "Alexander Pope", "Mary Wollstonecraft", "Phillis Wheatley", "Olaudah Equiano", "Jane Austen", "Johann Wolfgang von Goethe", "William Blake", "Henry Fielding", "Daniel Defoe", "Benjamin Franklin", "Immanuel Kant", "Ann Radcliffe", "Frances Burney", "Mercy Otis Warren", "Robert Burns", "Denis Fonvizin", "Nikolay Karamzin"]],
  ["Nineteenth Century", ["Jane Austen", "Mary Shelley", "Charlotte Brontë", "Emily Brontë", "Anne Brontë", "Charles Dickens", "George Eliot", "Thomas Hardy", "Victor Hugo", "Alexandre Dumas", "Gustave Flaubert", "Émile Zola", "Fyodor Dostoevsky", "Leo Tolstoy", "Anton Chekhov", "Alexander Pushkin", "Edgar Allan Poe", "Herman Melville", "Walt Whitman", "Emily Dickinson", "Mark Twain", "Jules Verne", "Henrik Ibsen", "Luigi Pirandello", "Rabindranath Tagore", "José Martí", "Machado de Assis", "Natsume Sōseki", "Hans Christian Andersen", "Oscar Wilde", "Louisa May Alcott", "Frederick Douglass", "Harriet Jacobs", "Ambrose Bierce", "Wilkie Collins", "Elizabeth Gaskell", "Alfred de Musset", "Alphonse Daudet", "Prosper Mérimée", "Anatole France", "Giosuè Carducci", "Giovanni Pascoli"]],
  ["Early Twentieth Century", ["James Joyce", "Virginia Woolf", "Marcel Proust", "Franz Kafka", "T. S. Eliot", "William Faulkner", "Ernest Hemingway", "D. H. Lawrence", "Lu Xun", "Rabindranath Tagore", "Federico García Lorca", "Boris Pasternak", "Mikhail Bulgakov", "Jorge Luis Borges", "Katherine Mansfield", "Rainer Maria Rilke", "Edith Wharton", "Zora Neale Hurston", "Nella Larsen", "Italo Svevo", "Yasunari Kawabata", "Fernando Pessoa", "Maya Angelou", "W. B. Yeats", "W. E. B. Du Bois", "Beatrix Potter", "A. A. Milne", "Eugenio Montale", "Salvatore Quasimodo", "Giuseppe Ungaretti", "Sergei Yesenin", "Daniil Kharms"]],
  ["Mid-Twentieth Century", ["George Orwell", "Albert Camus", "Simone de Beauvoir", "James Baldwin", "Chinua Achebe", "Toni Morrison", "Gabriel García Márquez", "Naguib Mahfouz", "Ursula K. Le Guin", "Octavia E. Butler", "Italo Calvino", "Primo Levi", "Pablo Neruda", "Derek Walcott", "Margaret Laurence", "Milan Kundera", "Mikhail Sholokhov", "Maya Angelou", "Flann O'Brien", "José Saramago", "Nadine Gordimer", "J. M. Coetzee", "Margaret Atwood", "Kurt Vonnegut", "Arkady Strugatsky", "Boris Strugatsky"]],
  ["Contemporary", ["J. K. Rowling", "Margaret Atwood", "Kazuo Ishiguro", "Salman Rushdie", "Haruki Murakami", "Chimamanda Ngozi Adichie", "Zadie Smith", "Elena Ferrante", "Cixin Liu", "Mo Yan", "Orhan Pamuk", "Arundhati Roy", "Jhumpa Lahiri", "Ocean Vuong", "Han Kang", "Olga Tokarczuk", "Colson Whitehead", "Yaa Gyasi", "Tana French", "Sally Rooney", "Isabel Allende", "Roberto Bolaño", "Kiran Desai", "David Grossman", "Annie Ernaux", "George Saunders", "Eleanor Catton"]]
];

export const WRITERS_SEED: TopicSeed = branch("Writers", [
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

