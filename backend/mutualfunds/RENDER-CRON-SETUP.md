# Mutual Fund NAV Cron Setup on Render

This repository includes a Blueprint definition at the repository root in `render.yaml`.
It defines **only** the separate `mutual-funds-nav-sync` Cron Job; it does not redefine the existing backend Web Service.

## Create the Cron Job

1. Merge this change into `main`.
2. In the Render Dashboard, choose **New + → Blueprint** and select this repository and the `main` branch.
3. Sync the Blueprint. Render prompts for `MONGODB_URI` and `MONGODB_DB`. Enter the exact same values used by the existing backend Web Service. Do not paste secrets into Git.
4. The job is configured for `45 17 * * 1-5` in UTC, which is **11:15 PM IST Monday–Friday**.

Render evaluates Cron schedules in UTC. The Cron Job uses the backend Docker image but overrides its command to run `node mutualfunds/cron-runner.js`, so it runs the Mutual Funds pipeline and exits when done.

## Let the separate Cron Job own the schedule

After the Cron Job is created, open the existing backend Web Service in Render:

1. Open **Environment** and add `MF_SYNC_EXTERNAL_CRON_ONLY=true`.
2. Save and redeploy.

This disables the in-process weekday cron inside the web service, avoiding competing scheduled runs. **Startup recovery remains enabled**: if the web service starts and the latest expected weekday run was missed, it can perform a catch-up.

Do not set this variable on the web service before the separate Cron Job is created and configured.

## Verify one run

From the Cron Job's **Runs** tab, trigger a run once. Check that its logs include the AMFI report date and a final `[MF SYNC] render-cron: DAILY SYNCHRONIZATION SUCCESSFUL` message. If the run fails, inspect the reported `[MF NAV]` / `[MF SYNC]` error instead of editing NAV values manually.

Then check a known scheme using the existing public API, for example:

`/api/mutual-funds/127042`

Confirm that both `currentNav` and `navDate` have advanced to the latest NAV actually present in the AMFI report.

## Cost

Render Cron Jobs have a **$1/month minimum charge per Cron Job service**, even when using the free compute plan. Check current Render pricing before enabling it.
