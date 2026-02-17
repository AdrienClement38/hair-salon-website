# Guide d'Installation (OVH / PHP 8.2)

Ce projet a été migré d'une architecture Node.js vers une architecture standard PHP 8.2 compatible avec l'hébergement mutualisé OVH.

## Pré-requis

*   Hébergement OVH (ou autre) supportant **PHP 8.2 minimum**.
*   Base de données **MySQL** ou **MariaDB**.
*   Accès FTP et phpMyAdmin.

## Structure des Dossiers

*   `api/` : Scripts PHP backend (API).
*   `config/` : Configuration (connexion BDD).
*   `public/` : Frontend (HTML, CSS, JS, Images). C'est le dossier racine du site web (`www` sur OVH).
*   `utils/` : Fonctions utilitaires PHP.
*   `maintenance/` : Scripts de maintenance.
*   `database.sql` : Dump de la structure et données initiales.

## Installation

### 1. Base de Données

1.  Connectez-vous à votre phpMyAdmin OVH.
2.  Importez le fichier `database.sql`.
3.  Notez les identifiants de connexion (Hôte, Nom de la base, Utilisateur, Mot de passe).

### 2. Configuration

1.  Ouvrez le fichier `config/db.php`.
2.  Modifiez les constantes ou assurez-vous que les variables d'environnement sont définies sur votre hébergement (via `.ovhconfig` ou `php.ini`, sinon modifiez directement le fichier avec vos identifiants réels).

Exemple de modification directe (déconseillé pour la sécutité, préférez les variables d'env si possible):

```php
$host = 'votre-serveur-mysql.ovh.net';
$db   = 'votre-nom-de-base';
$user = 'votre-utilisateur';
$pass = 'votre-mot-de-passe';
```

### 3. Déploiement FTP

1.  Connectez-vous à votre FTP.
2.  Contenu du dossier `public/` -> Copiez le **contenu** de `public/` DIRECTEMENT dans le dossier `www/` de votre serveur.
    *   Exemple : `www/index.html`, `www/css/`, `www/js/`, etc.
3.  Dossiers `api/`, `config/`, `utils/`, `maintenance/` -> Copiez ces dossiers **AU MÊME NIVEAU** que `www/` (à la racine de votre hébergement) pour des raisons de sécurité, OU dans `www/` si vous ne pouvez pas faire autrement.
    *   **IMPORTANT :** Si vous placez ces dossiers DANS `www/`, assurez-vous de protéger l'accès direct aux fichiers sensibles via `.htaccess` (déjà inclus dans `api/`).
    *   Les scripts JS font appel à `api/...`. L'architecture actuelle suppose que le dossier `api/` est accessible publiquement via `https://votre-site.com/api/`.
    *   **RECOMMANDATION SIMPLE :** Uploadez TOUT le contenu du projet (`api`, `config`, `public`, `utils`, `maintenance`) dans le dossier `www/`.
        *   Votre site sera accessible via `https://votre-site.com/public/`.
        *   Pour que le site soit à la racine (`https://votre-site.com/`), vous devez configurer le "Dossier racine" de votre site dans le manager OVH pour pointer vers `www/public`.

### 4. Vérification

1.  Accédez à `https://votre-site.com/admin/login.html`.
2.  Connectez-vous (Utilisateur: `admin`, Mot de passe: `password` par défaut si importé de `database.sql`, sinon voir base de données).
3.  Vérifiez que le tableau de bord, le calendrier et les paramètres fonctionnent.

## Sécurité / Permissions

*   Le dossier `public/uploads/` doit être accessible en écriture (CHMOD 755 ou 777 selon hébergeur) pour l'upload d'images.
*   Les fichiers dans `config/` ne doivent pas être accessibles depuis le web.

## Notes pour le Développeur

*   Le backend utilise les **Sessions PHP** natives.
*   Les appels API se font via `apiFetch` (JS) qui gère automatiquement les cookies de session.
*   L'authentification est gérée par `api/auth_login.php`.
