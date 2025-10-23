// Générateur PDF pour BroolyKid
// Utilise jsPDF pour créer des PDFs personnalisés

import jsPDF from 'jspdf';

export interface KidsProgramData {
  childName: string;
  age: string;
  gender: string;
  environment: string;
  location: string;
  language: string;
  program: string;
}

export async function generateKidsPDF(data: KidsProgramData): Promise<void> {
  const doc = new jsPDF();

  // Configuration
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Couleurs BroolyKid
  const primaryColor: [number, number, number] = [139, 92, 246]; // Violet
  const secondaryColor: [number, number, number] = [236, 72, 153]; // Rose

  // Header avec dégradé simulé
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo/Titre
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('BROOLYKID', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.text('Programme Personnalisé', pageWidth / 2, 32, { align: 'center' });

  yPosition = 55;

  // Informations enfant
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text(`Programme pour ${data.childName}`, margin, yPosition);

  yPosition += 15;

  // Détails profil
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);

  const profileInfo = [
    `Âge: ${data.age} ans`,
    `Environnement: ${data.environment}`,
    `Localisation: ${data.location}`,
    `Date de génération: ${new Date().toLocaleDateString('fr-FR')}`
  ];

  profileInfo.forEach(info => {
    doc.text(info, margin, yPosition);
    yPosition += 7;
  });

  yPosition += 10;

  // Ligne séparatrice
  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);

  yPosition += 15;

  // Contenu du programme
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);

  // Parser le programme markdown
  const programLines = data.program.split('\n');

  programLines.forEach((line) => {
    // Vérifier si on doit aller à la page suivante
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = margin;
    }

    if (line.startsWith('# ')) {
      // Titre principal
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(line.replace('# ', ''), margin, yPosition);
      yPosition += 12;
    } else if (line.startsWith('## ')) {
      // Sous-titre
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...secondaryColor);
      doc.text(line.replace('## ', ''), margin, yPosition);
      yPosition += 10;
    } else if (line.startsWith('### ')) {
      // Sous-sous-titre
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(line.replace('### ', ''), margin, yPosition);
      yPosition += 8;
    } else if (line.startsWith('- ')) {
      // Liste à puces
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      const text = line.replace('- ', '• ');
      const splitText = doc.splitTextToSize(text, maxWidth - 10);
      doc.text(splitText, margin + 5, yPosition);
      yPosition += splitText.length * 6;
    } else if (line.trim().length > 0) {
      // Texte normal
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      const splitText = doc.splitTextToSize(line, maxWidth);
      doc.text(splitText, margin, yPosition);
      yPosition += splitText.length * 6;
    } else {
      // Ligne vide
      yPosition += 5;
    }
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('🌍 BroolyKid - En service du Tout 🕉️', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Page ${doc.internal.pages.length - 1}`, pageWidth - margin, footerY, { align: 'right' });

  // Télécharger
  const filename = `BroolyKid_Programme_${data.childName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
  doc.save(filename);
}

// Générer PDF pour le chat (historique de conversation)
export async function generateChatPDF(messages: any[], userName: string = 'Utilisateur'): Promise<void> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Header
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('🕉️ BroolyKid AI', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('Conversation Sacrée', pageWidth / 2, 28, { align: 'center' });

  yPosition = 50;

  // Info
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Utilisateur: ${userName}`, margin, yPosition);
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 15;

  // Messages
  messages.forEach((message, index) => {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    // Rôle
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);

    if (message.role === 'user') {
      doc.setTextColor(139, 92, 246); // Violet
      doc.text('👤 Vous:', margin, yPosition);
    } else {
      doc.setTextColor(236, 72, 153); // Rose
      doc.text('✨ BroolyKid AI:', margin, yPosition);
    }

    yPosition += 8;

    // Contenu
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const splitText = doc.splitTextToSize(message.content, maxWidth - 5);
    doc.text(splitText, margin + 5, yPosition);
    yPosition += splitText.length * 5 + 10;

    // Séparateur
    if (index < messages.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
    }
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('🌍💫 BroolyKid - Le Messager Universel 🕉️✨', pageWidth / 2, footerY, { align: 'center' });

  // Télécharger
  const filename = `BroolyKid_Conversation_${new Date().getTime()}.pdf`;
  doc.save(filename);
}
