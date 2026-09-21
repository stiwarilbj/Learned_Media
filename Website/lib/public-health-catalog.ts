import type { TopicSeed } from "./topic-catalog";

type BranchSeed = { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): BranchSeed => ({ label, children, aliases });

const NIH_INSTITUTES: TopicSeed[] = [
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

const NIH_CENTERS: TopicSeed[] = [
  "NIH Clinical Center",
  "Center for Information Technology (CIT)",
  "Center for Scientific Review (CSR)",
  "Fogarty International Center (FIC)",
  "National Center for Advancing Translational Sciences (NCATS)",
  "National Center for Complementary and Integrative Health (NCCIH)"
];

const NIH_OFFICES: TopicSeed[] = [
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

const NIH_PROGRAMS: TopicSeed[] = [
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

const NIH_HEALTH_AREAS: TopicSeed[] = [
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

const WHO_ASSEMBLIES: TopicSeed[] = [
  ...Array.from({ length: 79 }, (_, index) => `WHA ${index + 1}`),
  "First Special Session of the World Health Assembly (WHASS 1)",
  "Second Special Session of the World Health Assembly (WHASS 2)",
  "Third Special Session of the World Health Assembly (WHASS 3)"
];

const WHO_PROGRAMS: TopicSeed[] = [
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

const WHO_GOVERNANCE: TopicSeed[] = [
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

const WHO_REGIONS: TopicSeed[] = [
  "African Region",
  "Region of the Americas",
  "South-East Asia Region",
  "European Region",
  "Eastern Mediterranean Region",
  "Western Pacific Region"
];

const WHO_SYSTEMS: TopicSeed[] = [
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

const CDC_CENTERS: TopicSeed[] = [
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

const CDC_OFFICES: TopicSeed[] = [
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

const CDC_PROGRAMS: TopicSeed[] = [
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

const CDC_DISEASE_AREAS: TopicSeed[] = [
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

export function buildPublicHealthOrganizations(): TopicSeed[] {
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

