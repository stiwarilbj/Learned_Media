import type { TopicSeed } from "./topic-catalog";
import { buildPublicHealthOrganizations } from "./public-health-catalog";

type BranchSeed = { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): BranchSeed => ({ label, children, aliases });

const RESPIRATORY_DISEASES: TopicSeed[] = [
  "COVID-19", "Influenza", "Common Cold", "Respiratory Syncytial Virus", "SARS", "MERS", "Tuberculosis", "Pertussis",
  "Diphtheria", "Pneumonia", "Legionnaires' Disease", "Pneumocystis Pneumonia", "Histoplasmosis", "Coccidioidomycosis",
  "Blastomycosis", "Aspergillosis", "Hantavirus Pulmonary Syndrome", "Lungworm Disease", "Silicosis", "Asbestosis"
];

const FEVER_AND_INFLAMMATION: TopicSeed[] = [
  "Influenza", "Malaria", "Dengue", "Chikungunya", "Yellow Fever", "Typhoid Fever", "Relapsing Fever", "Q Fever",
  "Rocky Mountain Spotted Fever", "Rheumatic Fever", "Scarlet Fever", "Lassa Fever", "Marburg Virus Disease", "Ebola Disease",
  "Crimean-Congo Hemorrhagic Fever", "West Nile Fever", "Japanese Encephalitis", "Zika Virus Disease", "Chagas Disease"
];

const SKIN_AND_RASH_DISEASES: TopicSeed[] = [
  "Smallpox", "Mpox (Monkeypox)", "Chickenpox", "Measles", "Rubella", "Hand, Foot, and Mouth Disease", "Molluscum Contagiosum",
  "Warts and Human Papillomavirus", "Impetigo", "Leprosy", "Erysipelas", "Ringworm", "Candidiasis of the Skin", "Scabies",
  "Cutaneous Leishmaniasis", "Sporotrichosis", "Chromoblastomycosis", "Mycetoma", "Anthrax of the Skin", "Necrotizing Fasciitis"
];

const NEUROLOGICAL_DISEASES: TopicSeed[] = [
  "Polio", "Rabies", "Tetanus", "Meningococcal Disease", "Viral Meningitis", "Encephalitis", "Japanese Encephalitis",
  "West Nile Neuroinvasive Disease", "Herpes Simplex Encephalitis", "Neurocysticercosis", "African Sleeping Sickness",
  "Creutzfeldt-Jakob Disease", "Variant Creutzfeldt-Jakob Disease", "Kuru", "Fatal Familial Insomnia", "Toxoplasmosis of the Brain"
];

const DIGESTIVE_DISEASES: TopicSeed[] = [
  "Cholera", "Typhoid Fever", "Paratyphoid Fever", "Salmonellosis", "Shigellosis", "Campylobacteriosis", "Listeriosis",
  "Norovirus Infection", "Rotavirus Infection", "Hepatitis A", "Hepatitis E", "Amebiasis", "Giardiasis", "Cryptosporidiosis",
  "Intestinal Worm Infections", "Botulism", "Food Poisoning", "Clostridioides difficile Infection", "Whipple Disease"
];

const BLOOD_AND_LYMPH_DISEASES: TopicSeed[] = [
  "HIV Infection and AIDS", "Hepatitis B", "Hepatitis C", "Malaria", "Babesiosis", "Chagas Disease", "Dengue",
  "Yellow Fever", "Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Crimean-Congo Hemorrhagic Fever", "Plague",
  "Brucellosis", "Tularemia", "Lyme Disease", "Visceral Leishmaniasis", "Lymphatic Filariasis"
];

