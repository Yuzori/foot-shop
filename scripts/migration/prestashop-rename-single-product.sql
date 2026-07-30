-- =============================================================================
-- PrestaShop — Renommer un produit invisible BO + diagnostic
-- Remplace @product_id et le nom ci-dessous.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;
SET @product_id := 530;
SET @new_name := 'Maillot PSG Domicile 25-26';
SET @new_slug := 'maillot-psg-domicile-25-26';

-- ── 1) DIAGNOSTIC : quelles lignes lang existent pour ce produit ? ───────────

SELECT id_product, id_shop, id_lang, name, link_rewrite
FROM ps_product_lang
WHERE id_product = @product_id
ORDER BY id_shop, id_lang;

-- Si tu ne vois PAS id_shop=1 → c'est pour ça que ton UPDATE ne faisait rien.

SELECT
  p.id_product,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  ps.indexed,
  p.id_category_default,
  p.price
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.id_product = @product_id;

-- ── 2) RENOMMER — toutes les lignes lang de ce produit (shop 0 ET 1) ────────

UPDATE ps_product_lang
SET
  name = @new_name,
  link_rewrite = @new_slug
WHERE id_product = @product_id
  AND id_lang = @id_lang;

-- Si 0 ligne modifiée : créer la ligne shop=1
INSERT INTO ps_product_lang (
  id_product, id_shop, id_lang, name, link_rewrite, description, description_short, meta_title
)
SELECT
  pl.id_product,
  @shop_id,
  pl.id_lang,
  @new_name,
  @new_slug,
  pl.description,
  pl.description_short,
  pl.meta_title
FROM ps_product_lang pl
LEFT JOIN ps_product_lang pl2
  ON pl2.id_product = pl.id_product
 AND pl2.id_shop = @shop_id
 AND pl2.id_lang = pl.id_lang
WHERE pl.id_product = @product_id
  AND pl.id_lang = @id_lang
  AND pl2.id_product IS NULL
LIMIT 1;

-- Forcer visible BO
UPDATE ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.active = 1,
  ps.active = 1,
  p.visibility = 'both',
  ps.visibility = 'both',
  ps.indexed = 1,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.id_product = @product_id;

-- ── 3) VÉRIFICATION ───────────────────────────────────────────────────────────

SELECT id_product, id_shop, id_lang, name, link_rewrite
FROM ps_product_lang
WHERE id_product = @product_id;

SELECT
  CASE
    WHEN p.active = 1 AND ps.active = 1 AND ps.visibility IN ('both','catalog')
     AND EXISTS (
       SELECT 1 FROM ps_product_lang x
       WHERE x.id_product = p.id_product AND x.id_shop = @shop_id AND x.id_lang = @id_lang
         AND TRIM(x.name) <> '' AND x.name NOT LIKE 'Produit #%'
     )
    THEN 'DOIT APPARAITRE BO'
    ELSE 'ENCORE BLOQUE'
  END AS statut_bo
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.id_product = @product_id;

-- Nom déjà pris par un autre produit ? (doublon = peut rester caché)
SELECT p.id_product, pl.name
FROM ps_product_lang pl
JOIN ps_product p ON p.id_product = pl.id_product
WHERE pl.id_shop = @shop_id AND pl.id_lang = @id_lang
  AND pl.name = @new_name
  AND p.id_product <> @product_id
  AND p.active = 1;
