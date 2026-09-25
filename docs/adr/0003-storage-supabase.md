# 3. Storage de imagens: Supabase Storage, não Cloudflare R2

Aceita · 25/09/2026

## Contexto
Logo, capa e fotos de produto precisam de storage público. Documentos anteriores citavam Cloudflare R2. O banco já está no Supabase.

## Decisão
Usar o **Supabase Storage** pela API S3-compatível (`@aws-sdk/client-s3` em `apps/api/src/lib/storage.ts`), com bucket público. O motivo é custo: o Storage já vem no plano do Supabase que pagamos pelo Postgres, enquanto o R2 seria mais um fornecedor, com conta e cobrança próprias.

## Consequências
- Um fornecedor a menos para gerenciar.
- O código só fala S3, então trocar para R2 (ou MinIO) é mudar as variáveis `STORAGE_S3_*` e `STORAGE_PUBLIC_URL`, sem mexer em código.
- Vale revisitar se o tráfego de imagens crescer: o R2 não cobra egress e pode sair mais barato em volume.
