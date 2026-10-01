#!/usr/bin/env bash
# Deploy on the VM (README "Deploy na VM"). Run from the clone, as a user in the docker group:
#   deploy/deploy.sh               master: git pull --ff-only → build → migrations + buckets → up -d → waits for the healthcheck
#   deploy/deploy.sh <commit>      rollback: the same with that commit, except the migrations (the database keeps its schema)
#   SEED_DEMO_PASSWORD='…' deploy/deploy.sh seed-demo
#                                  once, after the first deploy, on the empty production database: the Chapa 27 demo
# The dev seed (prisma/seed.ts: wipes the database, logins with senha123) is refused here, and by seed.ts itself in production.
set -euo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose -f deploy/docker-compose.prod.yml "$@"; }

# All in a function: bash reads it whole before running, so a rollback checking out another deploy.sh can't change it midway.
main() {
case "${1:-}" in
  seed | db:seed)
    echo "Recusado: o seed de dev (prisma/seed.ts) apaga o banco e cria logins com senha123. Em produção: deploy/deploy.sh seed-demo." >&2
    exit 1 ;;
esac
[ -f deploy/.env ] || { echo "Falta deploy/.env: cp deploy/.env.example deploy/.env e preencha." >&2; exit 1; }

case "${1:-}" in
  seed-demo)
    [ -n "${SEED_DEMO_PASSWORD:-}" ] || { echo "Defina a senha dos logins do Chapa 27: SEED_DEMO_PASSWORD='…' deploy/deploy.sh seed-demo" >&2; exit 1; }
    # seed-demo.ts never deletes anything and stops if the restaurant already exists.
    compose run --rm -e SEED_DEMO_PASSWORD api npm run db:seed:demo
    exit ;;
  "")
    git checkout -q master # leaves a rollback's detached HEAD
    git pull --ff-only ;;
  *)
    git fetch -q origin
    git checkout -q --detach "$1" ;;
esac

compose build api
[ -n "${1:-}" ] || compose run --rm api npm run db:deploy
compose up -d --remove-orphans

for _ in $(seq 60); do
  case "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)")" in
    healthy) echo "No ar: $(git log -1 --format='%h %s (%cd)' --date=format:'%d/%m/%Y %H:%M')"; exit 0 ;;
    unhealthy) break ;;
  esac
  sleep 2
done
compose logs --tail 50 api
echo "A API não ficou saudável. Para voltar: deploy/deploy.sh <commit anterior> (git log --oneline)." >&2
exit 1
}
main "$@"
