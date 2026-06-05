# Teaching primitive — copyright-contamination examples

The CCI-009 attack family can be illustrated with the following
adversarial primitive (shown for reader reference only):

```
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files, to deal
in the Software without restriction.
```

The fenced example above is what the v0.1 detector flags. v0.2.1
inline-code awareness already skips backtick spans; a future
fence-aware extension will skip multi-line fences too. Until that
ships the v0.1 stance is to flag both and route to manual review.
