# Pilote — Gestion de projets

Application web personnelle pour piloter tes projets, tâches et réunions.
Pensée pour te **décharger mentalement** : tu vois en un coup d'œil ce qui est en
retard, ce qu'il faut faire aujourd'hui, et tu transformes les demandes de ta
réunion hebdo en tâches d'un seul clic.

Tes données restent **sur ton appareil** (stockage local), fonctionnent **hors
ligne**, et ne sont envoyées nulle part.

---

## 1. Tester en local (sur ton ordinateur)

L'app a besoin d'être servie par un petit serveur web (les navigateurs bloquent
les modules JavaScript ouverts directement en `fichier://`).

### Le plus simple — avec Python (déjà installé sur Mac et Linux)

Ouvre un terminal dans le dossier de l'app, puis :

```bash
python3 -m http.server 8000
```

Ouvre ensuite **http://localhost:8000** dans ton navigateur.

### Alternative — avec Node.js

```bash
npx serve
```

---

## 2. Déployer sur GitHub Pages (gratuit, accessible partout)

1. Crée un dépôt sur GitHub (par ex. `pilote`).
2. Dépose **tout le contenu de ce dossier** à la racine du dépôt
   (le fichier `index.html` doit être à la racine).
3. Sur GitHub : **Settings → Pages**.
4. Sous *Build and deployment*, choisis **Deploy from a branch**,
   branche `main`, dossier `/ (root)`, puis **Save**.
5. Patiente ~1 minute. Ton app sera en ligne à l'adresse :
   `https://TON-PSEUDO.github.io/pilote/`

Comme tous les chemins sont relatifs, l'app fonctionne directement dans ce
sous-dossier, sans réglage supplémentaire.

### L'installer comme une appli

Une fois en ligne (ou en local), tu peux l'**installer** :
- Sur ordinateur (Chrome/Edge) : icône d'installation dans la barre d'adresse.
- Sur iPhone (Safari) : Partager → *Sur l'écran d'accueil*.
- Sur Android (Chrome) : menu → *Installer l'application*.

---

## 3. Sauvegarder / transférer tes données

Comme les données sont locales à chaque appareil :

- **Paramètres & données → Exporter** crée un fichier `.json` de sauvegarde.
- **Importer** le recharge (sur le même appareil ou un autre).

Fais une sauvegarde de temps en temps, surtout avant de changer d'appareil.

---

## 4. Plus tard : synchro automatique entre appareils (Firebase)

Pour l'instant, chaque appareil a ses propres données. Si tu veux qu'elles se
synchronisent automatiquement entre ton ordinateur et ton téléphone, on pourra
brancher **Firebase** (gratuit pour cet usage).

Tout le code d'écriture passe déjà par une seule couche (`js/db.js`), donc on
n'aura qu'à ajouter la synchro à cet endroit, sans réécrire le reste de l'app.
Dis-le moi quand tu voudras franchir ce pas.

---

## Structure des fichiers

```
index.html              page principale
manifest.webmanifest    permet l'installation comme application
sw.js                   fonctionnement hors ligne
css/style.css           apparence
js/db.js                stockage local (IndexedDB)
js/app.js               logique de l'application
icons/                  icônes de l'application
```
