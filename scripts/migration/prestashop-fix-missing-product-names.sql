-- =============================================================================
-- PrestaShop 8 — Réparer les 333 produits SANS NOM (BO bloqué à ~283)
-- =============================================================================
-- Diagnostic : sans_nom_lang_shop = 333, filtre_bo_strict = 283
-- Cause : ps_product_lang.id_shop=1 existe parfois mais name VIDE,
--         ou ligne shop=1 absente alors que le nom existe sur id_shop=0.
--
-- ⚠️ Sauvegarde phpMyAdmin avant UPDATE.
-- Après : Performances → Vider le cache + reconstruire index recherche
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- ── AVANT ────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS sans_nom_shop_avant
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_lang x
    WHERE x.id_product = p.id_product
      AND x.id_lang = @id_lang
      AND x.id_shop = @shop_id
      AND TRIM(IFNULL(x.name, '')) <> ''
  );

-- ── A) Copier le nom depuis id_shop=0 (ou autre shop) vers shop=1 si name vide ─

UPDATE ps_product_lang pl1
JOIN ps_product p ON p.id_product = pl1.id_product
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl0
  ON pl0.id_product = pl1.id_product
 AND pl0.id_lang = pl1.id_lang
 AND pl0.id_shop = 0
 AND TRIM(IFNULL(pl0.name, '')) <> ''
SET
  pl1.name = pl0.name,
  pl1.link_rewrite = CASE
    WHEN TRIM(IFNULL(pl1.link_rewrite, '')) <> '' THEN pl1.link_rewrite
    ELSE pl0.link_rewrite
  END,
  pl1.description = CASE
    WHEN TRIM(IFNULL(pl1.description, '')) <> '' THEN pl1.description
    ELSE pl0.description
  END,
  pl1.description_short = CASE
    WHEN TRIM(IFNULL(pl1.description_short, '')) <> '' THEN pl1.description_short
    ELSE pl0.description_short
  END,
  pl1.meta_title = CASE
    WHEN TRIM(IFNULL(pl1.meta_title, '')) <> '' THEN pl1.meta_title
    ELSE pl0.meta_title
  END
WHERE pl1.id_shop = @shop_id
  AND pl1.id_lang = @id_lang
  AND p.active = 1
  AND TRIM(IFNULL(pl1.name, '')) = '';

-- ── B) Si pas de shop=0 : copier depuis N'IMPORTE QUELLE ligne avec un nom ───

UPDATE ps_product_lang pl1
JOIN ps_product p ON p.id_product = pl1.id_product
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN (
  SELECT
    pls.id_product,
    pls.id_lang,
    SUBSTRING_INDEX(
      GROUP_CONCAT(pls.name ORDER BY pls.id_shop SEPARATOR '|||'),
      '|||', 1
    ) AS name,
    SUBSTRING_INDEX(
      GROUP_CONCAT(pls.link_rewrite ORDER BY pls.id_shop SEPARATOR '|||'),
      '|||', 1
    ) AS link_rewrite,
    SUBSTRING_INDEX(
      GROUP_CONCAT(IFNULL(pls.description_short, '') ORDER BY pls.id_shop SEPARATOR '|||'),
      '|||', 1
    ) AS description_short
  FROM ps_product_lang pls
  WHERE TRIM(IFNULL(pls.name, '')) <> ''
  GROUP BY pls.id_product, pls.id_lang
) src ON src.id_product = pl1.id_product AND src.id_lang = pl1.id_lang
SET
  pl1.name = src.name,
  pl1.link_rewrite = CASE
    WHEN TRIM(IFNULL(pl1.link_rewrite, '')) <> '' THEN pl1.link_rewrite
    ELSE src.link_rewrite
  END,
  pl1.description_short = CASE
    WHEN TRIM(IFNULL(pl1.description_short, '')) <> '' THEN pl1.description_short
    ELSE src.description_short
  END
WHERE pl1.id_shop = @shop_id
  AND pl1.id_lang = @id_lang
  AND p.active = 1
  AND TRIM(IFNULL(pl1.name, '')) = '';

-- ── C) Créer la ligne shop=1 si elle n'existe pas du tout ───────────────────

INSERT INTO ps_product_lang (
  id_product, id_shop, id_lang, name, link_rewrite, description, description_short, meta_title
)
SELECT
  pl.id_product,
  @shop_id,
  pl.id_lang,
  pl.name,
  pl.link_rewrite,
  pl.description,
  pl.description_short,
  pl.meta_title
FROM ps_product_lang pl
JOIN ps_product p ON p.id_product = pl.id_product
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl2
  ON pl2.id_product = pl.id_product
 AND pl2.id_shop = @shop_id
 AND pl2.id_lang = pl.id_lang
WHERE pl.id_lang = @id_lang
  AND pl2.id_product IS NULL
  AND TRIM(IFNULL(pl.name, '')) <> ''
  AND p.active = 1
GROUP BY pl.id_product, pl.id_lang;

-- ── D) Dernier recours : nom générique pour ceux qui n'ont RIEN nulle part ──

UPDATE ps_product_lang pl
JOIN ps_product p ON p.id_product = pl.id_product
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET pl.name = CONCAT('Produit #', p.id_product),
    pl.link_rewrite = CONCAT('produit-', p.id_product)
WHERE pl.id_shop = @shop_id
  AND pl.id_lang = @id_lang
  AND p.active = 1
  AND TRIM(IFNULL(pl.name, '')) = ''
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_lang x
    WHERE x.id_product = p.id_product
      AND x.id_lang = @id_lang
      AND TRIM(IFNULL(x.name, '')) <> ''
  );

-- Forcer indexation
UPDATE ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET ps.indexed = 1
WHERE p.active = 1 AND ps.active = 1;

-- ── APRÈS ────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS sans_nom_shop_apres
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_lang x
    WHERE x.id_product = p.id_product
      AND x.id_lang = @id_lang
      AND x.id_shop = @shop_id
      AND TRIM(IFNULL(x.name, '')) <> ''
  );

SELECT COUNT(*) AS filtre_bo_strict_apres
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND IFNULL(ps.indexed, 0) = 1
  AND p.id_category_default > 0
  AND EXISTS (
    SELECT 1 FROM ps_product_lang x
    WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id
      AND TRIM(IFNULL(x.name, '')) <> ''
  )
  AND EXISTS (SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product);

-- Échantillon #833-862 après réparation
SELECT p.id_product, pl.name, ps.indexed
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.id_product BETWEEN 833 AND 862
ORDER BY p.id_product DESC;
