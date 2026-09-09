export const DEFAULT_PROFILE = {
  name: "",
  title: "Backend Engineer — Java / Spring Boot",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  city: "Chandigarh, India",
  college: "",

  yoe: "2.2",
  noticePeriod: "",
  currentCtc: "",
  expectedCtc: "",
  relocate: "Yes — Bangalore, Hyderabad, Pune, Gurgaon, Noida",
  locations: "Bangalore, Bengaluru, Hyderabad, Pune, Gurgaon, Gurugram, Noida, Remote",
  exclude: "sales, marketing, .net, salesforce developer, sap abap, mainframe",

  // scoring inputs
  coreSkills: ["java", "spring", "microservices", "kafka", "kubernetes", "aws", "sql", "docker"],
  titleKeywords: ["backend", "back end", "java", "software engineer", "full stack", "platform"],
  domainKeywords: [
    "oss", "bss", "metasolv", "provisioning", "order management", "telecom",
    "fintech", "payments", "financial", "budget", "forecast", "banking",
  ],

  summary:
    "Backend engineer with 2+ years building event-driven order management and large-scale financial planning systems. Java and Spring Boot on AWS and Kubernetes, Kafka and JMS messaging, Hazelcast distributed caching, and Oracle MetaSolv (M6) telecom provisioning.",

  skillGroups: [
    { k: "Languages", v: "Java, Python, SQL, JavaScript, TypeScript" },
    { k: "Backend", v: "Spring Boot, Spring Security, Hibernate, Microservices, REST APIs" },
    { k: "Messaging & Caching", v: "Apache Kafka, JMS, Message-Driven Beans, Hazelcast" },
    { k: "Cloud & DevOps", v: "AWS, Docker, Kubernetes, Jenkins, Bash" },
    { k: "Databases", v: "Oracle DB, MySQL" },
    { k: "Frontend", v: "React, Angular" },
    { k: "Domain", v: "Telecom OSS/BSS (Oracle MetaSolv M6), financial planning and forecasting" },
    { k: "Monitoring", v: "Splunk" },
  ],

  experience: [
    {
      id: "e1",
      role: "Application Engineer",
      company: "",
      context: "US federal financial planning platform — multi-year budgeting and forecasting",
      location: "India",
      start: "Jun 2024",
      end: "Present",
      bullets: [
        "Built and maintained scalable backend services in Java, Spring Boot and Microservices on AWS with load-balanced infrastructure, sustaining high availability for financial workflows.",
        "Containerised services with Docker and deployed on Kubernetes, cutting environment drift and enabling smoother production scaling.",
        "Integrated Hazelcast distributed caching to reduce database load and response times on high-volume financial data queries.",
        "Automated deployment and operational workflows with Bash scripting, reducing manual engineering effort.",
      ],
    },
    {
      id: "e2",
      role: "Application Engineer",
      company: "",
      context: "Telecom order management and provisioning — Oracle MetaSolv (M6)",
      location: "India",
      start: "",
      end: "",
      bullets: [
        "Delivered order management and provisioning workflows on Oracle MetaSolv (M6) supporting the end-to-end telecom order lifecycle.",
        "Implemented asynchronous order and provisioning processing with Message-Driven Beans on JMS for reliable, decoupled event handling.",
        "Used Apache Kafka for event-driven communication between order and provisioning systems, enabling real-time order status updates.",
        "Designed and queried Oracle schemas covering order, inventory and customer account data with integrity across provisioning workflows.",
        "Traced and resolved failed transactions using Splunk, reducing order-processing downtime.",
      ],
    },
  ],

  projects: [],

  education: [
    { id: "ed1", degree: "B.E., Computer Science", school: "", detail: "CGPA 9.4", years: "2021 – 2025" },
  ],

  certs: ["Google Generative AI — Google", "Introduction to Cloud Computing — Coursera"],
};

const KEYS = {
  profile: "sb.profile",
  pipeline: "sb.pipeline",
  contacts: "sb.contacts",
  sources: "sb.sources",
  feed: "sb.feed",
};

export { KEYS };

export function load(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadProfile() {
  return { ...DEFAULT_PROFILE, ...load(KEYS.profile, {}) };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function ago(iso) {
  const d = daysSince(iso);
  if (d === null) return "";
  if (d <= 0) return "today";
  if (d === 1) return "1d";
  return d + "d";
}

export function exportAll() {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: load(KEYS.profile, {}),
      pipeline: load(KEYS.pipeline, []),
      contacts: load(KEYS.contacts, []),
      sources: load(KEYS.sources, null),
    },
    null,
    2
  );
}

export function importAll(text) {
  const d = JSON.parse(text);
  if (d.profile) save(KEYS.profile, d.profile);
  if (d.pipeline) save(KEYS.pipeline, d.pipeline);
  if (d.contacts) save(KEYS.contacts, d.contacts);
  if (d.sources) save(KEYS.sources, d.sources);
  return true;
}
