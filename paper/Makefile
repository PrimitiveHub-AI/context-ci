# paper/Makefile — local build + drift gate for the arXiv source.
#
# Discipline lives in paper/README.md:
#   - No invented numbers (every quantity sources from docs/ or bench/)
#   - Banned vocabulary check applied
#   - Cited keys must exist in references.bib
#
# CI runs only `make paper-check` (no LaTeX toolchain dependency).
# Local builds use `make paper` (requires latexmk + a TeX distribution
# such as TeX Live or MacTeX).

.PHONY: paper paper-check paper-clean paper-help

# Default — render the PDF locally. Requires latexmk.
paper:
	@command -v latexmk >/dev/null 2>&1 || \
	  { echo >&2 "latexmk not found; install TeX Live or MacTeX."; exit 2; }
	latexmk -pdf -interaction=nonstopmode main.tex

# Citation-coverage gate. Verifies every \cite{key} in sections/*.tex
# is defined in references.bib. CI runs this step; it requires no
# LaTeX toolchain.
paper-check:
	@echo "==> paper-check: verifying \\cite{} coverage against references.bib"
	@cited=$$(mktemp); \
	 bib=$$(mktemp); \
	 trap "rm -f $$cited $$bib" EXIT; \
	 grep -h -oE '\\cite(\[[^]]*\])?\{[^}]+\}' sections/*.tex \
	   | grep -oE '\{[^}]+\}$$' \
	   | tr -d '{}' \
	   | tr ',' '\n' \
	   | LC_ALL=C sort -u > $$cited; \
	 grep -oE '^@[A-Za-z]+\{[^,]+,' references.bib \
	   | sed 's/^@[A-Za-z]*{//;s/,$$//' \
	   | LC_ALL=C sort -u > $$bib; \
	 missing=$$(comm -23 $$cited $$bib); \
	 if [ -n "$$missing" ]; then \
	   echo "FAIL: cited keys missing from references.bib:"; \
	   echo "$$missing" | sed 's/^/  - /'; \
	   exit 1; \
	 fi; \
	 cited_count=$$(wc -l < $$cited); \
	 bib_count=$$(wc -l < $$bib); \
	 echo "OK: $$cited_count cited keys all present in references.bib ($$bib_count total entries)"

# Remove latexmk-generated aux files. Does NOT touch main.tex, .bib,
# or sections/*.tex — those are tracked sources.
paper-clean:
	@command -v latexmk >/dev/null 2>&1 && latexmk -C || true
	@rm -f *.aux *.bbl *.blg *.log *.out *.toc *.fdb_latexmk *.fls

paper-help:
	@echo "Targets:"
	@echo "  make paper        — render main.tex to main.pdf locally (needs latexmk)"
	@echo "  make paper-check  — citation-coverage gate (no LaTeX needed; CI runs this)"
	@echo "  make paper-clean  — remove latexmk-generated aux files"
