-- =============================================================================

-- PrestaShop 8 — Renommer MyoConcept / MyoRetro → Maillot Concept / Maillot Retro

-- + créer les sous-catégories enfant sous « Maillot - Enfant » (ID 12 par défaut)

--

-- À exécuter si vous aviez déjà lancé prestashop-import-extra-categories.sql

-- avec les anciens noms MyoConcept / MyoRetro.

--

-- Après exécution : BO → Catalogue → Catégories → Reconstruire l'arborescence

-- Puis mettez à jour .env.local avec les IDs affichés en fin de script.

-- =============================================================================



SET @id_lang = 1;

SET @id_shop = 1;



-- ── Renommer les catégories adultes (IDs connus : 47, 48) ──────────────────



UPDATE ps_category_lang

SET name = 'Maillot Concept',

    link_rewrite = 'maillot-concept',

    meta_title = 'Maillot Concept'

WHERE id_lang = @id_lang AND id_category = 47;



UPDATE ps_category_lang

SET name = 'Maillot Retro',

    link_rewrite = 'maillot-retro',

    meta_title = 'Maillot Retro'

WHERE id_lang = @id_lang AND id_category = 48;



-- Renommage par nom (si les IDs diffèrent)

UPDATE ps_category_lang

SET name = 'Maillot Concept',

    link_rewrite = 'maillot-concept',

    meta_title = 'Maillot Concept'

WHERE id_lang = @id_lang

  AND (name IN ('MyoConcept', 'Myoconcept', 'Myo Concept')

       OR link_rewrite IN ('myoconcept', 'myo-concept'));



UPDATE ps_category_lang

SET name = 'Maillot Retro',

    link_rewrite = 'maillot-retro',

    meta_title = 'Maillot Retro'

WHERE id_lang = @id_lang

  AND (name IN ('MyoRetro', 'Myoretro', 'Myo Retro')

       OR link_rewrite IN ('myoretro', 'myo-retro'));



-- ── Sous-catégories enfant ─────────────────────────────────────────────────



SET @enfant_maillots = 12;



SELECT id_category INTO @enfant_maillots_found

FROM ps_category_lang

WHERE id_lang = @id_lang

  AND (name = 'Maillot - Enfant' OR name LIKE '%Maillot%Enfant%')

LIMIT 1;



SET @enfant_parent = IFNULL(@enfant_maillots_found, @enfant_maillots);



DROP PROCEDURE IF EXISTS footshop_add_category_if_missing;



DELIMITER $$



CREATE PROCEDURE footshop_add_category_if_missing(

  IN p_parent INT,

  IN p_name VARCHAR(128),

  IN p_rewrite VARCHAR(128),

  IN p_position INT

)

BEGIN

  SELECT id_category INTO @existing_id

  FROM ps_category_lang

  WHERE id_lang = @id_lang AND name = p_name

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



CALL footshop_add_category_if_missing(@enfant_parent, 'Maillot Concept', 'maillot-concept-enfant', 20);

SET @cat_enfant_concept = @last_category_id;



CALL footshop_add_category_if_missing(@enfant_parent, 'Maillot Retro', 'maillot-retro-enfant', 21);

SET @cat_enfant_retro = @last_category_id;



CALL footshop_add_category_if_missing(@enfant_parent, 'Le reste du monde', 'le-reste-du-monde-enfant', 22);

SET @cat_enfant_reste = @last_category_id;



DROP PROCEDURE IF EXISTS footshop_add_category_if_missing;



-- ── Résultat : IDs à copier dans .env.local ────────────────────────────────



SELECT 47 AS adult_maillot_concept_id,

       48 AS adult_maillot_retro_id,

       @cat_enfant_concept AS enfant_maillot_concept_id,

       @cat_enfant_retro AS enfant_maillot_retro_id,

       @cat_enfant_reste AS enfant_maillot_reste_du_monde_id;



SELECT c.id_category, c.id_parent, cl.name, cl.link_rewrite

FROM ps_category c

JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang

WHERE cl.name IN ('Maillot Concept', 'Maillot Retro', 'Le reste du monde')

   OR c.id_category IN (@cat_enfant_concept, @cat_enfant_retro)

ORDER BY c.id_parent, c.position;

