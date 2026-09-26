// Load-once typed datastore, mirroring backend/datastore.py + config.py.
// JSON is imported statically so esbuild inlines it into the Worker bundle.

import type {
  AuditEntry,
  Beat,
  ChatQAData,
  OpportunitiesData,
  PersonaConfig,
  RecapQuizData,
  Title,
  VisualBible,
  VisualScene,
} from "./types";

import titlesJson from "./data/titles.json";

import franklinBeats from "./data/franklin/beats.json";
import franklinChatQa from "./data/franklin/chat_qa.json";
import franklinVisuals from "./data/franklin/visuals.json";
import franklinBible from "./data/franklin/visual_bible.json";
import franklinQuiz from "./data/franklin/recap_quiz.json";
import franklinPersonas from "./data/franklin/personas.json";
import franklinSeed from "./data/franklin/audit_seed.json";

import harnessBeats from "./data/harness/beats.json";
import harnessChatQa from "./data/harness/chat_qa.json";
import harnessVisuals from "./data/harness/visuals.json";
import harnessBible from "./data/harness/visual_bible.json";
import harnessQuiz from "./data/harness/recap_quiz.json";
import harnessPersonas from "./data/harness/personas.json";
import harnessOpportunities from "./data/harness/opportunities.json";
import harnessSeed from "./data/harness/audit_seed.json";

import aieBeats from "./data/ai-engineering/beats.json";
import aieChatQa from "./data/ai-engineering/chat_qa.json";
import aieVisuals from "./data/ai-engineering/visuals.json";
import aieBible from "./data/ai-engineering/visual_bible.json";
import aieQuiz from "./data/ai-engineering/recap_quiz.json";
import aiePersonas from "./data/ai-engineering/personas.json";
import aieOpportunities from "./data/ai-engineering/opportunities.json";
import aieSeed from "./data/ai-engineering/audit_seed.json";

import econBeats from "./data/econ-basics/beats.json";
import econChatQa from "./data/econ-basics/chat_qa.json";
import econVisuals from "./data/econ-basics/visuals.json";
import econBible from "./data/econ-basics/visual_bible.json";
import econQuiz from "./data/econ-basics/recap_quiz.json";
import econPersonas from "./data/econ-basics/personas.json";
import econSeed from "./data/econ-basics/audit_seed.json";

import taxBeats from "./data/tax-basics/beats.json";
import taxChatQa from "./data/tax-basics/chat_qa.json";
import taxVisuals from "./data/tax-basics/visuals.json";
import taxBible from "./data/tax-basics/visual_bible.json";
import taxQuiz from "./data/tax-basics/recap_quiz.json";
import taxPersonas from "./data/tax-basics/personas.json";
import taxSeed from "./data/tax-basics/audit_seed.json";

import lawBeats from "./data/indian-law/beats.json";
import lawChatQa from "./data/indian-law/chat_qa.json";
import lawVisuals from "./data/indian-law/visuals.json";
import lawBible from "./data/indian-law/visual_bible.json";
import lawQuiz from "./data/indian-law/recap_quiz.json";
import lawPersonas from "./data/indian-law/personas.json";
import lawSeed from "./data/indian-law/audit_seed.json";

export const SNIPPET_TOKEN_CAP = 60;
export const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

export interface TitleData {
  beats: Beat[];
  chat_qa: ChatQAData;
  visuals: VisualScene[];
  visual_bible: VisualBible;
  recap_quiz: RecapQuizData;
  personas: PersonaConfig[];
  opportunities: OpportunitiesData | null;
  /** Seed entries only — the audit log is accumulated client-side (see README). */
  audit_seed: AuditEntry[];
}

function seed(raw: { entries: AuditEntry[] }): AuditEntry[] {
  return raw.entries as AuditEntry[];
}

