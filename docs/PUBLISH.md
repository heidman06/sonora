# Publier Sonora sur GitHub

Checklist avant publication :

1. Secrets / données perso
   - git grep -nE "cookie|password|token|/home/[a-z]+" puis vérifier
   - Le dossier data/ ne doit pas être suivi (.gitignore)
   - Adapter les URLs d exemple (votre-domaine...) dans README/docs
   - docs/PLAYBOOK.md contient des détails d infrastructure personnels : le remplacer par un playbook générique ou le retirer du dépôt public
2. Licence : MIT (LICENSE) ; vérifier les icônes (Lucide, ISC) et ajouter NOTICE si besoin
3. Dépôt
   git remote add origin git@github.com:<compte>/sonora.git
   git push -u origin main
   git push --tags
4. Release
   - Créer un tag v1.12.0 et une release GitHub
   - Joindre sonora-v1.12.0.tar.gz + SHASUMS256.txt
   - Vérifier que la CI GitHub Actions passe
5. README
   - Remplacer les URLs personnelles par https://votre-domaine
   - Ajouter une capture d écran à jour
6. Sécurité : activer GitHub security advisories (zéro dépendance npm).

La CI (.github/workflows/ci.yml) teste : syntaxe, 18 tests, démarrage autonome + health.
