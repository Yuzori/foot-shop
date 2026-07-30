-- =============================================================================
-- PrestaShop 8 — Réparer les catégories invisibles dans le sélecteur BO
-- =============================================================================
-- Symptôme : en modifiant la catégorie d'un produit dans PrestaShop, seules
-- quelques catégories apparaissent (ex. Accueil, World Cup, Maillot-Enfant…)
-- alors que toutes les divisions existent sur le site.
--
-- Cause fréquente : lignes manquantes dans ps_category_shop pour le shop 1
-- (catégories créées via l'API sans association multiboutique).
--
-- ⚠️ Sauvegarde phpMyAdmin obligatoire avant exécution !
--
-- Après ce script :
--   1. Back office → Paramètres avancés → Performances → Vider le cache
--   2. Si l'arborescence reste incomplète, exécutez sur le serveur PrestaShop :
--      php bin/console prestashop:category:regenerate-nested-set
--      (ou via cron / SSH Hostinger)
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- 1) Associer toutes les catégories actives au shop
INSERT INTO ps_category_shop (id_category, id_shop, position)
SELECT c.id_category, @shop_id, c.position
FROM ps_category c
LEFT JOIN ps_category_shop cs
  ON cs.id_category = c.id_category AND cs.id_shop = @shop_id
WHERE cs.id_category IS NULL
  AND c.id_category NOT IN (1);

-- 2) S'assurer que ps_category_lang a une entrée pour ce shop
INSERT INTO ps_category_lang (
  id_category, id_shop, id_lang, name, link_rewrite, description, meta_title
)
SELECT
  c.id_category,
  @shop_id,
  cl.id_lang,
  cl.name,
  cl.link_rewrite,
  cl.description,
  cl.meta_title
FROM ps_category c
JOIN ps_category_lang cl
  ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
LEFT JOIN ps_category_lang cl_shop
  ON cl_shop.id_category = c.id_category
 AND cl_shop.id_shop = @shop_id
 AND cl_shop.id_lang = @id_lang
WHERE cl_shop.id_category IS NULL
  AND c.id_category NOT IN (1);

-- 3) Activer les catégories orphelines
UPDATE ps_category c
JOIN ps_category_shop cs
  ON cs.id_category = c.id_category AND cs.id_shop = @shop_id
SET c.active = 1
WHERE c.active = 0 AND c.id_category NOT IN (1, 2);

-- 4) Vérifications
SELECT COUNT(*) AS categories_total FROM ps_category WHERE id_category NOT IN (1);
SELECT COUNT(*) AS categories_shop_1 FROM ps_category_shop WHERE id_shop = @shop_id;

SELECT c.id_category, cl.name, c.id_parent, c.active
FROM ps_category c
JOIN ps_category_lang cl
  ON cl.id_category = c.id_category AND cl.id_lang = @id_lang AND cl.id_shop = @shop_id
LEFT JOIN ps_category_shop cs
  ON cs.id_category = c.id_category AND cs.id_shop = @shop_id
WHERE cs.id_category IS NULL
LIMIT 20;