const TITLE_DATA: Record<string, TitleData> = {
  franklin: {
    beats: (franklinBeats as { beats: Beat[] }).beats,
    chat_qa: franklinChatQa as unknown as ChatQAData,
    visuals: (franklinVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: franklinBible as unknown as VisualBible,
    recap_quiz: franklinQuiz as unknown as RecapQuizData,
    personas: (franklinPersonas as { personas: PersonaConfig[] }).personas,
    opportunities: null,
    audit_seed: seed(franklinSeed as { entries: AuditEntry[] }),
  },
  harness: {
    beats: (harnessBeats as { beats: Beat[] }).beats,
    chat_qa: harnessChatQa as unknown as ChatQAData,
    visuals: (harnessVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: harnessBible as unknown as VisualBible,
    recap_quiz: harnessQuiz as unknown as RecapQuizData,
    personas: (harnessPersonas as { personas: PersonaConfig[] }).personas,
    opportunities: harnessOpportunities as unknown as OpportunitiesData,
    audit_seed: seed(harnessSeed as { entries: AuditEntry[] }),
  },
  "ai-engineering": {
    beats: (aieBeats as { beats: Beat[] }).beats,
    chat_qa: aieChatQa as unknown as ChatQAData,
    visuals: (aieVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: aieBible as unknown as VisualBible,
    recap_quiz: aieQuiz as unknown as RecapQuizData,
    personas: (aiePersonas as { personas: PersonaConfig[] }).personas,
    opportunities: aieOpportunities as unknown as OpportunitiesData,
    audit_seed: seed(aieSeed as { entries: AuditEntry[] }),
  },
  "econ-basics": {
    beats: (econBeats as { beats: Beat[] }).beats,
    chat_qa: econChatQa as unknown as ChatQAData,
    visuals: (econVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: econBible as unknown as VisualBible,
    recap_quiz: econQuiz as unknown as RecapQuizData,
    personas: (econPersonas as { personas: PersonaConfig[] }).personas,
    opportunities: null,
    audit_seed: seed(econSeed as { entries: AuditEntry[] }),
  },
  "tax-basics": {
    beats: (taxBeats as { beats: Beat[] }).beats,
    chat_qa: taxChatQa as unknown as ChatQAData,
    visuals: (taxVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: taxBible as unknown as VisualBible,
    recap_quiz: taxQuiz as unknown as RecapQuizData,
    personas: (taxPersonas as { personas: PersonaConfig[] }).personas,
    opportunities: null,
    audit_seed: seed(taxSeed as { entries: AuditEntry[] }),
  },
  "indian-law": {
    beats: (lawBeats as { beats: Beat[] }).beats,
    chat_qa: lawChatQa as unknown as ChatQAData,
    visuals: (lawVisuals as { scenes: VisualScene[] }).scenes,
    visual_bible: lawBible as unknown as VisualBible,
    recap_quiz: lawQuiz as unknown as RecapQuizData,
    personas: (lawPersonas as { personas: PersonaConfig[] }).personas,
    opportunities: null,
    audit_seed: seed(lawSeed as { entries: AuditEntry[] }),
  },
};

const TITLES: Title[] = (titlesJson as { titles: Title[] }).titles;
const TITLES_BY_ID: Record<string, Title> = Object.fromEntries(
  TITLES.map((t) => [t.id, t]),
);

export const store = {
  titles(): Title[] {
    return TITLES;
  },
  title(titleId: string): Title | undefined {
    return TITLES_BY_ID[titleId];
  },
  /** Returns semantic-layer data for an unlocked title, or undefined (locked/unknown). */
  data(titleId: string): TitleData | undefined {
    return TITLE_DATA[titleId];
  },
  beat(titleId: string, index: number): Beat | undefined {
    return store.data(titleId)?.beats.find((b) => b.index === index);
  },
  persona(titleId: string, personaId: string): PersonaConfig | undefined {
    return store.data(titleId)?.personas.find((p) => p.id === personaId);
  },
};
