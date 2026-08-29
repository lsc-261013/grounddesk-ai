begin;

create unique index if not exists conversations_anonymous_session_unique
  on public.conversations(workspace_id, anonymous_session_hash)
  where anonymous_session_hash is not null;

drop function if exists public.match_hybrid_chunks(
  uuid,
  uuid,
  extensions.vector,
  text,
  text,
  text,
  integer
);

create function public.match_hybrid_chunks(
  target_workspace_id uuid,
  target_embedding_config_id uuid,
  query_embedding extensions.vector(1024),
  query_text text,
  query_language text,
  product_model text default null,
  result_limit integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  section_path text[],
  page_start integer,
  page_end integer,
  fused_score double precision,
  vector_similarity double precision,
  keyword_score real,
  vector_rank bigint,
  keyword_rank bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible as (
    select chunk.*
    from public.knowledge_chunks chunk
    where chunk.workspace_id = target_workspace_id
      and chunk.embedding_config_id = target_embedding_config_id
      and chunk.embedding is not null
      and (chunk.language = query_language or chunk.language = 'bilingual')
      and (product_model is null or product_model = any(chunk.product_models))
  ),
  vector_candidates as (
    select
      id,
      1 - (embedding operator(extensions.<=>) query_embedding) as similarity,
      row_number() over (
        order by embedding operator(extensions.<=>) query_embedding
      ) as rank
    from eligible
    order by embedding operator(extensions.<=>) query_embedding
    limit greatest(result_limit * 4, 20)
  ),
  keyword_candidates as (
    select
      id,
      ts_rank_cd(search_vector, websearch_to_tsquery('simple', query_text)) as score,
      row_number() over (
        order by ts_rank_cd(search_vector, websearch_to_tsquery('simple', query_text)) desc
      ) as rank
    from eligible
    where search_vector @@ websearch_to_tsquery('simple', query_text)
    order by ts_rank_cd(search_vector, websearch_to_tsquery('simple', query_text)) desc
    limit greatest(result_limit * 4, 20)
  ),
  fused as (
    select
      coalesce(vector_candidates.id, keyword_candidates.id) as id,
      vector_candidates.similarity as vector_similarity,
      keyword_candidates.score as keyword_score,
      vector_candidates.rank as vector_rank,
      keyword_candidates.rank as keyword_rank,
      coalesce(1.0 / (60 + vector_candidates.rank), 0.0)
        + coalesce(1.0 / (60 + keyword_candidates.rank), 0.0) as fused_score
    from vector_candidates
    full outer join keyword_candidates using (id)
  )
  select
    eligible.id,
    eligible.document_id,
    eligible.content,
    eligible.section_path,
    eligible.page_start,
    eligible.page_end,
    fused.fused_score,
    fused.vector_similarity,
    fused.keyword_score,
    fused.vector_rank,
    fused.keyword_rank
  from fused
  join eligible on eligible.id = fused.id
  order by fused.fused_score desc, eligible.id
  limit least(greatest(result_limit, 1), 20);
$$;

grant execute on function public.match_hybrid_chunks(
  uuid,
  uuid,
  extensions.vector,
  text,
  text,
  text,
  integer
) to authenticated, service_role;

commit;
