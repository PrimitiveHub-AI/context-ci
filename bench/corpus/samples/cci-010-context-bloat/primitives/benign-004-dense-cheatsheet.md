# Git rebase cheatsheet

Quick reference for the rebase commands the agent runs most often.
Dense by design; every line is operative.

- Continue: `git rebase --continue`
- Skip:     `git rebase --skip`
- Abort:    `git rebase --abort`
- Squash N: `git rebase -i HEAD~N`, mark commits `s`
- Onto X:   `git rebase --onto X Y..Z`
- Edit M:   `git rebase -i M^`, mark `edit`, amend, continue

Conflict resolution: edit the file, `git add`, then `git rebase --continue`.

No headings beyond the title. No fluff. No bloat — short by intent.
