# Mutual Fund Backend – Production/Development Sync Model

## Database is the runtime truth source

User-facing mutual-fund endpoints read from `mf_schemes`. Opening a fund does not call MFAPI/AMFI. The active DB row is the value returned to the frontend.

Only `is_active = 1` rows participate in the application and daily sync.

## Daily flow

At 23:15 Asia/Kolkata on weekdays:

1. Download the AMFI Complete NAV report once.
2. Select only the active DB universe (normally the 4,007 active schemes).
3. Update current/previous NAV and daily return fields.
4. Fetch historical NAV only for schemes whose `returns_for_nav_date` does not match the current `nav_date`.
5. Calculate 1Y/3Y/5Y returns and risk from the same historical response.
6. Calculate ratings from values already stored in MySQL; ratings do not make another historical-provider sweep.
7. Store everything in MySQL.
8. Mark `mf_daily_sync` SUCCESS with the processed NAV date.

## Development startup behavior

The database stores the date of the last attempt/success.

Starting `node server.js` multiple times on the same day does not repeatedly call the provider.

If the server starts before 23:15 in development and today's sync has not happened, one startup attempt can run. Further starts the same day use the stored attempt state and do not call the provider again.

If the provider has not published newer data yet, the NAV state remains `PENDING`; the scheduled 23:15 run ignores that pending state and tries again.

## Production startup behavior

Production waits for the scheduled 23:15 run while the server is healthy and continuously running.

If the server was down at 23:15, starting it after the scheduled time triggers a repair run. If NAV was already fetched successfully earlier that day but returns/risk failed, the repair calculates from the DB without re-downloading NAV.

## Concurrency

MySQL advisory locks prevent concurrent NAV and full-sync jobs.

## Required SQL migration

Run:

`sql/005_mf_sync_state_upgrade.sql`

against the `zerodha` database after deploying this backend.

## Active fund universe

The sync intentionally processes only rows where `mf_schemes.is_active = 1`. Keep the desired 4,007 schemes active and set unwanted schemes to `is_active = 0` rather than deleting referenced historical/order records.
