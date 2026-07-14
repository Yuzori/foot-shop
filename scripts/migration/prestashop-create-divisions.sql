-- =============================================================================

-- PrestaShop 8 — Arborescence catégories Foot Shop

-- =============================================================================

-- État actuel (votre base) :

--   2  Accueil

--   11 World Cup        (parent 2) — adulte, déjà OK

--   12 Maillot - Enfant (parent 2) — déjà OK

--   13 CDM              (parent 12) — enfant World Cup, déjà OK

--

-- Ce script crée :

--   • Maillots, Shorts, Enfant - Short (sous Accueil)

--   • Divisions Ligue 1, PL, etc. sous chaque parent

--   • Ne recrée PAS World Cup adulte (11) ni CDM enfant (13)

--

-- ⚠️ Sauvegarde BDD avant exécution.

-- Après : BO → Catalogue → Catégories → « Reconstruire l'arborescence »

-- =============================================================================



SET @id_lang = 1;

SET @id_shop = 1;



-- Parents existants (votre base)

SET @accueil = 2;

SET @maillots_enfant = 12;

SET @world_cup_adulte = 11;   -- déjà créé, ne pas dupliquer



DROP PROCEDURE IF EXISTS footshop_add_category;

DELIMITER $$

CREATE PROCEDURE footshop_add_category(

  IN p_parent INT,

  IN p_name VARCHAR(128),

  IN p_rewrite VARCHAR(128),

  IN p_position INT

)

BEGIN

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

END$$

DELIMITER ;



-- ---------------------------------------------------------------------------

-- 1. Parents manquants sous Accueil (2)

-- ---------------------------------------------------------------------------

CALL footshop_add_category(@accueil, 'Maillots', 'maillots', 1);

SET @maillots_adulte = @last_category_id;



CALL footshop_add_category(@accueil, 'Shorts', 'shorts', 3);

SET @shorts_adulte = @last_category_id;



CALL footshop_add_category(@accueil, 'Enfant - Short', 'enfant-short', 4);

SET @shorts_enfant = @last_category_id;



-- ---------------------------------------------------------------------------

-- 2. Maillots > Adulte (sans World Cup — catégorie 11 séparée)

-- ---------------------------------------------------------------------------

CALL footshop_add_category(@maillots_adulte, 'Ligue 1', 'ligue-1', 1);

CALL footshop_add_category(@maillots_adulte, 'Premier League', 'premier-league', 2);

CALL footshop_add_category(@maillots_adulte, 'La Liga', 'la-liga', 3);

CALL footshop_add_category(@maillots_adulte, 'Serie A', 'serie-a', 4);

CALL footshop_add_category(@maillots_adulte, 'Bundesliga', 'bundesliga', 5);

CALL footshop_add_category(@maillots_adulte, 'Ligue des champions', 'ligue-des-champions', 6);

CALL footshop_add_category(@maillots_adulte, 'Sélections', 'selections', 7);



-- ---------------------------------------------------------------------------

-- 3. Maillot - Enfant > divisions (CDM id 13 déjà présent — pas de doublon)

-- ---------------------------------------------------------------------------

CALL footshop_add_category(@maillots_enfant, 'Ligue 1', 'ligue-1-enfant', 2);

CALL footshop_add_category(@maillots_enfant, 'Premier League', 'premier-league-enfant', 3);

CALL footshop_add_category(@maillots_enfant, 'La Liga', 'la-liga-enfant', 4);

CALL footshop_add_category(@maillots_enfant, 'Serie A', 'serie-a-enfant', 5);

CALL footshop_add_category(@maillots_enfant, 'Bundesliga', 'bundesliga-enfant', 6);

CALL footshop_add_category(@maillots_enfant, 'Ligue des champions', 'ldc-enfant', 7);

CALL footshop_add_category(@maillots_enfant, 'Sélections', 'selections-enfant', 8);



-- ---------------------------------------------------------------------------

-- 4. Shorts > Adulte

-- ---------------------------------------------------------------------------

CALL footshop_add_category(@shorts_adulte, 'Ligue 1', 'short-ligue-1', 1);

CALL footshop_add_category(@shorts_adulte, 'Premier League', 'short-premier-league', 2);

CALL footshop_add_category(@shorts_adulte, 'La Liga', 'short-la-liga', 3);

CALL footshop_add_category(@shorts_adulte, 'Serie A', 'short-serie-a', 4);

CALL footshop_add_category(@shorts_adulte, 'Bundesliga', 'short-bundesliga', 5);

CALL footshop_add_category(@shorts_adulte, 'Ligue des champions', 'short-ldc', 6);

CALL footshop_add_category(@shorts_adulte, 'Sélections', 'short-selections', 7);



-- ---------------------------------------------------------------------------

-- 5. Enfant - Short > divisions

-- ---------------------------------------------------------------------------

CALL footshop_add_category(@shorts_enfant, 'CDM', 'short-cdm', 1);

CALL footshop_add_category(@shorts_enfant, 'Ligue 1', 'short-ligue-1-enfant', 2);

CALL footshop_add_category(@shorts_enfant, 'Premier League', 'short-premier-league-enfant', 3);

CALL footshop_add_category(@shorts_enfant, 'La Liga', 'short-la-liga-enfant', 4);

CALL footshop_add_category(@shorts_enfant, 'Serie A', 'short-serie-a-enfant', 5);

CALL footshop_add_category(@shorts_enfant, 'Bundesliga', 'short-bundesliga-enfant', 6);

CALL footshop_add_category(@shorts_enfant, 'Ligue des champions', 'short-ldc-enfant', 7);

CALL footshop_add_category(@shorts_enfant, 'Sélections', 'short-selections-enfant', 8);



DROP PROCEDURE IF EXISTS footshop_add_category;



-- ---------------------------------------------------------------------------

-- Vérification + IDs pour Render / .env

-- ---------------------------------------------------------------------------

SELECT 'IDs parents à copier dans Render' AS info;

SELECT @maillots_adulte AS NEXT_PUBLIC_MAILLOTS_CATEGORY_ID,

       @shorts_adulte AS NEXT_PUBLIC_SHORTS_CATEGORY_ID,

       @maillots_enfant AS NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID,

       @shorts_enfant AS NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID,

       @world_cup_adulte AS WORLD_CUP_CATEGORY_ID;



SELECT c.id_category, cl.name, c.id_parent

FROM ps_category c

JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang

WHERE c.id_parent IN (@accueil, @maillots_adulte, @maillots_enfant, @shorts_adulte, @shorts_enfant)

   OR c.id_category IN (@world_cup_adulte, 13)

ORDER BY c.id_parent, c.position, cl.name;


