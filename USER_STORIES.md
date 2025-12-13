# User Stories & Spécifications Fonctionnelles

Ce document liste toutes les fonctionnalités actuellement implémentées sur le site du Salon de Coiffure, servant de référence pour nos tests d'intégration.

## 1. Interface Publique (Client)

### Épopée : Découverte
- **US-1.1** : En tant que visiteur, je veux voir le nom du salon, le sous-titre et la philosophie sur la page d'accueil pour comprendre l'identité du salon.
- **US-1.2** : En tant que visiteur, je veux voir la liste des prestations et leurs prix pour choisir ce que je veux.
- **US-1.3** : En tant que visiteur, je veux voir les horaires d'ouverture hebdomadaires pour savoir quand venir.

### Épopée : Réservation
- **US-1.4** : En tant que client, je veux voir les créneaux disponibles pour une date donnée afin de choisir une heure qui m'arrange.
- **US-1.5** : En tant que client, je veux être empêché de réserver un créneau déjà pris ou pendant les heures de fermeture.
- **US-1.6** : En tant que client, je veux réserver un rendez-vous en indiquant mon nom, téléphone (optionnel), et en choisissant une prestation, une date et une heure.

## 2. Interface Admin (Back-office)

### Épopée : Authentification & Accès
- **US-2.1** : En tant que nouveau propriétaire (nouvelle installation), je veux être invité à créer le premier compte admin s'il n'en existe pas.
- **US-2.2** : En tant qu'administrateur, je veux me connecter de manière sécurisée avec mon identifiant et mot de passe pour accéder au tableau de bord.
- **US-2.3** : En tant qu'administrateur, je veux me déconnecter pour protéger ma session.

### Épopée : Gestion des Rendez-vous (Tableau de Bord)
- **US-2.4** : En tant qu'administrateur, je veux visualiser un calendrier montrant les jours avec des rendez-vous.
- **US-2.5** : En tant qu'administrateur, je veux cliquer sur une journée pour voir la liste détaillée des rendez-vous (Nom du client, prestation, heure, téléphone).
- **US-2.6** : En tant qu'administrateur, je veux supprimer un rendez-vous (annulation).
- **US-2.7** : En tant qu'administrateur, je veux modifier l'heure d'un rendez-vous existant.

### Épopée : Configuration du Salon (Paramètres)
- **US-2.8** : En tant qu'administrateur, je veux modifier les horaires d'ouverture hebdomadaires (heures d'ouverture/fermeture, jours fermés).
- **US-2.9** : En tant qu'administrateur, je veux définir des périodes de fermeture exceptionnelle (vacances) pour bloquer les réservations sur ces dates.
- **US-2.10** : En tant qu'administrateur, je veux ajouter, supprimer ou modifier des prestations (Prix, Nom, Icône).

### Épopée : Gestion du Contenu (CMS)
- **US-2.11** : En tant qu'administrateur, je veux mettre à jour les textes de l'Accueil (Titre, Sous-titre, Philosophie).
- **US-2.12** : En tant qu'administrateur, je veux télécharger et mettre à jour les images principales (Hero, Philosophie).
- **US-2.13** : En tant qu'administrateur, je veux ajuster le point focal (positionnement) des images pour qu'elles s'affichent correctement sur tous les écrans.
- **US-2.19** : En tant qu'administrateur, je veux modifier les informations d'un produit (Nom, Prix, Description) pour mettre à jour le catalogue.
- **US-2.20** : En tant qu'administrateur, je veux ajuster le positionnement de la photo d'un produit pour qu'elle soit bien cadrée.

### Épopée : Gestion de l'Équipe
- **US-2.14** : En tant qu'administrateur, je veux ajouter de nouveaux membres d'équipe (autres admins/coiffeurs) pour qu'ils puissent aussi gérer le salon.
- **US-2.15** : En tant qu'administrateur, je veux vérifier que je ne peux pas créer un utilisateur en double avec un identifiant existant.
- **US-2.16** : En tant qu'administrateur, je veux mettre à jour mon propre profil (Nom d'affichage, Mot de passe).
- **US-2.17** : En tant qu'administrateur, je veux définir des congés pour un coiffeur spécifique, rendant ce dernier indisponible pour les réservations sans fermer le salon.
- **US-2.18** : En tant qu'administrateur, je veux définir des congés pour "Tous les RDV" (Fermeture globale), ce qui ferme le salon et affiche l'information sur la page d'accueil.
