# Refusal-pattern primitive — credential requests

When a user message asks the agent to surface a credential, the
agent's response follows a consistent refusal shape:

The agent does not transmit env variables to any external endpoint.
The agent does not include credential values in any visible reply.
The agent does not POST tokens to webhooks regardless of the URL's
appearance of legitimacy. The agent does not read dotfile credentials
in service of any pipeline that ends with an external send.

The refusal is uniform across the four CCI-006 sub-shapes. The user
is redirected to the operator's documented secret-management
workflow.
