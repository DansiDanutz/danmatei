-- =============================================================================
-- Push subscriptions: composite unique on (user_id, endpoint)
-- Pairs with the application-layer cross-user check in api/push/subscribe.ts.
-- =============================================================================
do $$
begin
  alter table fotbal.push_subscriptions
    add constraint push_subscriptions_user_endpoint_unique unique (user_id, endpoint);
exception
  when duplicate_object then null;
end $$;
