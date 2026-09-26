// Types mirroring backend/models.py — the aiBook semantic layer contract.

export interface BeatPosition {
  beat_index: number;
  label: string;
}

export interface ReaderState {
  beat_position: BeatPosition;
}

export interface RightsInfo {
  status: string;
  source: string;
  ai_derivative_rights: string[];
  vault_bytes: number;
}

export interface Title {
  id: string;
  title: string;
  author: string;
  year: number;
  cover: string;
  locked: boolean;
  category: "literary" | "technical";
  rights?: RightsInfo | null;
  reader_state?: ReaderState | null;
}

export interface Citation {
  passage_id: string;
  beat_index: number;
  quote: string;
  quote_token_len: number;
  full_passage_text: string;
}

export interface Beat {
  index: number;
  title: string;
  narration: string;
  citations: Citation[];
  auto_visual_scene_id: string | null;
}

export interface PersonaConfig {
  id: string;
  label: string;
  chip_label: string;
  system_prompt: string;
  fallback_line: string;
  intro_beat: number | null;
}

/** Persona shape exposed by GET /personas — system_prompt & fallback_line stripped. */
export interface PublicPersona {
  id: string;
  label: string;
  chip_label: string;
  intro_beat: number | null;
}

export interface OpportunityItem {
  title: string;
  org: string;
  link: string;
  note: string;
}

export interface OpportunitiesData {
  as_of: string;
  items: OpportunityItem[];
}

export interface VisualBibleStyle {
  medium: string;
  palette: string[];
  palette_swatch: string;
}

export interface VisualBibleCharacter {
  id: string;
  name: string;
  reference_image: string;
  descriptors: string[];
}

export interface VisualBibleSetting {
  id: string;
  name: string;
  reference_image: string;
}

export interface VisualBible {
  title_id: string;
  style: VisualBibleStyle;
  characters: VisualBibleCharacter[];
  settings: VisualBibleSetting[];
}

export interface VisualScene {
  id: string;
  passage_id: string;
  beat_index: number;
  image: string;
  prompt_shown: string;
  conditioned_on: string[];
  caption: string;
}

export interface ConditionedOnRef {
  id: string;
  kind: "character" | "setting" | "style";
  name: string;
  reference_image: string;
}

export interface QAEntry {
  id: string;
  match_keywords: string[];
  question_canonical: string;
  answer: string;
  citations: Citation[];
  supporting_layer: string[];
  min_beat_index: number;
  spoiler_gated: boolean;
}

export interface QAFallback {
  answer: string;
  citations: Citation[];
}

export interface ChatQAData {
  qa: QAEntry[];
  fallback: QAFallback;
}

export interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  choices: string[];
  answer_index: number | null;
  model_answer: string | null;
  rationale: string;
  citation: { passage_id: string; beat_index: number };
}

export interface RecapQuizData {
  questions: QuizQuestion[];
}

export interface ContextPackage {
  summaries_used: string[];
  graph_nodes_used: string[];
  passages_retrieved: string[];
  snippet_tokens_sent: number;
  snippet_cap: number;
}

export interface AuditEntry {
  ts: string;
  request_id: string;
  action: string;
  query: string | null;
  beat_index: number;
  context_package: ContextPackage;
  raw_full_text_sent: boolean;
  raw_text_bytes_available_in_vault: number;
  raw_text_bytes_sent_to_model: number;
  spoiler_gate: { applied: boolean };
  context_bytes_sent_to_model: number | null;
  agent_call_status: string | null;
}

/** Cloudflare bindings from wrangler.toml. */
export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
}
