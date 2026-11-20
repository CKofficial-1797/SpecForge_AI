const neutralTerms = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "you",
  "i",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "shall",
  "must",
  "may",
  "might",
  "has",
  "have",
  "had",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "without",
  "and",
  "or",
  "but",
  "if",
  "when",
  "then",
  "as",
  "after",
  "before",
  "until",
  "while",
  "into",
  "onto",
  "than",
  "which",
  "who",
  "what",
  "where",
  "why",
  "how",
  "one",
  "two",
  "first",
  "second",
  "only",
  "same",
  "other",
  "more",
  "less",
  "test",
  "case",
  "scenario",
  "verify",
  "check",
  "expected",
  "result",
  "step",
  "steps",
  "criterion",
  "criteria",
  "data",
  "value",
  "name",
  "symbolic",
  "placeholder",
  "stated",
  "supplied",
  "source",
  "explicit",
  "reviewable",
  "draft",
  "limitation",
  "limitations",
  "supported",
  "account",
  "user",
  "system",
]);

const irregularForms: Record<string, string> = {
  sent: "send",
  sends: "send",
  used: "use",
  using: "use",
  was: "be",
  were: "be",
  is: "be",
  are: "be",
  changed: "change",
  changes: "change",
};

const sourceSynonyms: Record<string, string> = {
  associated: "account",
};

/** Finds substantive generated terms not lexically supported by supplied source text. */
export function findUnsupportedTerms(value: string, source: string): string[] {
  const sourceForms = new Set(words(source).flatMap(forms));
  const unsupported = new Set<string>();
  for (const word of words(value)) {
    if (word.length < 3 || neutralTerms.has(word)) continue;
    if (!forms(word).some((form) => sourceForms.has(form)))
      unsupported.add(word);
  }
  return [...unsupported];
}

function words(value: string) {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function forms(word: string): string[] {
  const result = new Set([word]);
  const sourceSynonym = sourceSynonyms[word];
  if (sourceSynonym) result.add(sourceSynonym);
  const irregular = irregularForms[word];
  if (irregular) result.add(irregular);
  if (word.endsWith("ation") && word.length > 7) result.add(word.slice(0, -5));
  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    result.add(stem);
    result.add(`${stem}e`);
  }
  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    result.add(stem);
    result.add(`${stem}e`);
  }
  if (word.endsWith("ies") && word.length > 4)
    result.add(`${word.slice(0, -3)}y`);
  if (word.endsWith("es") && word.length > 4) result.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) result.add(word.slice(0, -1));
  if (word.endsWith("ly") && word.length > 4) result.add(word.slice(0, -2));
  return [...result];
}