const VIRAL_DISEASES: TopicSeed[] = [
  branch("Respiratory Viruses", RESPIRATORY_DISEASES),
  branch("Childhood and Vaccine-Preventable Viral Diseases", ["Measles", "Mumps", "Rubella", "Chickenpox", "Polio", "Diphtheria", "Pertussis", "Rotavirus Infection", "Hepatitis B", "Human Papillomavirus Disease"]),
  branch("Viral Hemorrhagic Fevers", ["Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Crimean-Congo Hemorrhagic Fever", "Yellow Fever", "Dengue Hemorrhagic Fever", "Rift Valley Fever", "Omsk Hemorrhagic Fever", "Kyasanur Forest Disease"]),
  branch("Viral Diseases of the Liver", ["Hepatitis A", "Hepatitis B", "Hepatitis C", "Hepatitis D", "Hepatitis E", "Hepatitis G", "Hepatitis-Associated Cirrhosis"]),
  branch("Viral Diseases of the Nervous System", NEUROLOGICAL_DISEASES.filter((disease) => ["Polio", "Rabies", "Viral Meningitis", "Encephalitis", "Japanese Encephalitis", "West Nile Neuroinvasive Disease", "Herpes Simplex Encephalitis"].includes(disease as string))),
  branch("Viral Skin and Mucosal Diseases", ["Smallpox", "Mpox (Monkeypox)", "Chickenpox", "Measles", "Rubella", "Molluscum Contagiosum", "Warts and Human Papillomavirus", "Herpes Simplex", "Shingles", "Hand, Foot, and Mouth Disease"]),
  branch("Mosquito- and Tick-Borne Viruses", ["Dengue", "Yellow Fever", "West Nile Virus Disease", "Zika Virus Disease", "Chikungunya", "Japanese Encephalitis", "Rift Valley Fever", "Tick-Borne Encephalitis", "Colorado Tick Fever"]),
  branch("Animal-Associated Viral Diseases", ["Rabies", "Avian Influenza", "Swine Influenza", "Nipah Virus Disease", "Hendra Virus Disease", "Ebola Disease", "Marburg Virus Disease", "Hantavirus Disease", "Mpox (Monkeypox)", "COVID-19"]),
  branch("Viral Sexually Transmitted Infections", ["HIV Infection and AIDS", "Human Papillomavirus Disease", "Genital Herpes", "Hepatitis B", "Molluscum Contagiosum", "Cytomegalovirus Infection"])
];

const BACTERIAL_DISEASES: TopicSeed[] = [
  branch("Respiratory Bacterial Diseases", ["Tuberculosis", "Pertussis", "Diphtheria", "Pneumococcal Disease", "Legionnaires' Disease", "Mycoplasma Pneumonia", "Haemophilus Influenzae Disease", "Melioidosis"]),
  branch("Water- and Foodborne Bacterial Diseases", ["Cholera", "Typhoid Fever", "Paratyphoid Fever", "Salmonellosis", "Shigellosis", "Campylobacteriosis", "Listeriosis", "Botulism", "Escherichia coli Infection", "Yersiniosis", "Vibrio Infection"]),
  branch("Bacterial Diseases of the Skin", ["Impetigo", "Cellulitis", "Erysipelas", "Leprosy", "Anthrax", "Boils and Furunculosis", "Necrotizing Fasciitis", "Staphylococcal Scalded Skin Syndrome"]),
  branch("Bacterial Sexually Transmitted Infections", ["Syphilis", "Gonorrhea", "Chancroid", "Chlamydia", "Lymphogranuloma Venereum", "Granuloma Inguinale"]),
  branch("Bacterial Diseases of the Nervous System", ["Tetanus", "Bacterial Meningitis", "Botulism", "Neurobrucellosis", "Neurosyphilis", "Leprosy of the Nervous System"]),
  branch("Bacterial Vector- and Animal-Borne Diseases", ["Plague", "Lyme Disease", "Rocky Mountain Spotted Fever", "Ehrlichiosis", "Anaplasmosis", "Tularemia", "Brucellosis", "Leptospirosis", "Q Fever"]),
  branch("Antibiotic-Resistant Bacterial Diseases", ["MRSA Infection", "Drug-Resistant Tuberculosis", "Drug-Resistant Gonorrhea", "Vancomycin-Resistant Enterococci", "Carbapenem-Resistant Enterobacterales", "Multidrug-Resistant Salmonella", "Antimicrobial-Resistant Typhoid"])
];

