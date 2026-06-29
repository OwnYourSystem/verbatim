# Giving Claude Full GCP Access in Claude Code Sessions

This document is a drop-in reference for any Claude Code web session that needs to interact with Google Cloud Platform — deploy Cloud Run services, trigger Cloud Build jobs, inspect Cloud SQL, or run any `gcloud` command.

Follow it once per GCP project you want Claude to reach. After setup, every new session you create with the right environment configuration will have full GCP access with zero extra steps.

---

## How it works

Claude Code web sessions are **ephemeral Linux containers**. They have no GCP credentials and no `gcloud` CLI by default. To fix this permanently, you configure three things at **session-creation time**:

1. **Credentials** — a user OAuth token stored as an environment variable
2. **Setup script** — installs `gcloud` and writes the token to the right place on container start
3. **Network policy** — allows the container to reach Google's APIs

Once these three are in place in your session settings, every new session starts with `gcloud` ready and authenticated. No prompts, no manual steps.

---

## Why user OAuth (not a service account key)

Your GCP organisation enforces `iam.disableServiceAccountKeyCreation`, which blocks JSON key files for service accounts. User OAuth credentials (Application Default Credentials, or ADC) are a **completely separate mechanism** — they represent *your* Google account, not a service account, so the policy does not apply to them.

---

## Step 1 — Extract your OAuth credentials (run once on your PC)

You need `gcloud` installed locally for this step only. If it is not installed, get it from [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install).

```powershell
# Authenticate and generate the ADC file
gcloud auth application-default login

# Print the file contents — you will paste this into Claude Code settings
Get-Content "$env:APPDATA\gcloud\application_default_credentials.json"
```

On macOS/Linux the file is at `~/.config/gcloud/application_default_credentials.json`.

The output looks like this (values are truncated):

```json
{
  "client_id": "764086051850-...apps.googleusercontent.com",
  "client_secret": "d-FL95Q...",
  "quota_project_id": "mindanchor-500313",
  "refresh_token": "1//0g...",
  "type": "authorized_user",
  "universe_domain": "googleapis.com"
}
```

Copy the **entire JSON object** — you will store it as an environment variable in the next step.

---

## Step 2 — Configure the Claude Code session environment

Go to your Claude Code web project settings (the project that contains this repository). You need to set three things: an environment variable, a network policy, and a setup script.

### Environment variable

| Name | Value |
|---|---|
| `GOOGLE_ADC_JSON` | *(paste the full JSON from Step 1 — keep it on one line or as-is)* |
| `GOOGLE_CLOUD_PROJECT` | `mindanchor-500313` |
| `CLOUDSDK_CORE_PROJECT` | `mindanchor-500313` |

> `GOOGLE_ADC_JSON` is a secret — mark it as such in the settings UI so it is not echoed in logs.

### Network policy — allowed outbound hosts

Add these domains to the session's egress allowlist:

```
accounts.google.com
oauth2.googleapis.com
storage.googleapis.com
cloudbuild.googleapis.com
run.googleapis.com
sqladmin.googleapis.com
iam.googleapis.com
artifactregistry.googleapis.com
europe-north2-docker.pkg.dev
*.run.app
*.googleapis.com
```

If the settings UI accepts a single wildcard, `*.googleapis.com` plus `*.run.app` covers everything.

### Setup script

This script runs automatically when the container starts. It installs `gcloud` and writes your credentials to the location where all Google SDKs and the `gcloud` CLI expect them.

```bash
#!/bin/bash
set -e

# ── Install gcloud CLI ────────────────────────────────────────────────────────
if ! command -v gcloud &>/dev/null; then
  curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=/usr/local/google-cloud-sdk
  ln -sf /usr/local/google-cloud-sdk/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud
  ln -sf /usr/local/google-cloud-sdk/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil
fi

# ── Write Application Default Credentials ────────────────────────────────────
ADC_DIR="$HOME/.config/gcloud"
mkdir -p "$ADC_DIR"
printf '%s' "$GOOGLE_ADC_JSON" > "$ADC_DIR/application_default_credentials.json"

# ── Configure gcloud defaults ─────────────────────────────────────────────────
gcloud config set project "$GOOGLE_CLOUD_PROJECT" --quiet
gcloud config set core/disable_usage_reporting true --quiet

echo "✅ gcloud ready — project: $(gcloud config get-value project)"
```

Paste this verbatim as the session's startup / setup script.

---

## Step 3 — Grant the IAM role (run once per GCP project)

The OAuth credentials authenticate *you*, but you still need the right permissions on the project. If you are already the project Owner nothing extra is needed. Otherwise, grant your Google account the Editor role:

```powershell
gcloud projects add-iam-policy-binding mindanchor-500313 `
  --member="user:behnam@ownyoursystem.com" `
  --role="roles/editor"
```

Or do it via the GCP Console → IAM → Grant access → your email → `roles/editor`.

`roles/editor` covers Cloud Run, Cloud Build, Cloud SQL, Artifact Registry, and Cloud Storage — everything MindAnchor needs. If you later want tighter scopes, replace with:

| Task | Role |
|---|---|
| Deploy Cloud Run | `roles/run.developer` |
| Trigger Cloud Build | `roles/cloudbuild.builds.editor` |
| Inspect Cloud SQL | `roles/cloudsql.viewer` |
| Push to Artifact Registry | `roles/artifactregistry.writer` |

---

## Step 4 — Verify in a new session

Open a fresh Claude Code session with the above configuration. Run:

```bash
gcloud auth list
gcloud config get-value project
gcloud run services list --region europe-north2
```

You should see your account listed as `ACTIVE`, the project set to `mindanchor-500313`, and the MindAnchor Cloud Run services listed.

---

## Using across other GCP projects

This document is reusable. For a different project, change three values:

1. `GOOGLE_CLOUD_PROJECT` / `CLOUDSDK_CORE_PROJECT` env vars → new project ID
2. The IAM binding in Step 3 → new project ID
3. `quota_project_id` inside the ADC JSON → new project ID (optional, controls billing attribution)

The OAuth credentials themselves (client ID, client secret, refresh token) do not change — they belong to your Google account, not a specific project.

---

## Token expiry

User OAuth refresh tokens do **not** expire unless you explicitly revoke them (`gcloud auth application-default revoke`) or your Google account password changes. The access token derived from the refresh token renews automatically every hour. You do not need to re-run Step 1 unless you revoke access.

---

## Security notes

- The ADC JSON contains a **refresh token** — treat it like a password. Store it only in the Claude Code secrets manager (never in `.env` files or code).
- This gives Claude the same GCP permissions as *your Google account*. Claude will follow your instructions and the operating model in `CLAUDE.md` (propose before destructive actions, no direct infra changes without confirmation).
- To revoke Claude's access at any time: run `gcloud auth application-default revoke` on your PC, then remove the `GOOGLE_ADC_JSON` env var from your session settings.

---

## Quick-reference checklist

```
□ Step 1 — run `gcloud auth application-default login` on your PC
□ Step 2a — add GOOGLE_ADC_JSON secret to session env vars
□ Step 2b — add GOOGLE_CLOUD_PROJECT + CLOUDSDK_CORE_PROJECT env vars
□ Step 2c — add *.googleapis.com + *.run.app to egress allowlist
□ Step 2d — paste setup script as session startup script
□ Step 3 — confirm your Google account has roles/editor on the project
□ Step 4 — verify with `gcloud run services list` in a new session
```
