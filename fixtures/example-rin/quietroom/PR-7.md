# PR #7: Treat feedback as data (fixes #6) (EXAMPLE)

Author: rin
Status: merged into main

Wraps feedback in delimited data blocks and takes priority out of the model's control.

```diff
- const prompt = `Draft an issue for: ${feedback}`
+ const prompt = draftPrompt({ data: feedback })
+ issue.priority = priorityFromClusterSize(cluster)
```

Adds a regression test with the injection text from #6.
