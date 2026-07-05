# Authentication

CI/CD pipelines need a non-interactive way to authenticate to your Salesforce orgs. The [sfdx-login](https://github.com/svierk/sfdx-login) building block supports two options. Pick **one** per org and store the resulting credential as a GitHub Actions secret.

> Always use a dedicated **integration user** for CI/CD, never a personal account, and grant it only the permissions it needs.

**The reusable workflows and examples in this kit use the JWT flow (Option A)**, since it does not depend on a refresh token that can expire or be revoked — the closest match to a production-ready setup. The SFDX Auth URL (Option B) is offered as a quicker alternative for local experiments and throwaway scratch orgs.

## Option A — JWT bearer flow (recommended)

Best for production and long-lived sandbox connections, as it does not rely on a refresh token.

1. Create a self-signed certificate with OpenSSL:

   ```bash
   openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt
   ```

2. Create a **connected app** in the org, enable OAuth, upload `server.crt`, and enable the JWT flow. Pre-authorize the integration user via a permission set or profile. See the Salesforce guide [Authorize an Org Using the JWT Flow](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm).

3. Store these three values as repository secrets:

   - `SFDX_CONSUMER_KEY` — the connected app's consumer key (client ID)
   - `SFDX_JWT_SECRET_KEY` — the **contents** of `server.key`
   - `SFDX_USERNAME` — the integration user's username

4. Use them in a workflow:

   ```yaml
   - name: Salesforce Org Login
     uses: svierk/sfdx-login@main
     with:
       client-id: ${{ secrets.SFDX_CONSUMER_KEY }}
       jwt-secret-key: ${{ secrets.SFDX_JWT_SECRET_KEY }}
       username: ${{ secrets.SFDX_USERNAME }}
   ```

## Option B — SFDX Auth URL (quickest)

Best for getting started and for throwaway scratch org / sandbox flows. Note that the reusable workflows in this kit expect the JWT secrets above; to use an Auth URL instead, swap the login step's inputs in your own composed pipeline (see the [getting started guide](getting-started.md)).

1. Authorize the org once on your machine:

   ```bash
   sf org login web --alias my-org
   ```

2. Display the authorization URL and write it to a file:

   ```bash
   sf org display --target-org my-org --verbose --json > authFile.json
   ```

   The URL is the `sfdxAuthUrl` property inside `result`.

3. Storing raw JSON in GitHub secrets is known to cause issues, so Base64-encode the file contents:

   ```bash
   cat authFile.json | base64
   ```

4. Save the resulting Base64 string as a repository secret, e.g. `SFDX_AUTH_URL`.

5. Use it in a workflow:

   ```yaml
   - name: Salesforce Org Login
     uses: svierk/sfdx-login@main
     with:
       sfdx-url: ${{ secrets.SFDX_AUTH_URL }}
       alias: my-org
   ```

## Storing secrets

Add secrets under **Settings → Secrets and variables → Actions** in your repository (or organization). For environment-specific credentials (e.g. separate sandbox and production orgs), use [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) with required reviewers for production deployments. The [deployment workflow](../.github/workflows/deployment.yml) accepts an `environment` input for exactly this — set it to your environment name (see [examples/deployment.yml](../examples/deployment.yml)) and store that environment's credentials as environment-scoped secrets.

## References

- [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [How To Use GitHub Actions, OAuth and SFDX-CLI for Continuous Integration](https://salesforcedevops.net/index.php/2022/04/05/how-to-use-github-actions-oauth-and-sfdx-cli-for-continuous-integration/)
