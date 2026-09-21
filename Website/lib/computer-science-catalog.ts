import type { TopicSeed } from "./topic-catalog";

type BranchSeed = { label: string; children: TopicSeed[]; aliases?: string[] };

const branch = (label: string, children: TopicSeed[], aliases: string[] = []): BranchSeed => ({ label, children, aliases });

const PROGRAMMING_FUNDAMENTALS: TopicSeed[] = [
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

const LANGUAGE_DETAILS: TopicSeed[] = [
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

const DATA_STRUCTURES: TopicSeed[] = [
  branch("Linear Structures", ["Arrays", "Dynamic Arrays", "Linked Lists", "Doubly Linked Lists", "Stacks", "Queues", "Deques", "Circular Buffers", "Priority Queues"]),
  branch("Hashing", ["Hash Tables", "Hash Functions", "Collision Resolution", "Bloom Filters", "Count-Min Sketches", "Consistent Hashing"]),
  branch("Trees", ["Trees", "Binary Trees", "Binary Search Trees", "AVL Trees", "Red-Black Trees", "B-Trees", "B+ Trees", "Heaps", "Tries", "Radix Trees", "Segment Trees", "Fenwick Trees", "Merkle Trees"]),
  branch("Graphs", ["Graphs", "Directed Graphs", "Weighted Graphs", "Adjacency Lists", "Adjacency Matrices", "Disjoint Sets", "Union-Find", "Graph Traversal", "Topological Ordering"]),
  branch("Probabilistic and Spatial Structures", ["Skip Lists", "Suffix Arrays", "Suffix Trees", "K-D Trees", "R-Trees", "Quadtrees", "HyperLogLog", "Locality-Sensitive Hashing"])
];

const ALGORITHMS: TopicSeed[] = [
  branch("Searching and Sorting", ["Linear Search", "Binary Search", "Hash-Based Search", "Bubble Sort", "Insertion Sort", "Merge Sort", "Quick Sort", "Heap Sort", "Counting Sort", "Radix Sort", "External Sorting"]),
  branch("Graph Algorithms", ["Breadth-First Search", "Depth-First Search", "Dijkstra's Algorithm", "Bellman-Ford Algorithm", "A* Search", "Floyd-Warshall Algorithm", "Minimum Spanning Trees", "Kruskal's Algorithm", "Prim's Algorithm", "Max-Flow", "Min-Cut"]),
  branch("Optimization and Dynamic Programming", ["Dynamic Programming", "Memoization", "Greedy Algorithms", "Backtracking", "Branch and Bound", "Linear Programming", "Constraint Solving", "Scheduling Algorithms"]),
  branch("String and Geometry Algorithms", ["String Matching", "Knuth-Morris-Pratt", "Boyer-Moore", "Regular Expressions", "Computational Geometry", "Convex Hulls", "Nearest Neighbor Search"]),
  branch("Theory and Complexity", ["Big O", "Time Complexity", "Space Complexity", "Amortized Analysis", "P versus NP", "NP-Completeness", "Randomized Algorithms", "Approximation Algorithms", "Information Theory"])
];

const ARTIFICIAL_INTELLIGENCE: TopicSeed[] = [
  branch("AI Fundamentals", ["AI History", "Search Algorithms", "Knowledge Representation", "Planning", "Reasoning", "Expert Systems", "Symbolic AI", "Multi-Agent Systems"]),
  branch("Machine Learning", ["Supervised Learning", "Unsupervised Learning", "Semi-Supervised Learning", "Self-Supervised Learning", "Reinforcement Learning", "Classification", "Regression", "Clustering", "Dimensionality Reduction", "Feature Engineering", "Model Evaluation", "Cross-Validation", "Hyperparameter Tuning", "Model Explainability"]),
  branch("Deep Learning", ["Neural Networks", "Backpropagation", "Activation Functions", "Optimization", "Convolutional Neural Networks", "Recurrent Neural Networks", "Long Short-Term Memory", "Transformers", "Attention", "Embeddings", "Autoencoders", "Generative Adversarial Networks", "Diffusion Models"]),
  branch("Generative AI", ["Large Language Models", "Tokens", "Context Windows", "Prompt Engineering", "Structured Outputs", "Function Calling", "Fine-Tuning", "Retrieval-Augmented Generation", "Vector Databases", "Embeddings", "Multimodal AI", "Image Generation", "Video Generation", "Evaluation and Grounding"]),
  branch("Agentic AI", ["Agentic AI", "AI Agents", "Agent Planning", "Tool Use", "Tool Calling", "Memory for Agents", "Agent Workflows", "Multi-Agent Orchestration", "Human-in-the-Loop Agents", "Agent Evaluation", "Agent Safety", "Google Agent Development Kit (ADK)", "OpenClaw", "Model Context Protocol (MCP)", "MCP Servers", "MCP Tools", "MCP Resources", "MCP Client Design"]),
  branch("Computer Vision", ["Computer Vision", "Image Classification", "Object Detection", "Image Segmentation", "Pose Estimation", "Optical Flow", "OCR", "Image Embeddings", "OpenCV", "Ultralytics", "YOLO", "Camera Calibration", "Video Tracking"]),
  branch("Natural Language Processing", ["Tokenization", "Language Models", "Sentiment Analysis", "Named-Entity Recognition", "Translation", "Speech Recognition", "Text Embeddings", "Information Extraction", "Question Answering"]),
  branch("Data and ML Libraries", ["PyTorch", "TensorFlow", "scikit-learn", "NumPy", "pandas", "Jupyter Notebook", "Experiment Tracking", "Datasets", "Model Serving", "GPU Computing"]),
  branch("Search, RAG, and Vector Systems", ["RAG", "Retrieval", "Hybrid Search", "Semantic Search", "Vector Search", "Gemini Embeddings", "pgvector", "Chunking", "Reranking", "Citation Grounding", "Knowledge Bases"])
];

const DATABASES: TopicSeed[] = [
  branch("Relational Database Concepts", ["Relational Databases", "Tables", "Rows and Columns", "Primary Keys", "Foreign Keys", "Constraints", "Normalization", "Entity-Relationship Models", "Transactions", "ACID", "Isolation Levels", "Locks", "Deadlocks", "Views", "Triggers"]),
  branch("SQL Databases", ["SQL", "PostgreSQL", "MySQL", "MariaDB", "SQLite", "SQL Server", "Indexes", "B-Tree Indexes", "Full-Text Search", "Query Planning", "EXPLAIN", "Query Optimization", "Connection Pooling"]),
  branch("Database Management", ["Database Design", "Schema Design", "Migrations", "Seed Data", "Backups", "Point-in-Time Recovery", "Replication", "Read Replicas", "Sharding", "Partitioning", "Change Data Capture", "Database Monitoring", "Database Security"]),
  branch("Database Libraries and ORMs", ["SQLAlchemy", "SQLAlchemy Core", "SQLAlchemy ORM", "Prisma", "Prisma Migrations", "Prisma Client", "Object-Relational Mapping", "Query Builders", "Connection Pools"]),
  branch("Non-Relational Databases", ["NoSQL", "Document Databases", "Key-Value Databases", "Wide-Column Databases", "Graph Databases", "Redis", "MongoDB", "DynamoDB", "Neo4j", "Time-Series Databases"]),
  branch("Vector and Analytical Databases", ["Vector Databases", "pgvector", "Similarity Search", "Approximate Nearest Neighbors", "Data Warehouses", "BigQuery", "OLTP", "OLAP", "Columnar Storage"])
];

const WEB_DEVELOPMENT: TopicSeed[] = [
  branch("Frontend Development", ["HTML", "CSS", "JavaScript", "TypeScript", "React", "React Components", "React State", "React Hooks", "Next.js", "Next.js App Router", "Server Components", "Client Components", "Tailwind CSS", "Web Accessibility", "Responsive Interfaces", "Browser Rendering"]),
  branch("Backend Development", ["Node.js", "FastAPI", "Python Web Servers", "REST APIs", "GraphQL", "RPC", "Request Validation", "Middleware", "Background Jobs", "Webhooks", "WebSockets", "Server-Sent Events", "Caching"]),
  branch("Web Platforms", ["Browsers", "DOM", "Fetch API", "HTTP", "HTTPS", "Cookies", "Sessions", "Web Storage", "IndexedDB", "Service Workers", "Progressive Web Apps", "Browser Engines"]),
  branch("Browser Extensions", ["Chrome Extensions API", "Manifest V3", "Extension Service Workers", "Content Scripts", "Popup Pages", "Options Pages", "Chrome Tabs API", "DOM Inspection", "Extension Permissions", "Cross-Origin Requests", "Browser Automation"]),
  branch("Authentication and Web Identity", ["OAuth", "OAuth 2.0", "OpenID Connect", "Sessions", "Cookies", "JSON Web Tokens", "Passkeys", "CSRF", "CORS", "Rate Limiting"])
];

const CLOUD_DEVOPS: TopicSeed[] = [
  branch("CI/CD", ["CI/CD", "Continuous Integration", "Continuous Delivery", "Continuous Deployment", "Build Pipelines", "Release Pipelines", "GitHub Actions", "Workflow Files", "Build Artifacts", "Deployment Gates", "Rollback Strategies", "Preview Deployments"]),
  branch("Cloud Platforms", [
    branch("Amazon Web Services (AWS)", ["AWS", "EC2", "S3", "Lambda", "RDS", "DynamoDB", "ECS", "EKS", "CloudFront", "CloudWatch", "IAM", "VPC", "SNS", "SQS"]),
    branch("Microsoft Azure", ["Azure", "Azure App Service", "Azure Functions", "Azure Blob Storage", "Azure SQL", "Cosmos DB", "Azure Kubernetes Service", "Azure Monitor", "Microsoft Entra ID", "Azure DevOps"]),
    branch("Google Cloud Platform (GCP)", ["GCP", "Compute Engine", "Cloud Storage", "Cloud Run", "Google Kubernetes Engine", "BigQuery", "Cloud SQL", "Pub/Sub", "Vertex AI", "Cloud Monitoring", "Google Cloud IAM"]),
    branch("Vercel", ["Vercel", "Vercel Deployments", "Vercel Preview Deployments", "Vercel Serverless Functions", "Vercel Edge Functions", "Vercel Domains", "Vercel Environment Variables"])
  ]),
  branch("Containers and Infrastructure", ["Docker", "Docker Images", "Docker Compose", "Kubernetes", "Pods", "Deployments", "Services", "Ingress", "Helm", "Container Registries", "Virtual Machines", "Serverless Computing", "Infrastructure as Code", "Terraform"]),
  branch("Operations and Observability", ["Observability", "Logging", "Metrics", "Distributed Tracing", "Monitoring", "Alerting", "Health Checks", "SLOs and SLIs", "Incident Response", "Secrets Management", "Configuration Management"])
];

const SYSTEMS: TopicSeed[] = [
  branch("Operating Systems", ["Processes", "Threads", "Scheduling", "Virtual Memory", "Memory Management", "Filesystems", "System Calls", "Kernels", "Drivers", "Permissions", "Linux", "Windows", "macOS", "iOS", "Mobile Operating Systems"]),
  branch("Systems Programming", ["C", "C++", "Rust", "POSIX", "File Descriptors", "Signals", "Sockets", "Memory Mapping", "Shell Processes", "Command-Line Tools"]),
  branch("Computer Architecture", ["CPUs", "Instruction Sets", "Registers", "Cache", "RAM", "Storage", "Buses", "Pipelining", "Branch Prediction", "Multicore CPUs", "GPUs", "ARM", "x86", "RISC", "CISC", "Motherboards"]),
  branch("Distributed Systems", ["Client-Server Architecture", "Distributed Systems", "Service Discovery", "Load Balancing", "Replication", "Consistency", "Availability", "Fault Tolerance", "Scalability", "Rate Limiting", "Message Queues", "Event-Driven Systems", "Microservices", "Monoliths", "CAP Theorem"]),
  branch("Messaging and Event Systems", ["Message Queues", "Publish-Subscribe", "Event Streams", "Kafka", "RabbitMQ", "Task Queues", "Exactly-Once Processing", "Idempotency", "Retries", "Backpressure"])
];

const SECURITY: TopicSeed[] = [
  branch("Application Security", ["Web Security", "Input Validation", "Output Encoding", "SQL Injection", "Cross-Site Scripting", "CSRF", "SSRF", "Secure Headers", "Dependency Security", "Threat Modeling", "OWASP"]),
  branch("Identity and Access", ["Authentication", "Authorization", "OAuth", "OpenID Connect", "Role-Based Access Control", "Attribute-Based Access Control", "Least Privilege", "Secrets Management", "API Keys"]),
  branch("Cryptography", ["Cryptography", "Encryption", "Symmetric Encryption", "Public-Key Cryptography", "Hashing", "Digital Signatures", "TLS", "Key Management", "Randomness"]),
  branch("Infrastructure Security", ["Network Security", "Firewalls", "VPNs", "Cloud Security", "Container Security", "Endpoint Security", "Vulnerability Management", "Security Monitoring", "Incident Response"]),
  branch("Privacy and Safety", ["Privacy by Design", "Data Minimization", "PII", "Anonymization", "Access Logs", "AI Safety", "Model Security", "Prompt Injection", "Data Governance"])
];

const DATA_ENGINEERING: TopicSeed[] = [
  branch("Data Pipelines", ["ETL", "ELT", "Data Ingestion", "Batch Processing", "Stream Processing", "Data Validation", "Data Cleaning", "Data Lineage", "Data Contracts"]),
  branch("Data Science", ["Data Science", "NumPy", "pandas", "DataFrames", "Statistics", "Exploratory Data Analysis", "Feature Engineering", "Data Visualization", "Jupyter Notebook"]),
  branch("Files and Data Formats", ["CSV", "Excel Files", "Google Forms", "JSON", "XML", "Parquet", "Columnar Data", "File Uploads", "Data Serialization"]),
  branch("Analytics Systems", ["Data Warehouses", "BigQuery", "OLAP", "Dashboards", "Reporting", "Experiment Analysis", "Data Quality", "Data Governance"])
];

const MOBILE_DESKTOP: TopicSeed[] = [
  branch("Apple Platforms", ["Swift", "SwiftUI", "macOS Apps", "iOS Apps", "AppKit", "Swift Package Manager", "ScreenCaptureKit", "macOS Accessibility", "Accessibility APIs", "App Sandboxing", "Universal Binaries"]),
  branch("Desktop Automation", ["Desktop Automation", "Browser Automation", "macOS Accessibility", "ScreenCaptureKit", "Keyboard Events", "Mouse Events", "Permission Flows", "Agent-Controlled Workflows"]),
  branch("Document and PDF Software", ["PDF Generation", "fpdf2", "PDF Text Layout", "Document Export", "ReportLab", "Page Breaks", "Fonts and Unicode", "File System Save Dialogs"])
];

const TOOLS_WORKFLOW: TopicSeed[] = [
  branch("Developer Tools", ["VS Code", "Git", "GitHub", "Codex", "GitHub Issues", "GitHub Pull Requests", "Code Search", "Command-Line Interfaces"]),
  branch("Project Workflow", ["Version Control", "Branches", "Commits", "Merges", "Rebases", "Code Review", "Issue Tracking", "Release Management", "Open Source Development"]),
  branch("Build Systems", ["Compilers", "Bundlers", "Package Managers", "npm", "Swift Package Manager", "Make", "CMake", "Build Caching", "Universal Builds"])
];

const OTHER_FIELDS: TopicSeed[] = [
  branch("Compilers and Language Design", ["Lexing", "Parsing", "Abstract Syntax Trees", "Type Checking", "Interpreters", "Compilers", "Bytecode", "Garbage Collection", "Programming Language Design"]),
  branch("Graphics and Games", ["Computer Graphics", "Rendering", "Shaders", "3D Graphics", "Game Development", "Game Engines", "Physics Engines", "Animation"]),
  branch("Human-Computer Interaction", ["Human-Computer Interaction", "User Interfaces", "Interaction Design", "Usability", "Accessibility", "Information Architecture", "User Research"]),
  branch("Embedded and Connected Devices", ["Embedded Systems", "Microcontrollers", "Real-Time Systems", "Internet of Things", "Sensors", "Firmware", "Robotics"]),
  branch("Quantum and Emerging Computing", ["Quantum Computing", "Quantum Algorithms", "Neuromorphic Computing", "Edge Computing", "Spatial Computing", "Emerging Technologies"]),
  branch("Computer History", ["Computer History", "Early Internet History", "Famous Computer Scientists", "Famous Software Bugs", "Operating System History", "Programming Language History", "Computing Oddities"])
];

export function buildComputerScienceTopic(): TopicSeed {
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

export const COMPUTER_SCIENCE_RESUME_TOPICS = [
  "Python", "JavaScript", "TypeScript", "SQL", "Swift", "HTML", "CSS", "PyTorch", "TensorFlow", "React", "Next.js", "Node.js", "FastAPI", "OpenCV", "NumPy", "pandas", "scikit-learn", "Tailwind CSS", "SwiftUI", "Google Agent Development Kit (ADK)", "OpenClaw", "RAG", "Gemini Embeddings", "pgvector", "Vector Search", "Gemini API", "Computer Vision", "Prompt Engineering", "VS Code", "Git", "GitHub", "Codex", "Jupyter Notebook", "OAuth", "Vercel", "PostgreSQL", "SQLite", "SQLAlchemy", "Prisma", "Chrome Extensions API", "Manifest V3", "ScreenCaptureKit", "macOS Accessibility", "Ultralytics", "Pose Estimation", "fpdf2"
] as const;
