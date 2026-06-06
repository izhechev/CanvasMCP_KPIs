# CI/CD Deployment Design

**Date:** 2026-06-06
**Status:** Approved

## Goal

Extend the existing GitHub Actions CI workflow to automatically deploy to AKS after every successful push to `main`.

## Architecture

Single workflow file (`.github/workflows/ci.yml`). A new `deploy` job is appended after the existing `ci` job.

```
push to main → ci job (lint, type-check, build, test, e2e) → deploy job
pull_request  → ci job only (deploy is skipped)
```

## Job Structure

### Existing `ci` job
Unchanged. Runs on both `push` and `pull_request` events.

### New `deploy` job

```yaml
needs: ci
if: github.event_name == 'push'
runs-on: ubuntu-24.04
```

**Steps:**

1. `actions/checkout@v6` — required for `az acr build` context
2. `azure/login@v2` — authenticates with Service Principal stored in `AZURE_CREDENTIALS` GitHub secret
3. **Build & push image** — `az acr build --registry canvasmcpacr --image canvasmcp:${{ github.sha }} --image canvasmcp:latest .`
   - Builds in ACR (no local Docker daemon needed)
   - Tags as both commit SHA and `:latest`
4. **Get AKS credentials** — `az aks get-credentials --resource-group canvasmcp-rg --name canvasmcp-aks`
5. **Rolling update** — `kubectl set image deployment/canvasmcp canvasmcp=canvasmcpacr.azurecr.io/canvasmcp:${{ github.sha }}`
   - Targets the exact commit image, not `:latest`, for traceability and safe rollback
6. **Rollout wait** — `kubectl rollout status deployment/canvasmcp --timeout=120s`
   - Job fails (and GitHub marks the push red) if pods don't become ready within 2 minutes

## Secrets Required

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | Service Principal JSON (already configured) |

## Failure Behaviour

- If `ci` fails → `deploy` is blocked (never runs)
- If ACR build fails → job fails, AKS deployment is not touched
- If rollout times out → job fails, pod is left in whatever state it reached (investigate with `kubectl get pods`)

## Rollback

To roll back manually:
```bash
kubectl set image deployment/canvasmcp canvasmcp=canvasmcpacr.azurecr.io/canvasmcp:<previous-sha>
```

Previous SHAs are visible in GitHub Actions run history.

## Files Changed

- `.github/workflows/ci.yml` — append `deploy` job
