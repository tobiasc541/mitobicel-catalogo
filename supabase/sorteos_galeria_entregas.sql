
-- Galería pública de entregas: archivo histórico SIN DATOS PERSONALES.
create or replace function public.raffle_public_deliveries()
returns table(period text,prize text,delivered_at timestamptz,video_url text,photo_url text)
language sql stable security definer set search_path='' as $$
 select c.period,w.prize,w.delivered_at,w.delivery_video_url,w.delivery_photo_url
 from public.raffle_winners w join public.raffle_campaigns c on c.id=w.campaign_id
 where c.results_published=true and w.delivered_at is not null
   and (length(w.delivery_video_url)>0 or length(w.delivery_photo_url)>0)
 order by w.delivered_at desc limit 48;
$$;
revoke all on function public.raffle_public_deliveries() from public,anon,authenticated;
grant execute on function public.raffle_public_deliveries() to anon,authenticated;
