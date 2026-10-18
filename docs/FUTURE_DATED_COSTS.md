# Future-dated service costs - recommendation (not implemented)

## Current behaviour
A service dated in the future is saved and shown as "Scheduled". It is excluded from maintenance
status, the current odometer and the garage "last service", but its `cost` is still included in
every expense total (`/cars/{id}/expenses`, `/cars/{id}/cost-summary`, `/me/cost-summary`, manager
statistics and parts averages). A planned 900 NIS brake job therefore appears as money already spent.

## Recommendation
Treat money as *spent* only when `service_date <= today`, and report scheduled cost separately.

1. **Single rule in one place** - add `maintenance.happened()`-style filtering to a shared
   `expenses` helper so every endpoint uses the same definition of "actual".
2. **Additive API fields, no breaking change** - keep `total`, `by_type`, `by_month`, `by_year`
   as *actual* spend and add `scheduled_total` (and optional `scheduled_count`) next to them.
   Clients that ignore the new fields keep working; the totals become correct.
3. **UI** - show "Planned: X" as a secondary line under the spend figure, and keep the
   "Scheduled" marker on the timeline. No new screens.
4. **Time-driven** - no migration or flag is needed; a scheduled record turns into actual spend
   automatically when its date arrives.
5. **Manager statistics and parts averages** - use actual (past-dated) records only.
6. **Tests** - one record in the past and one in the future: assert `total` excludes the future
   cost, `scheduled_total` includes it, and both move correctly after editing/deleting.

## Why it is not done yet
It changes numbers users already see, so it needs explicit approval. Effort is small
(one helper, ~5 endpoints, a few tests).
