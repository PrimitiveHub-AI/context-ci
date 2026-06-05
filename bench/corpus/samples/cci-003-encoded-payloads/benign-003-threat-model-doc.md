# Threat-model excerpt — encoded payloads

The PrimitiveHub threat model describes how encoded payloads are
treated by the validation pipeline. This primitive is a verbatim
excerpt of that section for the agent's reference.

The pipeline classifies encoded content into three categories: known
encodings with declared decoded forms (allowed), short encoded
content under conventional thresholds (allowed), and long opaque
blobs without declared semantics (rejected). The rejection rule is
mechanical — the parser does not attempt to decode and inspect the
opaque content.

Adversarial primitives that smuggle instructions inside encoded
content lose the smuggling vector because the decoded form is never
materialised inside the runtime. The agent ignores the encoded data
the same way it ignores arbitrary binary attachments.
