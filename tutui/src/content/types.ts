/** A bite-sized piece of a lesson (one screen in Learn mode). */
export interface Chunk {
  /** Stable-ish id used for progress tracking: `<part-slug>/<section-slug>#<n>`. */
  id: string;
  /** Position within the module (0-based). */
  index: number;
  /** module › part › section */
  breadcrumb: string[];
  /** Markdown body (without the section heading; the breadcrumb shows it). */
  markdown: string;
  /** "(2/3)" style marker when a long section was split. */
  part?: { n: number; of: number };
}

/** One `## N. Title` section from EXAMPLES.md. */
export interface Example {
  number: number;
  title: string;
  markdown: string;
}

export interface QuizOption {
  letter: string;
  text: string;
}

export interface Question {
  /** Globally unique: `<moduleId>:<quizSlug>:Q<n>`. */
  id: string;
  /** Short id shown to the user and logged as a weak spot, e.g. `Q3`. */
  label: string;
  number: number;
  quizTitle: string;
  stem: string;
  options: QuizOption[];
  /** Correct letters, sorted. Length > 1 means multiple-response. */
  answer: string[];
  rationale: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}

export interface ParseResult<T> {
  value: T;
  /** Human-readable problems found while parsing (never thrown). */
  errors: string[];
}

export interface DomainInfo {
  name: string;
  weight: string;
}

export interface Module {
  /** Folder name, e.g. `01-mso-foundations`. */
  id: string;
  dir: string;
  number: number;
  title: string;
  /** e.g. "Model Selection & Optimisation — 16.8% of the exam." */
  domainLine?: string;
  domains: DomainInfo[];
  chunks: Chunk[];
  examples: Example[];
  quizzes: Quiz[];
  errors: string[];
  hasNotes: boolean;
}