const FUNGAL_DISEASES: TopicSeed[] = [
  branch("Fungal Lung Diseases", ["Histoplasmosis", "Blastomycosis", "Coccidioidomycosis", "Aspergillosis", "Cryptococcosis", "Mucormycosis", "Pneumocystis Pneumonia", "Paracoccidioidomycosis", "Talaromycosis"]),
  branch("Fungal Skin and Nail Diseases", ["Ringworm", "Athlete's Foot", "Jock Itch", "Onychomycosis", "Candidiasis of the Skin", "Sporotrichosis", "Chromoblastomycosis", "Mycetoma", "Tinea Versicolor"]),
  branch("Fungal Diseases in the Mouth and Body", ["Oral Thrush", "Invasive Candidiasis", "Vaginal Candidiasis", "Cryptococcal Meningitis", "Fungal Sinusitis", "Fungal Eye Infection", "Pneumocystis Pneumonia"]),
  branch("Soil- and Environment-Associated Fungal Diseases", ["Histoplasmosis", "Blastomycosis", "Valley Fever", "Sporotrichosis", "Paracoccidioidomycosis", "Talaromycosis", "Mycetoma"])
];

const PARASITIC_DISEASES: TopicSeed[] = [
  branch("Protozoan Diseases", ["Malaria", "Amebiasis", "Giardiasis", "Cryptosporidiosis", "Toxoplasmosis", "Chagas Disease", "African Sleeping Sickness", "Leishmaniasis", "Trichomoniasis", "Babesiosis", "Naegleria Fowleri Infection"]),
  branch("Worm Diseases", ["Ascariasis", "Hookworm Disease", "Strongyloidiasis", "Trichuriasis", "Schistosomiasis", "Trichinellosis", "Taeniasis", "Cysticercosis", "Echinococcosis", "Lymphatic Filariasis", "Onchocerciasis", "Dracunculiasis", "Pinworm Infection"]),
  branch("Insect- and Arthropod-Borne Parasitic Diseases", ["Malaria", "Leishmaniasis", "African Sleeping Sickness", "Chagas Disease", "Onchocerciasis", "Lymphatic Filariasis", "Scabies", "Pediculosis", "Tungiasis"]),
  branch("Food- and Water-Associated Parasitic Diseases", ["Giardiasis", "Cryptosporidiosis", "Amebiasis", "Cyclosporiasis", "Toxoplasmosis", "Trichinellosis", "Taeniasis", "Fascioliasis", "Paragonimiasis"]),
  branch("Neglected Tropical Diseases", ["Schistosomiasis", "Leishmaniasis", "Chagas Disease", "African Sleeping Sickness", "Lymphatic Filariasis", "Onchocerciasis", "Trachoma", "Dracunculiasis", "Buruli Ulcer", "Mycetoma", "Yaws"])
];

const PRION_DISEASES: TopicSeed[] = [
  "Creutzfeldt-Jakob Disease", "Variant Creutzfeldt-Jakob Disease", "Kuru", "Fatal Familial Insomnia", "Gerstmann-Sträussler-Scheinker Syndrome",
  "Bovine Spongiform Encephalopathy", "Chronic Wasting Disease", "Scrapie"
];

