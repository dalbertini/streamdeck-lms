# Plugin Stream Deck — Lyrion Music Server (LMS)

Contrôlez votre serveur Lyrion Music Server depuis le Stream Deck via l'API JSON-RPC de LMS (port 9000, activée par défaut).

## Actions disponibles

| Action | Commande LMS envoyée |
|---|---|
| Lecture / Pause | interroge le statut puis `play` ou `pause` |
| Stop | `stop` |
| Piste suivante | `playlist index +1` |
| Piste précédente | `playlist index -1` |
| Volume + | `mixer volume +5` |
| Volume - | `mixer volume -5` |
| Lire un média | `playlist play <nom>` (nom de playlist, favori ou URL, réglable par touche) |
| Titre en cours | aucun appui nécessaire : la touche affiche « Artiste - Titre » et se rafraîchit toutes les 5 s (appuyer sur la touche force le rafraîchissement) |
| Choisir le lecteur | chaque appui passe au lecteur LMS suivant (Squeezebox Radio, Touch…) et affiche son nom sur la touche ; le choix devient le lecteur global |

## Installation

1. Copiez le dossier `com.lyrion.lms.sdPlugin` dans le dossier des plugins :
   - **Windows** : `%appdata%\Elgato\StreamDeck\Plugins\`
   - **macOS** : `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
2. Redémarrez le logiciel Stream Deck.
3. Glissez une action « Lyrion Music Server » sur une touche.
4. Dans le panneau de réglages (Property Inspector), renseignez :
   - **Adresse du serveur** : IP de la machine hébergeant LMS (ex. `192.168.1.10`)
   - **Port JSON-RPC** : `9000` (par défaut)
   - **Adresse MAC du lecteur** : laisser vide pour utiliser le premier lecteur trouvé, ou indiquer la MAC (ex. `00:04:20:xx:xx:xx`) pour cibler un lecteur précis ; la touche « Choisir le lecteur » permet aussi de changer de lecteur directement depuis le Stream Deck
   - **Lecteur ciblé par cette touche** (réglage de la touche) : MAC optionnelle pour piloter un lecteur précis depuis cette touche, indépendamment du réglage global
   - Pour l'action « Lire un média » : le nom du média à lancer.

## Remarques

- L'action **Titre en cours** interroge LMS toutes les 5 secondes tant que la touche est visible et affiche `Artiste - Titre` (ou `Arrêt` / `LMS hors ligne`).


- Si une erreur survient (serveur injoignable, aucun lecteur…), un triangle rouge s'affiche brièvement sur la touche.
- Le plugin utilise `fetch` (Node 18+, fourni par Stream Deck 6+) et `WebSocket` global ; sur une ancienne version, exécutez `npm i ws` dans le dossier du plugin.
- L'API JSON-RPC de LMS doit être active : Réglages LMS → Avancé → Réseau → « Activer l'interface JSON-RPC » (activée par défaut sur le port 9000).
