-- Database Schema for Hair Salon Website (MySQL)

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------

--
-- Structure de la table `admins`
--

CREATE TABLE IF NOT EXISTS `admins` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `username` varchar(255) NOT NULL,
    `password_hash` varchar(255) NOT NULL,
    `display_name` varchar(255) DEFAULT NULL,
    `days_off` text DEFAULT NULL, -- Stored as JSON
    `role` varchar(50) DEFAULT 'admin',
    PRIMARY KEY (`id`),
    UNIQUE KEY `username` (`username`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `appointments`
--

CREATE TABLE IF NOT EXISTS `appointments` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `phone` varchar(50) DEFAULT NULL,
    `service` varchar(255) NOT NULL,
    `date` date NOT NULL, -- YYYY-MM-DD
    `time` varchar(10) NOT NULL, -- HH:MM
    `created_at` datetime DEFAULT current_timestamp(),
    `admin_id` int(11) DEFAULT NULL,
    `email` varchar(255) DEFAULT NULL,
    `status` varchar(50) DEFAULT 'CONFIRMED',
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_slot` (`date`, `time`, `admin_id`),
    KEY `admin_id` (`admin_id`),
    KEY `date_idx` (`date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `settings`
--

CREATE TABLE IF NOT EXISTS `settings` (
    `key` varchar(255) NOT NULL,
    `value` longtext NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `leaves`
--

CREATE TABLE IF NOT EXISTS `leaves` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `start_date` date NOT NULL,
    `end_date` date NOT NULL,
    `admin_id` int(11) DEFAULT NULL,
    `note` text DEFAULT NULL,
    `created_at` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `admin_id` (`admin_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `portfolio`
--

CREATE TABLE IF NOT EXISTS `portfolio` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `filename` varchar(255) NOT NULL,
    `description` text DEFAULT NULL,
    `admin_id` int(11) DEFAULT NULL,
    `created_at` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `images`
--

CREATE TABLE IF NOT EXISTS `images` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `filename` varchar(255) NOT NULL,
    `filepath` varchar(500) NOT NULL, -- Relative path: uploads/xyz.jpg
    `mimetype` varchar(100) NOT NULL,
    `created_at` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `filename` (`filename`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `password_reset_tokens`
--

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `token` varchar(255) NOT NULL,
    `admin_id` int(11) NOT NULL,
    `expires_at` datetime NOT NULL,
    `created_at` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`token`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `waiting_list_requests`
--

CREATE TABLE IF NOT EXISTS `waiting_list_requests` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `client_name` varchar(255) NOT NULL,
    `client_email` varchar(255) NOT NULL,
    `client_phone` varchar(50) DEFAULT NULL,
    `target_date` date NOT NULL,
    `desired_service_id` varchar(255) NOT NULL,
    `desired_worker_id` int(11) DEFAULT NULL,
    `status` varchar(50) DEFAULT 'WAITING',
    `offer_token` varchar(255) DEFAULT NULL,
    `offer_expires_at` datetime DEFAULT NULL,
    `created_at` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Données par défaut pour `settings` (exemple)
-- --------------------------------------------------------

INSERT IGNORE INTO
    `settings` (`key`, `value`)
VALUES (
        'openingHours',
        '[{"day":1,"isOpen":true,"start":"09:00","end":"19:00"},{"day":2,"isOpen":true,"start":"09:00","end":"19:00"},{"day":3,"isOpen":true,"start":"09:00","end":"19:00"},{"day":4,"isOpen":true,"start":"09:00","end":"19:00"},{"day":5,"isOpen":true,"start":"09:00","end":"19:00"},{"day":6,"isOpen":true,"start":"09:00","end":"18:00"},{"day":0,"isOpen":false,"start":"00:00","end":"00:00"}]'
    );

SET FOREIGN_KEY_CHECKS = 1;