const TRANSMISSION_GROUPS: TopicSeed[] = [
  branch("Airborne and Respiratory Spread", RESPIRATORY_DISEASES.concat(["Measles", "Chickenpox", "Tuberculosis", "COVID-19", "Influenza"])),
  branch("Fecal-Oral and Waterborne Spread", DIGESTIVE_DISEASES.concat(["Hepatitis A", "Hepatitis E", "Cholera", "Polio"])),
  branch("Foodborne Spread", ["Salmonellosis", "Listeriosis", "Campylobacteriosis", "Botulism", "Norovirus Infection", "Hepatitis A", "Toxoplasmosis", "Trichinellosis", "E. coli Infection", "Typhoid Fever"]),
  branch("Bloodborne Spread", BLOOD_AND_LYMPH_DISEASES.concat(["Hepatitis B", "Hepatitis C", "HIV Infection and AIDS", "Malaria", "Babesiosis"])),
  branch("Sexual Contact", ["HIV Infection and AIDS", "Syphilis", "Gonorrhea", "Chlamydia", "Genital Herpes", "Human Papillomavirus Disease", "Trichomoniasis", "Hepatitis B"]),
  branch("Vector-Borne Spread", ["Malaria", "Dengue", "Yellow Fever", "Zika Virus Disease", "Chikungunya", "West Nile Virus Disease", "Lyme Disease", "Plague", "Leishmaniasis", "African Sleeping Sickness", "Onchocerciasis"]),
  branch("Animal-to-Human Spread", ["Rabies", "Brucellosis", "Leptospirosis", "Anthrax", "Avian Influenza", "Swine Influenza", "Ebola Disease", "Marburg Virus Disease", "Nipah Virus Disease", "Hantavirus Disease", "COVID-19"]),
  branch("Soil and Environmental Exposure", ["Tetanus", "Histoplasmosis", "Blastomycosis", "Coccidioidomycosis", "Hookworm Disease", "Strongyloidiasis", "Anthrax", "Sporotrichosis", "Legionnaires' Disease"]),
  branch("Direct Contact and Surfaces", ["Mpox (Monkeypox)", "Molluscum Contagiosum", "Impetigo", "Ringworm", "Scabies", "Conjunctivitis", "Norovirus Infection", "C. difficile Infection"])
];

