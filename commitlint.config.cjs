/**
 * Commit message format: <type>(<scope>): <description>
 * Enforced on every commit by the Husky `commit-msg` hook.
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "style",
        "refactor",
        "test",
        "build",
        "ci",
        "perf",
        "revert",
      ],
    ],
    "subject-empty": [2, "never"],
    "subject-full-stop": [1, "never"],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 100],
  },
};
