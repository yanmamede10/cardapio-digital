-- F-6 (02/10/2026): a restaurant the super admin signs up starts without the delivery module — it isn't listed in the
-- customer app until the super admin turns it on. Only the default changes: the restaurants that already exist keep their
-- modules (9i gave every one of them delivery, and stays as it ran).
ALTER TABLE "Restaurant" ALTER COLUMN "planModulesJson" SET DEFAULT '["pedidos","cardapio","mesas","promocoes","atendimento","produtos","relatorios","visao","pagar","receber","fiscal"]';
