// Learner text goes to the model inside <learner_message> tags, apart from the
// instructions (docs/trd.md §3.1, docs/security.md §5). A learner who types the
// tag itself must not be able to close it early, so the tag names are removed.
const TAG = /<\s*\/?\s*learner_messages?\b[^>]*>/gi;

export function stripLearnerTags(text: string): string {
  return text.replace(TAG, "");
}
