export const DEFAULT_PEOPLE = {
  jn: { name: "Jean", initials: "JN", color: "#27a468", role: "Finances", al: ["jean"] },
  fd: { name: "Florian", initials: "FD", color: "#3b6ef6", role: "Customer outreach, raising money, and recruitment", al: ["florian", "flo", "fluorine", "florine", "florent", "floriane"] },
  ia: { name: "Iannis", initials: "IA", color: "#e8930c", role: "Building the robot and operating system", al: ["iannis", "yannis", "yanis", "ianis", "ioannis", "janice", "janis", "yanni", "ennis"] },
  ak: { name: "Akshat", initials: "AK", color: "#9b59d0", role: "Obstacle avoidance and autonomous locomotion", al: ["akshat", "akshad", "akshot", "axat", "akshut"] },
  sk: { name: "Sanket", initials: "SK", color: "#d4488e", role: "Control and embedded systems", al: ["sanket", "sankeet", "sankit", "sunket", "sanke"] },
  lm: { name: "Liam", initials: "LM", color: "#0ea5b7", role: "General / operations", al: ["liam", "leam"] },
  ly: { name: "Leynaïck", initials: "LY", color: "#647acb", role: "Electronics (intern)", al: ["leynaïck", "leynaick", "lenaick", "laynaick", "leinaick", "lenix", "laynick"] },
};

export const DEFAULT_TODAY = "2026-06-12";

export const DEFAULT_HARDWARE_VOCAB = [
  "Robstride motors: RS00, RS02, RS03, RS04, EL05",
  "Feetech motors (all models)",
  "Hub motors (used for the wheels - primary locomotion)",
  "D-Wave board (custom hardware board in the current robots)",
];

export const DEFAULT_CLIENTS = [
  { name: "Onet", al: ["onet", "o net", "onnet", "aunet"] },
  { name: "Derichebourg", al: ["derichebourg", "de riche bourg", "derichbourg", "derich bourg", "deurichebourg"] },
  { name: "NSI", al: ["nsi", "n s i", "ensi", "n.s.i"] },
  { name: "Areas", al: ["areas", "aréas", "arias", "ariane", "arrears"] },
  { name: "JCDecaux", al: ["jcdecaux", "jc decaux", "jcd", "jic decaux", "jaycee decaux", "jay c decaux"] },
];

export const DEFAULT_DOMAIN_RULES = [
  { o: "ak", kw: ["obstacle", "avoidance", "autonom", "navigation", "locomot", "path planning", "slam", "perception", "mapping"] },
  { o: "sk", kw: ["control", "embedded", "firmware", "motor control", "pid", "actuator", "can bus", "servo", "rs0", "rs00", "rs02", "rs03", "rs04", "el05", "feetech", "hub motor", "motor"] },
  { o: "ia", kw: ["operating system", " os ", "assembly", "chassis", "mechanical", "integration", "build the robot", "robot build", "frame"] },
  { o: "ly", kw: ["electronic", "d-wave", "dwave", "board", "power", "wiring", "pcb", "circuit", "battery", "soldering", "harness"] },
  { o: "jn", kw: ["budget", "invoice", "finance", "cost", "payment", "accounting", "payroll"] },
  { o: "fd", kw: ["client", "outreach", "fundrais", "recruit", "hiring", "pilot", "sales", "demo", "investor", "contract"] },
];
