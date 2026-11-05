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

## Installation

1. Copiez le dossier `com.lyrion.lms.sdPlugin` dans le dossier des plugins :
   - **Windows** : `%appdata%\Elgato\StreamDeck\Plugins\`
   - **macOS** : `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
2. Redémarrez le logiciel Stream Deck.
3. Glissez une action « Lyrion Music Server » sur une touche.
4. Dans le panneau de réglages (Property Inspector), renseignez :
   - **Adresse du serveur** : IP de la machine hébergeant LMS (ex. `192.168.1.10`)
   - **Port JSON-RPC** : `9000` (par défaut)
   - **Adresse MAC du lecteur** : laisser vide pour utiliser le premier lecteur trouvé, ou indiquer la MAC (ex. `00:04:20:xx:xx:xx`) pour cibler un lecteur précis
   - Pour l'action « Lire un média » : le nom du média à lancer.

## Remarques

- Si une erreur survient (serveur injoignable, aucun lecteur…), un triangle rouge s'affiche brièvement sur la touche.
- Le plugin utilise `fetch` (Node 18+, fourni par Stream Deck 6+) et `WebSocket` global ; sur une ancienne version, exécutez `npm i ws` dans le dossier du plugin.
- L'API JSON-RPC de LMS doit être active : Réglages LMS → Avancé → Réseau → « Activer l'interface JSON-RPC » (activée par défaut sur le port 9000).
