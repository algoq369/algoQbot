#!/bin/bash

# Script pour copier le rapport dans le clipboard
# Usage: bash COPIER_RAPPORT_POUR_EXPERT.sh

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     COPIE DU RAPPORT POUR EXPERT CLAUDE                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Chemin du rapport
RAPPORT="RAPPORT_COMPLET_EXPERT_11OCT2025.md"

# Vérifier que le fichier existe
if [ ! -f "$RAPPORT" ]; then
    echo "❌ Erreur: $RAPPORT n'existe pas"
    echo "   Assurez-vous d'être dans le bon répertoire:"
    echo "   cd /Users/sheirraza/bsc-ranging-bot"
    exit 1
fi

echo "📄 Fichier trouvé: $RAPPORT"
echo ""

# Afficher la taille
SIZE=$(wc -c < "$RAPPORT" | awk '{print int($1/1024)}')
LINES=$(wc -l < "$RAPPORT")
echo "   Taille: ${SIZE} KB"
echo "   Lignes: ${LINES}"
echo ""

# Copier dans le clipboard (macOS)
if command -v pbcopy &> /dev/null; then
    cat "$RAPPORT" | pbcopy
    echo "✅ Rapport copié dans le clipboard!"
    echo ""
    echo "🚀 PROCHAINE ÉTAPE:"
    echo "   1. Ouvrir nouveau chat avec Claude"
    echo "   2. Taper votre message:"
    echo "      \"Bonjour Expert Claude, ci-dessous le rapport"
    echo "       complet de mon bot. J'ai besoin de votre avis"
    echo "       sur les 5 questions à la fin. Merci!\""
    echo "   3. Appuyer sur Entrée"
    echo "   4. Coller le rapport (Cmd+V)"
    echo "   5. Envoyer!"
    echo ""
    echo "✨ Le rapport est déjà dans votre clipboard, prêt à coller!"
else
    echo "⚠️ pbcopy non disponible (pas sur macOS?)"
    echo ""
    echo "Pour copier manuellement:"
    echo "   cat $RAPPORT | pbcopy"
    echo ""
    echo "Ou ouvrez le fichier:"
    echo "   open $RAPPORT"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📌 FICHIERS DISPONIBLES:"
echo "   • RAPPORT_COMPLET_EXPERT_11OCT2025.md (Français, complet)"
echo "   • SHARE_WITH_EXPERT_CLAUDE_LATEST.md (English, summary)"
echo "   • 📌_PARTAGE_AVEC_EXPERT_GUIDE.md (Guide)"
echo "═══════════════════════════════════════════════════════════"