const BODY_SYSTEM_GROUPS: TopicSeed[] = [
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

const EFFECT_GROUPS: TopicSeed[] = [
  branch("Fever and Chills", FEVER_AND_INFLAMMATION),
  branch("Rashes and Skin Changes", SKIN_AND_RASH_DISEASES),
  branch("Breathing Problems", RESPIRATORY_DISEASES),
  branch("Digestive Symptoms", DIGESTIVE_DISEASES),
  branch("Bleeding and Hemorrhagic Illness", ["Ebola Disease", "Marburg Virus Disease", "Lassa Fever", "Dengue Hemorrhagic Fever", "Yellow Fever", "Crimean-Congo Hemorrhagic Fever", "Hemolytic Uremic Syndrome", "Severe Sepsis"]),
  branch("Brain and Nerve Effects", NEUROLOGICAL_DISEASES),
  branch("Long-Term and Chronic Effects", ["HIV Infection and AIDS", "Long COVID", "Post-Polio Syndrome", "Chronic Hepatitis", "Rheumatic Heart Disease", "Post-Tuberculosis Lung Disease", "Chronic Chagas Disease", "Post-Infectious Encephalitis"])
];

const IMPACT_GROUPS: TopicSeed[] = [
  branch("Public Health and Prevention", ["Vaccination", "Quarantine and Isolation", "Contact Tracing", "Public Health Surveillance", "Outbreak Investigation", "Health Education", "Community Health Workers", "One Health", "Disease Elimination", "Disease Eradication"]),
  branch("Hospitals and Health Systems", ["Surge Capacity", "Infection Prevention and Control", "Personal Protective Equipment", "Healthcare-Associated Infections", "Laboratory Networks", "Emergency Departments During Outbreaks", "Rural Health and Access", "Global Health Systems"]),
  branch("Economy, Work, and Education", ["Workplace Outbreaks", "School Closures and Reopening", "Food Supply Disruptions", "Travel and Trade", "Economic Costs of Epidemics", "Paid Sick Leave and Public Health", "Occupational Disease"]),
  branch("Society, Culture, and Trust", ["Stigma and Discrimination", "Disability and Long-Term Recovery", "Risk Communication", "Misinformation and Rumors", "Memorials and Collective Memory", "Health Inequality", "Ethics During Outbreaks"]),
  branch("Medicine and Research", ["Vaccine Development", "Antimicrobial Resistance", "Clinical Trials During Outbreaks", "Disease Modeling", "Genomic Surveillance", "Diagnostics", "Public Health Funding", "Medical Supply Chains"]),
  branch("Historical Impact", ["The Black Death and Social Change", "Smallpox and Indigenous Communities", "1918 Influenza and World War I", "HIV/AIDS and Activism", "COVID-19 and Daily Life", "Epidemics and Migration", "Disease and Colonialism"])
];

const PANDEMICS_BY_TIME: TopicSeed[] = [
  branch("Ancient and Medieval", ["Plague of Athens", "Antonine Plague", "Plague of Cyprian", "Plague of Justinian", "Black Death", "Cocoliztli Epidemics", "Medieval Leprosy Epidemics", "Medieval Smallpox Outbreaks"]),
  branch("Sixteenth Through Eighteenth Centuries", ["Smallpox in the Americas", "Great Plague of London", "Great Plague of Marseille", "Yellow Fever Epidemics in the Americas", "Eighteenth-Century Smallpox Epidemics", "Measles Epidemics in the Pacific", "Cholera Before the First Pandemic"]),
  branch("Nineteenth Century", ["First Cholera Pandemic", "Second Cholera Pandemic", "Third Cholera Pandemic", "Fourth Cholera Pandemic", "Fifth Cholera Pandemic", "Sixth Cholera Pandemic", "Seventh Cholera Pandemic", "1855 Yunnan Plague", "Yellow Fever in the Mississippi Valley", "Smallpox Epidemics of the Nineteenth Century"]),
  branch("Early Twentieth Century", ["1918 Influenza Pandemic", "1920s Smallpox Epidemics", "1930s Polio Epidemics", "1940s Diphtheria Epidemics", "Asian Influenza Pandemic of 1957", "Hong Kong Influenza Pandemic of 1968", "Seventh Cholera Pandemic"]),
  branch("Late Twentieth Century", ["HIV/AIDS Pandemic", "1977 Russian Influenza", "1980s Measles Resurgence", "1990s Cholera Epidemics", "1997 H5N1 Avian Influenza", "1998 Nipah Virus Outbreak", "1999 West Nile Virus in North America"]),
  branch("Twenty-First Century", ["SARS Outbreak of 2002–2004", "2009 H1N1 Influenza Pandemic", "2014–2016 West Africa Ebola Epidemic", "2015–2016 Zika Epidemic", "MERS Outbreaks", "COVID-19 Pandemic", "2022 Mpox Global Outbreak", "2023–2024 Dengue Epidemics"]),
  branch("Recurring and Ongoing Epidemics", ["Seasonal Influenza Epidemics", "Malaria Epidemics", "Tuberculosis Epidemics", "HIV/AIDS Epidemic", "Dengue Epidemics", "Cholera Epidemics", "Measles Outbreaks", "Yellow Fever Outbreaks", "Polio Outbreaks", "Meningitis Belt Epidemics"])
];

const PANDEMICS_BY_TYPE: TopicSeed[] = [
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

export function buildDiseasesTopic(): TopicSeed {
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
      ...buildPublicHealthOrganizations()
    ]),
    branch("Pandemics & Epidemics", [
      branch("By Time Span", PANDEMICS_BY_TIME),
      branch("By Type", PANDEMICS_BY_TYPE),
      branch("Public Health Response", ["Quarantine", "Isolation", "Contact Tracing", "Vaccination Campaigns", "Masking and Respiratory Protection", "Travel Measures", "Emergency Declarations", "International Health Regulations", "Community Response", "Pandemic Preparedness"]),
      branch("How Outbreaks Spread", ["Animal Spillover", "Respiratory Spread", "Water and Sanitation", "Foodborne Spread", "Vector Expansion", "Global Travel", "Crowded Housing", "Healthcare Transmission", "Misinformation During Outbreaks"])
    ])
  ]);
}

export const DISEASE_CATALOG_SOURCES = [
  "https://www.nih.gov/institutes-nih/list-institutes-centers",
  "https://www.who.int/about/governance/world-health-assembly",
  "https://www.cdc.gov/about/organization/",
  "https://www.nih.gov/nih-style-guide/appendix-biomedical-definitions",
  "https://www.who.int/health-topics/pandemics",
  "https://www.cdc.gov/fungal/about/types-of-fungal-diseases.html",
  "https://www.cdc.gov/healthy-pets/diseases/index.html",
  "https://cdc.gov/parasites/causes/index.html"
] as const;
