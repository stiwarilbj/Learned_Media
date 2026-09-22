import type { TopicSeed } from "./topic-catalog";

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): TopicSeed => ({
  label,
  children,
  ...(aliases.length ? { aliases } : {})
});

const leaf = (label: string, aliases: string[] = []): TopicSeed => branch(label, [], aliases);

/**
 * Fossil ranges are incomplete and taxonomic boundaries are debated. The order
 * below follows the latest generally reported occurrence where possible, while
 * preserving the user's requested first three Homo topics. Debated and
 * historical Homo names are grouped separately rather than implying that all
 * are accepted species or have comparable date ranges.
 */
export function buildHumanOriginsTopic(): TopicSeed {
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

export function buildGeologyTopic(): TopicSeed {
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

export function buildOrganismsTopic(): TopicSeed {
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
