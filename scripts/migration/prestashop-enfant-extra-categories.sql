-- =============================================================================
-- PrestaShop 8 — Sous-catégories enfant : Maillot Concept, Maillot Retro,
-- Le reste du monde
--
-- Créées sous :
--   • Maillot - Enfant  (ID 12 par défaut)
--   • Enfant - Short    (ID 16 par défaut)
--
-- Idempotent : ne recrée pas une catégorie si le nom existe déjà.
--
-- Après exécution :
--   1. BO → Catalogue → Catégories → Reconstruire l'arborescence
--   2. Copiez les IDs affichés en fin de script dans .env.local
-- =============================================================================

SET @id_lang = 1;
SET @id_shop = 1;

-- Parents par défaut (ajustez si vos IDs diffèrent)
SET @enfant_maillots = 12;
SET @enfant_shorts = 16;

SELECT id_category INTO @enfant_maillots_found
FROM ps_category_lang
WHERE id_lang = @id_lang
  AND (name = 'Maillot - Enfant' OR name LIKE '%Maillot%Enfant%')
LIMIT 1;

SELECT id_category INTO @enfant_shorts_found
FROM ps_category_lang
WHERE id_lang = @id_lang
  AND (name = 'Enfant - Short' OR name LIKE 'Enfant%Short%')
LIMIT 1;

SET @parent_maillots = IFNULL(@enfant_maillots_found, @enfant_maillots);
SET @parent_shorts = IFNULL(@enfant_shorts_found, @enfant_shorts);

DROP PROCEDURE IF EXISTS footshop_add_category_if_missing;

DELIMITER $$

CREATE PROCEDURE footshop_add_category_if_missing(
  IN p_parent INT,
  IN p_name VARCHAR(128),
  IN p_rewrite VARCHAR(128),
  IN p_position INT
)
BEGIN
  SELECT c.id_category INTO @existing_id
  FROM ps_category c
  JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
  WHERE cl.name = p_name
    AND c.id_parent = p_parent
  LIMIT 1;

  IF @existing_id IS NULL THEN
    INSERT INTO ps_category (
      id_parent, level_depth, nleft, nright, active, date_add, date_upd, position, is_root_category
    ) VALUES (
      p_parent, 0, 0, 0, 1, NOW(), NOW(), p_position, 0
    );
    SET @last_category_id = LAST_INSERT_ID();
    INSERT INTO ps_category_lang (id_category, id_shop, id_lang, name, link_rewrite, description, meta_title)
    VALUES (@last_category_id, @id_shop, @id_lang, p_name, p_rewrite, '', p_name);
    INSERT INTO ps_category_shop (id_category, id_shop, position)
    VALUES (@last_category_id, @id_shop, p_position);
  ELSE
    SET @last_category_id = @existing_id;
    UPDATE ps_category SET id_parent = p_parent, date_upd = NOW()
    WHERE id_category = @existing_id;
    UPDATE ps_category_lang
    SET link_rewrite = p_rewrite, meta_title = p_name
    WHERE id_category = @existing_id AND id_lang = @id_lang;
  END IF;
END$$

DELIMITER ;

-- ── Maillot - Enfant ───────────────────────────────────────────────────────

CALL footshop_add_category_if_missing(@parent_maillots, 'Maillot Concept', 'maillot-concept-enfant', 20);
SET @enfant_maillot_concept = @last_category_id;

CALL footshop_add_category_if_missing(@parent_maillots, 'Maillot Retro', 'maillot-retro-enfant', 21);
SET @enfant_maillot_retro = @last_category_id;

CALL footshop_add_category_if_missing(@parent_maillots, 'Le reste du monde', 'le-reste-du-monde-enfant', 22);
SET @enfant_maillot_reste = @last_category_id;

-- ── Enfant - Short ─────────────────────────────────────────────────────────

CALL footshop_add_category_if_missing(@parent_shorts, 'Maillot Concept', 'short-maillot-concept-enfant', 20);
SET @enfant_short_concept = @last_category_id;

CALL footshop_add_category_if_missing(@parent_shorts, 'Maillot Retro', 'short-maillot-retro-enfant', 21);
SET @enfant_short_retro = @last_category_id;

CALL footshop_add_category_if_missing(@parent_shorts, 'Le reste du monde', 'short-le-reste-du-monde-enfant', 22);
SET @enfant_short_reste = @last_category_id;

DROP PROCEDURE IF EXISTS footshop_add_category_if_missing;

-- ── IDs pour .env.local ────────────────────────────────────────────────────

SELECT
  @parent_maillots AS parent_maillot_enfant_id,
  @parent_shorts AS parent_enfant_short_id,
  @enfant_maillot_concept AS enfant_maillot_concept_id,
  @enfant_maillot_retro AS enfant_maillot_retro_id,
  @enfant_maillot_reste AS enfant_maillot_reste_du_monde_id,
  @enfant_short_concept AS enfant_short_concept_id,
  @enfant_short_retro AS enfant_short_retro_id,
  @enfant_short_reste AS enfant_short_reste_du_monde_id;

SELECT c.id_category, c.id_parent, pl.name AS parent_name, cl.name, cl.link_rewrite, c.position
FROM ps_category c
JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
LEFT JOIN ps_category_lang pl ON pl.id_category = c.id_parent AND pl.id_lang = @id_lang
WHERE c.id_parent IN (@parent_maillots, @parent_shorts)
  AND cl.name IN ('Maillot Concept', 'Maillot Retro', 'Le reste du monde')
ORDER BY c.id_parent, c.position;
