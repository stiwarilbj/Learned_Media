(function () {
  "use strict";

  function branch(label, children) { return { label: label, children: children }; }
  function find(node, label) {
    if (!node || !node.children) return null;
    for (var i = 0; i < node.children.length; i += 1) {
      if (node.children[i] && node.children[i].label === label) return node.children[i];
    }
    return null;
  }

  var nihInstitutes = [
    "National Cancer Institute (NCI)", "National Eye Institute (NEI)", "National Heart, Lung, and Blood Institute (NHLBI)", "National Human Genome Research Institute (NHGRI)", "National Institute on Aging (NIA)", "National Institute on Alcohol Abuse and Alcoholism (NIAAA)", "National Institute of Allergy and Infectious Diseases (NIAID)", "National Institute of Arthritis and Musculoskeletal and Skin Diseases (NIAMS)", "National Institute of Biomedical Imaging and Bioengineering (NIBIB)", "Eunice Kennedy Shriver National Institute of Child Health and Human Development (NICHD)", "National Institute on Deafness and Other Communication Disorders (NIDCD)", "National Institute of Dental and Craniofacial Research (NIDCR)", "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK)", "National Institute on Drug Abuse (NIDA)", "National Institute of Environmental Health Sciences (NIEHS)", "National Institute of General Medical Sciences (NIGMS)", "National Institute of Mental Health (NIMH)", "National Institute on Minority Health and Health Disparities (NIMHD)", "National Institute of Neurological Disorders and Stroke (NINDS)", "National Institute of Nursing Research (NINR)", "National Library of Medicine (NLM)"
  ];
  var nihCenters = ["NIH Clinical Center", "Center for Information Technology (CIT)", "Center for Scientific Review (CSR)", "Fogarty International Center (FIC)", "National Center for Advancing Translational Sciences (NCATS)", "National Center for Complementary and Integrative Health (NCCIH)"];
  var nihOffices = ["Office of the Director", "Office of AIDS Research", "Office of Behavioral and Social Sciences Research", "Office of Disease Prevention", "Office of Dietary Supplements", "Office of Intramural Research", "Office of Research on Women's Health", "Office of Science Policy", "Office of Data Science Strategy", "Office of Portfolio Analysis", "Office of Autoimmune Disease Research", "Office of Research Integrity"];
  var nihPrograms = ["NIH Common Fund", "All of Us Research Program", "BRAIN Initiative", "Cancer Moonshot", "HEAL Initiative", "RECOVER Initiative", "Rapid Acceleration of Diagnostics (RADx)", "NIH Toolbox", "ClinicalTrials.gov", "PubMed", "MedlinePlus", "NIH Research Projects", "NIH Grants and Funding", "Intramural Research", "Extramural Research"];
  var nihAreas = ["Infectious Diseases", "Cancer", "Heart, Lung, and Blood Diseases", "Neurological Disorders", "Mental Health", "Aging", "Child Health and Development", "Genetic and Genomic Conditions", "Diabetes and Digestive Diseases", "Drug Use and Addiction", "Environmental Health", "Autoimmune Diseases", "Health Disparities", "Women's Health", "Biomedical Imaging", "Nursing Research"];

  var whoAssemblies = [];
  for (var i = 1; i <= 79; i += 1) whoAssemblies.push("WHA " + i);
  whoAssemblies.push("First Special Session of the World Health Assembly (WHASS 1)", "Second Special Session of the World Health Assembly (WHASS 2)", "Third Special Session of the World Health Assembly (WHASS 3)");
  var whoPrograms = ["WHO Health Emergencies Programme", "Global Polio Eradication Initiative", "Expanded Programme on Immunization", "Global Influenza Surveillance and Response System", "Pandemic Influenza Preparedness Framework", "Global Outbreak Alert and Response Network", "Stop TB Partnership", "Global Malaria Programme", "HIV/AIDS Programme", "Neglected Tropical Diseases Programme", "Essential Medicines Programme", "Antimicrobial Resistance Programme", "Global Health Observatory", "World Health Statistics", "Universal Health Coverage", "Primary Health Care", "One Health", "Research and Development Blueprint", "Access to COVID-19 Tools Accelerator (ACT-Accelerator)", "COVAX Facility", "Global Vaccine Action Plan", "WHO Framework Convention on Tobacco Control", "Global Action Plan for the Prevention and Control of Noncommunicable Diseases", "Mental Health Action Plan", "Global Strategy for Women's, Children's and Adolescents' Health"];
  var whoGovernance = ["World Health Assembly", "Executive Board", "Director-General", "General Programme of Work", "Fourteenth General Programme of Work (2025–2028)", "International Health Regulations", "WHO Pandemic Agreement", "Member States", "Regional Offices", "WHO Constitution", "World Health Report", "WHO Emergency Committee"];
  var whoRegions = ["African Region", "Region of the Americas", "South-East Asia Region", "European Region", "Eastern Mediterranean Region", "Western Pacific Region"];
  var whoSystems = ["Health Emergencies", "Immunization", "Disease Surveillance", "Research and Development", "Health Data", "Health Systems", "Health Workforce", "Essential Health Services", "Health Financing", "Quality of Care", "Digital Health", "Health and Climate Change"];

  var cdcCenters = ["Center for Forecasting and Outbreak Analytics", "Global Health Center", "National Center on Birth Defects and Developmental Disabilities (NCBDDD)", "National Center for Chronic Disease Prevention and Health Promotion (NCCDPHP)", "National Center for Emerging and Zoonotic Infectious Diseases (NCEZID)", "National Center for Environmental Health (NCEH)", "Agency for Toxic Substances and Disease Registry (ATSDR)", "National Center for Health Statistics (NCHS)", "National Center for HIV, Viral Hepatitis, STD, and TB Prevention (NCHHSTP)", "National Center for Immunization and Respiratory Diseases (NCIRD)", "National Center for Injury Prevention and Control (NCIPC)", "National Center for State, Tribal, Local, and Territorial Public Health Infrastructure and Workforce (NCSTLTPHIW)", "National Institute for Occupational Safety and Health (NIOSH)"];
  var cdcOffices = ["CDC Washington Office", "Office of Budget and Policy Analysis", "Office of Communications", "Office of the Chief Operating Officer", "Office of the Chief of Staff", "Office of Laboratory Science and Safety", "Office of Minority Health and Health Equity", "Office of Policy, Performance, and Evaluation", "Office of Public Health Data, Surveillance, and Technology", "Office of Readiness and Response", "Office of Strategy and Innovation"];
  var cdcPrograms = ["Epidemic Intelligence Service", "Field Epidemiology Training Program", "National Notifiable Diseases Surveillance System", "National Healthcare Safety Network", "National Syndromic Surveillance Program", "Data Modernization Initiative", "Public Health Emergency Preparedness", "Vaccines for Children", "Immunization Information Systems", "Global Health Security", "One Health", "WISQARS", "CDC WONDER", "National Center for Health Statistics Data", "Public Health Laboratory Response Network", "Emergency Operations Center", "Behavioral Risk Factor Surveillance System", "Youth Risk Behavior Surveillance System", "National Vital Statistics System"];
  var cdcAreas = ["Infectious Diseases", "Respiratory Viruses", "HIV, Viral Hepatitis, and Sexually Transmitted Infections", "Tuberculosis", "Immunization", "Chronic Disease", "Environmental Health", "Injury Prevention", "Birth Defects and Developmental Disabilities", "Occupational Safety and Health", "Food Safety", "Vector-Borne Diseases", "Global Health", "Public Health Infrastructure", "Health Equity"];

  var catalog = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  var science = catalog.filter(function (item) { return item && item.label === "Science"; })[0];
  var diseases = find(science, "Diseases");
  var viruses = find(diseases, "Viruses & Diseases");
  if (!viruses) return;
  var additions = [
    branch("NIH", [branch("Institutes", nihInstitutes), branch("Centers", nihCenters), branch("Office of the Director and Offices", nihOffices), branch("NIH Research Programs", nihPrograms), branch("NIH Disease and Health Areas", nihAreas)]),
    branch("WHO", [branch("World Health Assembly Sessions", whoAssemblies), branch("WHO Programmes and Initiatives", whoPrograms), branch("WHO Governance", whoGovernance), branch("WHO Regions", whoRegions), branch("WHO Health Systems", whoSystems)]),
    branch("CDC", [branch("Centers and Institutes", cdcCenters), branch("CDC Offices", cdcOffices), branch("CDC Programs and Systems", cdcPrograms), branch("CDC Disease Areas", cdcAreas)])
  ];
  additions.forEach(function (addition) {
    if (!viruses.children.some(function (child) { return child && child.label === addition.label; })) viruses.children.push(addition);
  });
})();

