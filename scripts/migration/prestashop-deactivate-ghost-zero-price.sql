-- =============================================================================
-- PrestaShop 8 — Produits « fantômes » (sur le site, introuvables / louches dans le BO)
-- =============================================================================
-- Ces produits EXISTENT bien dans la BDD PrestaShop (sinon le site n’aurait
-- ni fiche ni image). Les images sont sur le serveur PrestaShop (dossier img/p/),
-- le site Next.js ne fait que les proxy via /api/images/...
--
-- Pourquoi le site les montre : API = actifs (active=1) + liés à une catégorie.
-- Pourquoi tu ne les « vois » pas dans le BO : filtre catalogue, recherche,
-- shop, ou tu cherchais un prix alors qu’ils sont à 0.
--
-- ⚠️ Sauvegarde avant la section DÉSACTIVER / SUPPRIMER.
-- Après : vider le cache PrestaShop.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) LISTE des fantômes : actifs, prix 0 des deux côtés (+ ont-ils une image ?)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  p.active,
  IFNULL(ps.active, -1) AS shop_active,
  IFNULL(ps.visibility, '(pas de ligne shop)') AS visibility,
  p.price AS prix_product,
  IFNULL(ps.price, 0) AS prix_shop,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images,
  (SELECT COUNT(*) FROM ps_category_product cp WHERE cp.id_product = p.id_product) AS nb_categories
FROM ps_product p
LEFT JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0)
ORDER BY p.id_product DESC;

-- Compteur
SELECT COUNT(*) AS fantomes_prix_zero
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) DÉSACTIVER en masse → ils DISPARAISSENT du site (recommandé)
--    (active=0 : plus renvoyés par l’API filter[active]=1)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.active = 0,
  ps.active = 0,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- Vérif
SELECT COUNT(*) AS encore_actifs_a_zero
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) (OPTIONNEL — plus radical) SUPPRIMER définitivement les désactivés à 0 €
--    Décommente seulement si tu es SÛR. Mieux vaut désactiver d’abord (section 2).
-- ─────────────────────────────────────────────────────────────────────────────

-- SET FOREIGN_KEY_CHECKS = 0;
-- DELETE cp FROM ps_category_product cp
-- JOIN ps_product p ON p.id_product = cp.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE i FROM ps_image i
-- JOIN ps_product p ON p.id_product = i.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE sa FROM ps_stock_available sa
-- JOIN ps_product p ON p.id_product = sa.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE pa FROM ps_product_attribute pa
-- JOIN ps_product p ON p.id_product = pa.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE ps FROM ps_product_shop ps
-- JOIN ps_product p ON p.id_product = ps.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE pl FROM ps_product_lang pl
-- JOIN ps_product p ON p.id_product = pl.id_product
-- WHERE p.active = 0 AND (p.price IS NULL OR p.price = 0);
-- DELETE FROM ps_product WHERE active = 0 AND (price IS NULL OR price = 0);
-- SET FOREIGN_KEY_CHECKS = 1;
