# Multilingual greetings primitive

This primitive holds canonical greetings the agent uses when the user
selects a non-English locale. Each entry is a legitimate use of
right-to-left script; no bidirectional-control overrides are needed
because each greeting is a self-contained string.

| Locale | Greeting (native) | Greeting (transliteration) |
|---|---|---|
| ar-SA | مرحبا | marhaba |
| he-IL | שלום | shalom |
| fa-IR | سلام | salam |
| ur-PK | السلام علیکم | as-salamu alaykum |

The script direction is handled by the renderer, not by injected
control codepoints in the markdown.
