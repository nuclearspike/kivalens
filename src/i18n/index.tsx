/* eslint-disable react-refresh/only-export-components -- locale helpers and the provider intentionally share one public module. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { extraCatalogs, type SecondaryLocale } from './extraCatalog'
import { loadGeneratedCatalog } from './generatedCatalog'

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'nl'

export const LOCALES: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
]

const STORAGE_KEY = 'KivaLensLocale'
const supported = new Set<Locale>(LOCALES.map(({ code }) => code))

type Params = Record<string, string | number>
type Catalog = Record<string, string>
const EMPTY_CATALOG: Catalog = {}

const catalogs: Record<Exclude<Locale, 'en'>, Catalog> = {
  es: {
    'Choose language': 'Elegir idioma', 'Toggle navigation': 'Alternar navegación',
    Search: 'Buscar', Basket: 'Cesta', Partners: 'Socios', Stats: 'Estadísticas', Wall: 'Muro', Teams: 'Equipos', Saved: 'Guardadas', Options: 'Opciones', About: 'Acerca de', Privacy: 'Privacidad',
    Loading: 'Cargando', 'Loading…': 'Cargando…', Reset: 'Restablecer', Close: 'Cerrar', Cancel: 'Cancelar', Save: 'Guardar', Delete: 'Eliminar', Rename: 'Renombrar', Remove: 'Quitar', Dismiss: 'Descartar', Send: 'Enviar', Stop: 'Detener', Minimize: 'Minimizar',
    'Hide Criteria': 'Ocultar criterios', 'Show Criteria': 'Mostrar criterios', 'Bulk Add': 'Añadir en lote',
    'More loans are still loading. Carry on.': 'Aún se están cargando más préstamos. Puedes continuar.',
    'Hiding loans you have already funded — still loading your portfolio. Results will update in a moment.': 'Ocultando los préstamos que ya has financiado; todavía se está cargando tu cartera. Los resultados se actualizarán en un momento.',
    'Showing {shown} of {total} fundraising loans': 'Mostrando {shown} de {total} préstamos en recaudación',
    'Welcome to KivaLens': 'Te damos la bienvenida a KivaLens', 'Quick Start': 'Inicio rápido',
    'Use the criteria on the left to filter loans': 'Usa los criterios de la izquierda para filtrar préstamos',
    'Click a loan to review details and repayment info': 'Haz clic en un préstamo para revisar los detalles y los pagos',
    'Click “Lend” on loans you like': 'Haz clic en «Prestar» en los préstamos que te gusten',
    'Go to Basket tab to transfer loans to Kiva': 'Ve a la pestaña Cesta para transferir los préstamos a Kiva',
    'Need help getting started? Chat with KivaLens AI': '¿Necesitas ayuda? Habla con la IA de KivaLens',
    'Set your Lender ID': 'Configura tu ID de prestamista',
    'to hide loans you have already funded and enable portfolio balancing.': 'para ocultar préstamos que ya has financiado y activar el equilibrio de cartera.',
    'Saved Searches': 'Búsquedas guardadas', 'Manage Saved Searches': 'Gestionar búsquedas guardadas', 'Save Current Criteria As...': 'Guardar los criterios actuales como…',
    Borrower: 'Prestatario', Partner: 'Socio', 'Your Portfolio': 'Tu cartera', Countries: 'Países', Sectors: 'Sectores', Activities: 'Actividades', Themes: 'Temas', Tags: 'Etiquetas', Sort: 'Ordenar', Name: 'Nombre',
    'Use or Description': 'Uso o descripción', 'Search in English': 'Buscar en inglés', 'Repayment Interval': 'Intervalo de pago', 'Currency Loss': 'Pérdida por divisa', 'Bonus Credit': 'Crédito de bonificación',
    'Empty Basket': 'Vaciar cesta', 'Remove from Basket': 'Quitar de la cesta', 'Remove Selected': 'Quitar selección', 'Checkout at Kiva': 'Finalizar en Kiva', 'Basket: {count} loans ${amount}': 'Cesta: {count} préstamos ${amount}',
    'There are no loans in your basket.': 'No hay préstamos en tu cesta.', 'Transferring Basket to Kiva': 'Transfiriendo la cesta a Kiva',
    'Max to lend: ${amount}': 'Máximo para prestar: ${amount}', 'Max per loan: ${amount}': 'Máximo por préstamo: ${amount}', 'Add a bunch!': '¡Añadir varios!',
    'Search by name...': 'Buscar por nombre…', Status: 'Estado', Region: 'Región', 'Regions': 'Regiones', 'Gender': 'Género', Religion: 'Religión', 'Charges Interest': 'Cobra intereses',
    'Showing {shown} of {total} partners': 'Mostrando {shown} de {total} socios', 'Select a partner from the list': 'Selecciona un socio de la lista',
    'Ask KivaLens': 'Preguntar a KivaLens', 'Open the KivaLens AI assistant': 'Abrir el asistente de IA de KivaLens', 'KivaLens AI assistant': 'Asistente de IA de KivaLens',
    'KivaLens AI is thinking': 'La IA de KivaLens está pensando', 'Click to minimize': 'Haz clic para minimizar', 'Ask about finding loans…': 'Pregunta cómo encontrar préstamos…', 'Message the KivaLens assistant': 'Escribe al asistente de KivaLens',
    'Reset chat': 'Reiniciar chat', 'Chats are logged': 'Los chats se registran', interrupted: 'interrumpido',
    'Loading Fundraising Loans from Kiva.org': 'Cargando préstamos en recaudación desde Kiva.org', 'Please Wait...': 'Espera…', basics: 'datos básicos', details: 'detalles',
    'KivaLens is not supported by Kiva.org. See': 'KivaLens no cuenta con el respaldo de Kiva.org. Consulta', 'for contact information': 'para obtener información de contacto',
    Lend: 'Prestar', Details: 'Detalles', Repayments: 'Pagos', 'Monthly Repayment': 'Pago mensual', Cumulative: 'Acumulado', Description: 'Descripción', 'Matches Saved Searches': 'Coincide con búsquedas guardadas', Posted: 'Publicado', Expires: 'Vence', Disbursed: 'Desembolsado', Borrowers: 'Prestatarios', Female: 'Mujer', Male: 'Hombre',
    'Who are you?': '¿Quién eres?', 'Your Lender ID': 'Tu ID de prestamista', Change: 'Cambiar', 'Set Kiva Lender ID': 'Configurar ID de prestamista de Kiva', Display: 'Pantalla', 'Default Lending Amount': 'Importe de préstamo predeterminado', 'Show distribution graphs when selecting criteria options': 'Mostrar gráficos de distribución al seleccionar opciones de criterios', 'External Research': 'Investigación externa', 'Debug / Beta Testing': 'Depuración / pruebas beta', 'AI Assistant': 'Asistente de IA', 'Show the Ask KivaLens AI assistant (the chat bubble in the corner)': 'Mostrar el asistente de IA Ask KivaLens (la burbuja de chat de la esquina)',
    'Translate': 'Traducir', 'Translating…': 'Traduciendo…', 'Show original': 'Ver original', 'Show translation': 'Ver traducción', 'Translation failed. Try again.': 'La traducción falló. Inténtalo de nuevo.',
    'Select All': 'Seleccionar todo', 'Select None': 'No seleccionar ninguno', '{count} matching loans': '{count} préstamos coincidentes', 'Show Loans': 'Mostrar préstamos', 'Copy JSON': 'Copiar JSON', 'Criteria Summary': 'Resumen de criterios', 'Select a saved search': 'Selecciona una búsqueda guardada',
  },
  fr: {
    'Choose language': 'Choisir la langue', 'Toggle navigation': 'Afficher la navigation',
    Search: 'Rechercher', Basket: 'Panier', Partners: 'Partenaires', Stats: 'Statistiques', Wall: 'Mur', Teams: 'Équipes', Saved: 'Enregistrées', Options: 'Options', About: 'À propos', Privacy: 'Confidentialité',
    Loading: 'Chargement', 'Loading…': 'Chargement…', Reset: 'Réinitialiser', Close: 'Fermer', Cancel: 'Annuler', Save: 'Enregistrer', Delete: 'Supprimer', Rename: 'Renommer', Remove: 'Retirer', Dismiss: 'Fermer', Send: 'Envoyer', Stop: 'Arrêter', Minimize: 'Réduire',
    'Hide Criteria': 'Masquer les critères', 'Show Criteria': 'Afficher les critères', 'Bulk Add': 'Ajout groupé',
    'More loans are still loading. Carry on.': 'D’autres prêts sont encore en cours de chargement. Vous pouvez continuer.',
    'Hiding loans you have already funded — still loading your portfolio. Results will update in a moment.': 'Masquage des prêts déjà financés ; votre portefeuille est encore en cours de chargement. Les résultats seront bientôt actualisés.',
    'Showing {shown} of {total} fundraising loans': 'Affichage de {shown} prêts en collecte sur {total}',
    'Welcome to KivaLens': 'Bienvenue sur KivaLens', 'Quick Start': 'Démarrage rapide',
    'Use the criteria on the left to filter loans': 'Utilisez les critères à gauche pour filtrer les prêts',
    'Click a loan to review details and repayment info': 'Cliquez sur un prêt pour voir les détails et les remboursements',
    'Click “Lend” on loans you like': 'Cliquez sur « Prêter » pour les prêts qui vous plaisent',
    'Go to Basket tab to transfer loans to Kiva': 'Ouvrez l’onglet Panier pour transférer les prêts à Kiva',
    'Need help getting started? Chat with KivaLens AI': 'Besoin d’aide ? Discutez avec l’IA KivaLens',
    'Set your Lender ID': 'Définissez votre identifiant de prêteur',
    'to hide loans you have already funded and enable portfolio balancing.': 'pour masquer les prêts déjà financés et activer l’équilibrage du portefeuille.',
    'Saved Searches': 'Recherches enregistrées', 'Manage Saved Searches': 'Gérer les recherches enregistrées', 'Save Current Criteria As...': 'Enregistrer les critères actuels sous…',
    Borrower: 'Emprunteur', Partner: 'Partenaire', 'Your Portfolio': 'Votre portefeuille', Countries: 'Pays', Sectors: 'Secteurs', Activities: 'Activités', Themes: 'Thèmes', Tags: 'Étiquettes', Sort: 'Trier', Name: 'Nom',
    'Use or Description': 'Usage ou description', 'Search in English': 'Rechercher en anglais', 'Repayment Interval': 'Fréquence de remboursement', 'Currency Loss': 'Perte de change', 'Bonus Credit': 'Crédit bonus',
    'Empty Basket': 'Vider le panier', 'Remove from Basket': 'Retirer du panier', 'Remove Selected': 'Retirer la sélection', 'Checkout at Kiva': 'Finaliser sur Kiva', 'Basket: {count} loans ${amount}': 'Panier : {count} prêts ${amount}',
    'There are no loans in your basket.': 'Votre panier ne contient aucun prêt.', 'Transferring Basket to Kiva': 'Transfert du panier vers Kiva',
    'Max to lend: ${amount}': 'Montant maximal : ${amount}', 'Max per loan: ${amount}': 'Maximum par prêt : ${amount}', 'Add a bunch!': 'Ajouter le lot !',
    'Search by name...': 'Rechercher par nom…', Status: 'Statut', Region: 'Région', 'Regions': 'Régions', 'Gender': 'Genre', Religion: 'Religion', 'Charges Interest': 'Facture des intérêts',
    'Showing {shown} of {total} partners': 'Affichage de {shown} partenaires sur {total}', 'Select a partner from the list': 'Sélectionnez un partenaire dans la liste',
    'Ask KivaLens': 'Demander à KivaLens', 'Open the KivaLens AI assistant': 'Ouvrir l’assistant IA KivaLens', 'KivaLens AI assistant': 'Assistant IA KivaLens',
    'KivaLens AI is thinking': 'L’IA KivaLens réfléchit', 'Click to minimize': 'Cliquez pour réduire', 'Ask about finding loans…': 'Demandez comment trouver des prêts…', 'Message the KivaLens assistant': 'Écrire à l’assistant KivaLens',
    'Reset chat': 'Réinitialiser le chat', 'Chats are logged': 'Les chats sont enregistrés', interrupted: 'interrompu',
    'Loading Fundraising Loans from Kiva.org': 'Chargement des prêts en collecte depuis Kiva.org', 'Please Wait...': 'Veuillez patienter…', basics: 'bases', details: 'détails',
    'KivaLens is not supported by Kiva.org. See': 'KivaLens n’est pas pris en charge par Kiva.org. Consultez', 'for contact information': 'pour les coordonnées',
    Lend: 'Prêter', Details: 'Détails', Repayments: 'Remboursements', 'Monthly Repayment': 'Remboursement mensuel', Cumulative: 'Cumulé', Description: 'Description', 'Matches Saved Searches': 'Correspond aux recherches enregistrées', Posted: 'Publié', Expires: 'Expire', Disbursed: 'Décaissé', Borrowers: 'Emprunteurs', Female: 'Femme', Male: 'Homme',
    'Who are you?': 'Qui êtes-vous ?', 'Your Lender ID': 'Votre identifiant de prêteur', Change: 'Modifier', 'Set Kiva Lender ID': 'Définir l’identifiant de prêteur Kiva', Display: 'Affichage', 'Default Lending Amount': 'Montant de prêt par défaut', 'Show distribution graphs when selecting criteria options': 'Afficher les graphiques de répartition lors du choix des critères', 'External Research': 'Recherche externe', 'Debug / Beta Testing': 'Débogage / tests bêta', 'AI Assistant': 'Assistant IA', 'Show the Ask KivaLens AI assistant (the chat bubble in the corner)': 'Afficher l’assistant IA Ask KivaLens (la bulle de chat dans le coin)',
    'Translate': 'Traduire', 'Translating…': 'Traduction…', 'Show original': 'Voir l’original', 'Show translation': 'Voir la traduction', 'Translation failed. Try again.': 'Échec de la traduction. Réessayez.',
    'Select All': 'Tout sélectionner', 'Select None': 'Tout désélectionner', '{count} matching loans': '{count} prêts correspondants', 'Show Loans': 'Afficher les prêts', 'Copy JSON': 'Copier le JSON', 'Criteria Summary': 'Résumé des critères', 'Select a saved search': 'Sélectionnez une recherche enregistrée',
  },
  de: {
    'Choose language': 'Sprache auswählen', 'Toggle navigation': 'Navigation umschalten',
    Search: 'Suche', Basket: 'Warenkorb', Partners: 'Partner', Stats: 'Statistiken', Wall: 'Pinnwand', Teams: 'Teams', Saved: 'Gespeichert', Options: 'Einstellungen', About: 'Über', Privacy: 'Datenschutz',
    Loading: 'Wird geladen', 'Loading…': 'Wird geladen…', Reset: 'Zurücksetzen', Close: 'Schließen', Cancel: 'Abbrechen', Save: 'Speichern', Delete: 'Löschen', Rename: 'Umbenennen', Remove: 'Entfernen', Dismiss: 'Schließen', Send: 'Senden', Stop: 'Stoppen', Minimize: 'Minimieren',
    'Hide Criteria': 'Kriterien ausblenden', 'Show Criteria': 'Kriterien anzeigen', 'Bulk Add': 'Mehrfach hinzufügen',
    'More loans are still loading. Carry on.': 'Weitere Kredite werden noch geladen. Sie können fortfahren.',
    'Hiding loans you have already funded — still loading your portfolio. Results will update in a moment.': 'Bereits finanzierte Kredite werden ausgeblendet; Ihr Portfolio wird noch geladen. Die Ergebnisse werden gleich aktualisiert.',
    'Showing {shown} of {total} fundraising loans': '{shown} von {total} Krediten in Finanzierung werden angezeigt',
    'Welcome to KivaLens': 'Willkommen bei KivaLens', 'Quick Start': 'Schnellstart',
    'Use the criteria on the left to filter loans': 'Filtern Sie Kredite mit den Kriterien auf der linken Seite',
    'Click a loan to review details and repayment info': 'Klicken Sie auf einen Kredit, um Details und Rückzahlungen zu sehen',
    'Click “Lend” on loans you like': 'Klicken Sie bei passenden Krediten auf „Verleihen“',
    'Go to Basket tab to transfer loans to Kiva': 'Öffnen Sie den Warenkorb, um Kredite an Kiva zu übertragen',
    'Need help getting started? Chat with KivaLens AI': 'Brauchen Sie Hilfe? Chatten Sie mit der KivaLens-KI',
    'Set your Lender ID': 'Ihre Kreditgeber-ID festlegen',
    'to hide loans you have already funded and enable portfolio balancing.': 'um bereits finanzierte Kredite auszublenden und den Portfolioausgleich zu aktivieren.',
    'Saved Searches': 'Gespeicherte Suchen', 'Manage Saved Searches': 'Gespeicherte Suchen verwalten', 'Save Current Criteria As...': 'Aktuelle Kriterien speichern als…',
    Borrower: 'Kreditnehmer', Partner: 'Partner', 'Your Portfolio': 'Ihr Portfolio', Countries: 'Länder', Sectors: 'Sektoren', Activities: 'Aktivitäten', Themes: 'Themen', Tags: 'Tags', Sort: 'Sortieren', Name: 'Name',
    'Use or Description': 'Verwendung oder Beschreibung', 'Search in English': 'Auf Englisch suchen', 'Repayment Interval': 'Rückzahlungsintervall', 'Currency Loss': 'Währungsverlust', 'Bonus Credit': 'Bonusguthaben',
    'Empty Basket': 'Warenkorb leeren', 'Remove from Basket': 'Aus dem Warenkorb entfernen', 'Remove Selected': 'Auswahl entfernen', 'Checkout at Kiva': 'Bei Kiva abschließen', 'Basket: {count} loans ${amount}': 'Warenkorb: {count} Kredite ${amount}',
    'There are no loans in your basket.': 'Ihr Warenkorb enthält keine Kredite.', 'Transferring Basket to Kiva': 'Warenkorb wird an Kiva übertragen',
    'Max to lend: ${amount}': 'Maximal verleihen: ${amount}', 'Max per loan: ${amount}': 'Maximum pro Kredit: ${amount}', 'Add a bunch!': 'Mehrere hinzufügen!',
    'Search by name...': 'Nach Namen suchen…', Status: 'Status', Region: 'Region', 'Regions': 'Regionen', 'Gender': 'Geschlecht', Religion: 'Religion', 'Charges Interest': 'Berechnet Zinsen',
    'Showing {shown} of {total} partners': '{shown} von {total} Partnern werden angezeigt', 'Select a partner from the list': 'Wählen Sie einen Partner aus der Liste',
    'Ask KivaLens': 'KivaLens fragen', 'Open the KivaLens AI assistant': 'KivaLens-KI-Assistent öffnen', 'KivaLens AI assistant': 'KivaLens-KI-Assistent',
    'KivaLens AI is thinking': 'Die KivaLens-KI denkt nach', 'Click to minimize': 'Zum Minimieren klicken', 'Ask about finding loans…': 'Fragen Sie nach passenden Krediten…', 'Message the KivaLens assistant': 'Nachricht an den KivaLens-Assistenten',
    'Reset chat': 'Chat zurücksetzen', 'Chats are logged': 'Chats werden protokolliert', interrupted: 'unterbrochen',
    'Loading Fundraising Loans from Kiva.org': 'Kredite in Finanzierung werden von Kiva.org geladen', 'Please Wait...': 'Bitte warten…', basics: 'Grunddaten', details: 'Details',
    'KivaLens is not supported by Kiva.org. See': 'KivaLens wird nicht von Kiva.org unterstützt. Siehe', 'for contact information': 'für Kontaktinformationen',
    Lend: 'Verleihen', Details: 'Details', Repayments: 'Rückzahlungen', 'Monthly Repayment': 'Monatliche Rückzahlung', Cumulative: 'Kumuliert', Description: 'Beschreibung', 'Matches Saved Searches': 'Passt zu gespeicherten Suchen', Posted: 'Eingestellt', Expires: 'Läuft ab', Disbursed: 'Ausgezahlt', Borrowers: 'Kreditnehmer', Female: 'Weiblich', Male: 'Männlich',
    'Who are you?': 'Wer sind Sie?', 'Your Lender ID': 'Ihre Kreditgeber-ID', Change: 'Ändern', 'Set Kiva Lender ID': 'Kiva-Kreditgeber-ID festlegen', Display: 'Anzeige', 'Default Lending Amount': 'Standardbetrag', 'Show distribution graphs when selecting criteria options': 'Verteilungsdiagramme bei der Kriterienauswahl anzeigen', 'External Research': 'Externe Recherche', 'Debug / Beta Testing': 'Debugging / Betatest', 'AI Assistant': 'KI-Assistent', 'Show the Ask KivaLens AI assistant (the chat bubble in the corner)': 'Ask-KivaLens-KI-Assistent anzeigen (Chatblase in der Ecke)',
    'Translate': 'Übersetzen', 'Translating…': 'Übersetzung läuft…', 'Show original': 'Original anzeigen', 'Show translation': 'Übersetzung anzeigen', 'Translation failed. Try again.': 'Übersetzung fehlgeschlagen. Bitte erneut versuchen.',
    'Select All': 'Alle auswählen', 'Select None': 'Auswahl aufheben', '{count} matching loans': '{count} passende Kredite', 'Show Loans': 'Kredite anzeigen', 'Copy JSON': 'JSON kopieren', 'Criteria Summary': 'Kriterienübersicht', 'Select a saved search': 'Wählen Sie eine gespeicherte Suche',
  },
  it: {
    'Choose language': 'Scegli la lingua', 'Toggle navigation': 'Mostra navigazione',
    Search: 'Cerca', Basket: 'Carrello', Partners: 'Partner', Stats: 'Statistiche', Wall: 'Bacheca', Teams: 'Squadre', Saved: 'Salvati', Options: 'Opzioni', About: 'Informazioni', Privacy: 'Privacy',
    Loading: 'Caricamento', 'Loading…': 'Caricamento…', Reset: 'Reimposta', Close: 'Chiudi', Cancel: 'Annulla', Save: 'Salva', Delete: 'Elimina', Rename: 'Rinomina', Remove: 'Rimuovi', Dismiss: 'Chiudi', Send: 'Invia', Stop: 'Interrompi', Minimize: 'Riduci',
    'Hide Criteria': 'Nascondi criteri', 'Show Criteria': 'Mostra criteri', 'Bulk Add': 'Aggiunta multipla',
    'More loans are still loading. Carry on.': 'Altri prestiti sono ancora in caricamento. Puoi continuare.',
    'Hiding loans you have already funded — still loading your portfolio. Results will update in a moment.': 'I prestiti già finanziati vengono nascosti; il portafoglio è ancora in caricamento. I risultati si aggiorneranno a breve.',
    'Showing {shown} of {total} fundraising loans': 'Visualizzati {shown} di {total} prestiti in raccolta',
    'Welcome to KivaLens': 'Benvenuto su KivaLens', 'Quick Start': 'Guida rapida',
    'Use the criteria on the left to filter loans': 'Usa i criteri a sinistra per filtrare i prestiti',
    'Click a loan to review details and repayment info': 'Fai clic su un prestito per vedere dettagli e rimborsi',
    'Click “Lend” on loans you like': 'Fai clic su “Presta” per i prestiti che preferisci',
    'Go to Basket tab to transfer loans to Kiva': 'Vai al Carrello per trasferire i prestiti a Kiva',
    'Need help getting started? Chat with KivaLens AI': 'Serve aiuto? Parla con l’IA di KivaLens',
    'Set your Lender ID': 'Imposta il tuo ID prestatore',
    'to hide loans you have already funded and enable portfolio balancing.': 'per nascondere i prestiti già finanziati e attivare il bilanciamento del portafoglio.',
    'Saved Searches': 'Ricerche salvate', 'Manage Saved Searches': 'Gestisci ricerche salvate', 'Save Current Criteria As...': 'Salva i criteri attuali come…',
    Borrower: 'Beneficiario', Partner: 'Partner', 'Your Portfolio': 'Il tuo portafoglio', Countries: 'Paesi', Sectors: 'Settori', Activities: 'Attività', Themes: 'Temi', Tags: 'Etichette', Sort: 'Ordina', Name: 'Nome',
    'Use or Description': 'Uso o descrizione', 'Search in English': 'Cerca in inglese', 'Repayment Interval': 'Intervallo di rimborso', 'Currency Loss': 'Perdita di cambio', 'Bonus Credit': 'Credito bonus',
    'Empty Basket': 'Svuota carrello', 'Remove from Basket': 'Rimuovi dal carrello', 'Remove Selected': 'Rimuovi selezionato', 'Checkout at Kiva': 'Completa su Kiva', 'Basket: {count} loans ${amount}': 'Carrello: {count} prestiti ${amount}',
    'There are no loans in your basket.': 'Il carrello non contiene prestiti.', 'Transferring Basket to Kiva': 'Trasferimento del carrello a Kiva',
    'Max to lend: ${amount}': 'Massimo da prestare: ${amount}', 'Max per loan: ${amount}': 'Massimo per prestito: ${amount}', 'Add a bunch!': 'Aggiungi il gruppo!',
    'Search by name...': 'Cerca per nome…', Status: 'Stato', Region: 'Regione', 'Regions': 'Regioni', 'Gender': 'Genere', Religion: 'Religione', 'Charges Interest': 'Applica interessi',
    'Showing {shown} of {total} partners': 'Visualizzati {shown} di {total} partner', 'Select a partner from the list': 'Seleziona un partner dall’elenco',
    'Ask KivaLens': 'Chiedi a KivaLens', 'Open the KivaLens AI assistant': 'Apri l’assistente IA di KivaLens', 'KivaLens AI assistant': 'Assistente IA di KivaLens',
    'KivaLens AI is thinking': 'L’IA di KivaLens sta pensando', 'Click to minimize': 'Fai clic per ridurre', 'Ask about finding loans…': 'Chiedi come trovare prestiti…', 'Message the KivaLens assistant': 'Scrivi all’assistente KivaLens',
    'Reset chat': 'Reimposta chat', 'Chats are logged': 'Le chat vengono registrate', interrupted: 'interrotto',
    'Loading Fundraising Loans from Kiva.org': 'Caricamento dei prestiti in raccolta da Kiva.org', 'Please Wait...': 'Attendi…', basics: 'dati base', details: 'dettagli',
    'KivaLens is not supported by Kiva.org. See': 'KivaLens non è supportato da Kiva.org. Vedi', 'for contact information': 'per i contatti',
    Lend: 'Presta', Details: 'Dettagli', Repayments: 'Rimborsi', 'Monthly Repayment': 'Rimborso mensile', Cumulative: 'Cumulativo', Description: 'Descrizione', 'Matches Saved Searches': 'Corrisponde alle ricerche salvate', Posted: 'Pubblicato', Expires: 'Scade', Disbursed: 'Erogato', Borrowers: 'Beneficiari', Female: 'Donna', Male: 'Uomo',
    'Who are you?': 'Chi sei?', 'Your Lender ID': 'Il tuo ID prestatore', Change: 'Cambia', 'Set Kiva Lender ID': 'Imposta ID prestatore Kiva', Display: 'Visualizzazione', 'Default Lending Amount': 'Importo predefinito', 'Show distribution graphs when selecting criteria options': 'Mostra i grafici di distribuzione durante la selezione dei criteri', 'External Research': 'Ricerca esterna', 'Debug / Beta Testing': 'Debug / test beta', 'AI Assistant': 'Assistente IA', 'Show the Ask KivaLens AI assistant (the chat bubble in the corner)': 'Mostra l’assistente IA Ask KivaLens (il fumetto nell’angolo)',
    'Translate': 'Traduci', 'Translating…': 'Traduzione…', 'Show original': 'Mostra originale', 'Show translation': 'Mostra traduzione', 'Translation failed. Try again.': 'Traduzione non riuscita. Riprova.',
    'Select All': 'Seleziona tutto', 'Select None': 'Deseleziona tutto', '{count} matching loans': '{count} prestiti corrispondenti', 'Show Loans': 'Mostra prestiti', 'Copy JSON': 'Copia JSON', 'Criteria Summary': 'Riepilogo criteri', 'Select a saved search': 'Seleziona una ricerca salvata',
  },
  nl: {
    'Choose language': 'Taal kiezen', 'Toggle navigation': 'Navigatie openen',
    Search: 'Zoeken', Basket: 'Mandje', Partners: 'Partners', Stats: 'Statistieken', Wall: 'Overzicht', Teams: 'Teams', Saved: 'Opgeslagen', Options: 'Opties', About: 'Over', Privacy: 'Privacy',
    Loading: 'Laden', 'Loading…': 'Laden…', Reset: 'Opnieuw instellen', Close: 'Sluiten', Cancel: 'Annuleren', Save: 'Opslaan', Delete: 'Verwijderen', Rename: 'Hernoemen', Remove: 'Verwijderen', Dismiss: 'Sluiten', Send: 'Versturen', Stop: 'Stoppen', Minimize: 'Minimaliseren',
    'Hide Criteria': 'Criteria verbergen', 'Show Criteria': 'Criteria tonen', 'Bulk Add': 'Meerdere toevoegen',
    'More loans are still loading. Carry on.': 'Er worden nog meer leningen geladen. Je kunt doorgaan.',
    'Hiding loans you have already funded — still loading your portfolio. Results will update in a moment.': 'Eerder gefinancierde leningen worden verborgen; je portefeuille wordt nog geladen. De resultaten worden zo bijgewerkt.',
    'Showing {shown} of {total} fundraising loans': '{shown} van {total} leningen in fondsenwerving getoond',
    'Welcome to KivaLens': 'Welkom bij KivaLens', 'Quick Start': 'Snel beginnen',
    'Use the criteria on the left to filter loans': 'Gebruik de criteria links om leningen te filteren',
    'Click a loan to review details and repayment info': 'Klik op een lening voor details en terugbetalingen',
    'Click “Lend” on loans you like': 'Klik op ‘Uitlenen’ bij leningen die je aanspreken',
    'Go to Basket tab to transfer loans to Kiva': 'Ga naar het Mandje om leningen naar Kiva over te dragen',
    'Need help getting started? Chat with KivaLens AI': 'Hulp nodig? Chat met KivaLens AI',
    'Set your Lender ID': 'Stel je uitlener-ID in',
    'to hide loans you have already funded and enable portfolio balancing.': 'om eerder gefinancierde leningen te verbergen en portefeuillebalancering in te schakelen.',
    'Saved Searches': 'Opgeslagen zoekopdrachten', 'Manage Saved Searches': 'Opgeslagen zoekopdrachten beheren', 'Save Current Criteria As...': 'Huidige criteria opslaan als…',
    Borrower: 'Lener', Partner: 'Partner', 'Your Portfolio': 'Je portefeuille', Countries: 'Landen', Sectors: 'Sectoren', Activities: 'Activiteiten', Themes: 'Thema’s', Tags: 'Labels', Sort: 'Sorteren', Name: 'Naam',
    'Use or Description': 'Gebruik of beschrijving', 'Search in English': 'Zoek in het Engels', 'Repayment Interval': 'Terugbetalingsinterval', 'Currency Loss': 'Valutaverlies', 'Bonus Credit': 'Bonuskrediet',
    'Empty Basket': 'Mandje leegmaken', 'Remove from Basket': 'Verwijderen uit mandje', 'Remove Selected': 'Selectie verwijderen', 'Checkout at Kiva': 'Afronden bij Kiva', 'Basket: {count} loans ${amount}': 'Mandje: {count} leningen ${amount}',
    'There are no loans in your basket.': 'Je mandje bevat geen leningen.', 'Transferring Basket to Kiva': 'Mandje naar Kiva overdragen',
    'Max to lend: ${amount}': 'Maximaal uitlenen: ${amount}', 'Max per loan: ${amount}': 'Maximum per lening: ${amount}', 'Add a bunch!': 'Groep toevoegen!',
    'Search by name...': 'Zoeken op naam…', Status: 'Status', Region: 'Regio', 'Regions': 'Regio’s', 'Gender': 'Geslacht', Religion: 'Religie', 'Charges Interest': 'Brengt rente in rekening',
    'Showing {shown} of {total} partners': '{shown} van {total} partners getoond', 'Select a partner from the list': 'Selecteer een partner uit de lijst',
    'Ask KivaLens': 'Vraag KivaLens', 'Open the KivaLens AI assistant': 'KivaLens AI-assistent openen', 'KivaLens AI assistant': 'KivaLens AI-assistent',
    'KivaLens AI is thinking': 'KivaLens AI denkt na', 'Click to minimize': 'Klik om te minimaliseren', 'Ask about finding loans…': 'Vraag hoe je leningen vindt…', 'Message the KivaLens assistant': 'Stuur de KivaLens-assistent een bericht',
    'Reset chat': 'Chat opnieuw instellen', 'Chats are logged': 'Chats worden opgeslagen', interrupted: 'onderbroken',
    'Loading Fundraising Loans from Kiva.org': 'Leningen in fondsenwerving laden van Kiva.org', 'Please Wait...': 'Even geduld…', basics: 'basis', details: 'details',
    'KivaLens is not supported by Kiva.org. See': 'KivaLens wordt niet ondersteund door Kiva.org. Zie', 'for contact information': 'voor contactgegevens',
    Lend: 'Uitlenen', Details: 'Details', Repayments: 'Terugbetalingen', 'Monthly Repayment': 'Maandelijkse terugbetaling', Cumulative: 'Cumulatief', Description: 'Beschrijving', 'Matches Saved Searches': 'Komt overeen met opgeslagen zoekopdrachten', Posted: 'Geplaatst', Expires: 'Verloopt', Disbursed: 'Uitbetaald', Borrowers: 'Leners', Female: 'Vrouw', Male: 'Man',
    'Who are you?': 'Wie ben je?', 'Your Lender ID': 'Je uitlener-ID', Change: 'Wijzigen', 'Set Kiva Lender ID': 'Kiva-uitlener-ID instellen', Display: 'Weergave', 'Default Lending Amount': 'Standaard leenbedrag', 'Show distribution graphs when selecting criteria options': 'Verdelingsgrafieken tonen bij het kiezen van criteria', 'External Research': 'Extern onderzoek', 'Debug / Beta Testing': 'Debuggen / bètatest', 'AI Assistant': 'AI-assistent', 'Show the Ask KivaLens AI assistant (the chat bubble in the corner)': 'Ask KivaLens AI-assistent tonen (de chatballon in de hoek)',
    'Translate': 'Vertalen', 'Translating…': 'Vertalen…', 'Show original': 'Origineel tonen', 'Show translation': 'Vertaling tonen', 'Translation failed. Try again.': 'Vertaling mislukt. Probeer opnieuw.',
    'Select All': 'Alles selecteren', 'Select None': 'Niets selecteren', '{count} matching loans': '{count} overeenkomende leningen', 'Show Loans': 'Leningen tonen', 'Copy JSON': 'JSON kopiëren', 'Criteria Summary': 'Samenvatting criteria', 'Select a saved search': 'Selecteer een opgeslagen zoekopdracht',
  },
}

const sectors: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  es: { Agriculture: 'Agricultura', Arts: 'Arte', 'Clean Energy': 'Energía limpia', Clothing: 'Ropa', Construction: 'Construcción', Education: 'Educación', Entertainment: 'Entretenimiento', Food: 'Alimentación', Health: 'Salud', Housing: 'Vivienda', Manufacturing: 'Manufactura', 'Personal Use': 'Uso personal', Retail: 'Comercio minorista', 'Reuse & Recycle': 'Reutilización y reciclaje', 'Sanitation & Hygiene': 'Saneamiento e higiene', Services: 'Servicios', Transportation: 'Transporte', Water: 'Agua', Wholesale: 'Comercio mayorista' },
  fr: { Agriculture: 'Agriculture', Arts: 'Arts', 'Clean Energy': 'Énergie propre', Clothing: 'Habillement', Construction: 'Construction', Education: 'Éducation', Entertainment: 'Divertissement', Food: 'Alimentation', Health: 'Santé', Housing: 'Logement', Manufacturing: 'Fabrication', 'Personal Use': 'Usage personnel', Retail: 'Commerce de détail', 'Reuse & Recycle': 'Réutilisation et recyclage', 'Sanitation & Hygiene': 'Assainissement et hygiène', Services: 'Services', Transportation: 'Transport', Water: 'Eau', Wholesale: 'Commerce de gros' },
  de: { Agriculture: 'Landwirtschaft', Arts: 'Kunst', 'Clean Energy': 'Saubere Energie', Clothing: 'Bekleidung', Construction: 'Bauwesen', Education: 'Bildung', Entertainment: 'Unterhaltung', Food: 'Lebensmittel', Health: 'Gesundheit', Housing: 'Wohnen', Manufacturing: 'Fertigung', 'Personal Use': 'Persönlicher Bedarf', Retail: 'Einzelhandel', 'Reuse & Recycle': 'Wiederverwendung & Recycling', 'Sanitation & Hygiene': 'Sanitärversorgung & Hygiene', Services: 'Dienstleistungen', Transportation: 'Transport', Water: 'Wasser', Wholesale: 'Großhandel' },
  it: { Agriculture: 'Agricoltura', Arts: 'Arte', 'Clean Energy': 'Energia pulita', Clothing: 'Abbigliamento', Construction: 'Edilizia', Education: 'Istruzione', Entertainment: 'Intrattenimento', Food: 'Alimentazione', Health: 'Salute', Housing: 'Abitazione', Manufacturing: 'Produzione', 'Personal Use': 'Uso personale', Retail: 'Commercio al dettaglio', 'Reuse & Recycle': 'Riuso e riciclo', 'Sanitation & Hygiene': 'Servizi igienici e igiene', Services: 'Servizi', Transportation: 'Trasporti', Water: 'Acqua', Wholesale: 'Commercio all’ingrosso' },
  nl: { Agriculture: 'Landbouw', Arts: 'Kunst', 'Clean Energy': 'Schone energie', Clothing: 'Kleding', Construction: 'Bouw', Education: 'Onderwijs', Entertainment: 'Entertainment', Food: 'Voeding', Health: 'Gezondheid', Housing: 'Huisvesting', Manufacturing: 'Productie', 'Personal Use': 'Persoonlijk gebruik', Retail: 'Detailhandel', 'Reuse & Recycle': 'Hergebruik & recycling', 'Sanitation & Hygiene': 'Sanitatie & hygiëne', Services: 'Diensten', Transportation: 'Vervoer', Water: 'Water', Wholesale: 'Groothandel' },
}

export function translate(
  locale: Locale,
  key: string,
  params: Params = {},
  generatedCatalog: Catalog = {},
): string {
  const template = locale === 'en'
    ? key
    : catalogs[locale][key] ?? extraCatalogs[locale][key] ?? generatedCatalog[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function hasTranslation(locale: Locale, key: string): boolean {
  return locale === 'en' || key in catalogs[locale] || key in extraCatalogs[locale]
}

export function formatRelativeTime(locale: Locale, value: Date | string | number, now = Date.now()): string {
  const difference = new Date(value).getTime() - now
  const absolute = Math.abs(difference)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ]
  const [unit, size] = units.find(([, unitSize]) => absolute >= unitSize) ?? ['second', 1000]
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(difference / size), unit)
}

export function translateSector(locale: Locale, englishSector: string): string {
  return locale === 'en' ? englishSector : sectors[locale][englishSector] ?? englishSector
}

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && supported.has(saved)) return saved
  } catch {
    // Fall through to browser preference.
  }
  const browser = window.navigator.language?.split('-')[0] as Locale | undefined
  return browser && supported.has(browser) ? browser : 'en'
}

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Params) => string
  sector: (englishSector: string) => string
  relativeTime: (value: Date | string | number, now?: number) => string
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key, params) => translate('en', key, params),
  sector: (value) => value,
  relativeTime: (value, now) => formatRelativeTime('en', value, now),
  date: (value, options) => new Intl.DateTimeFormat('en', options).format(new Date(value)),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [loadedCatalog, setLoadedCatalog] = useState<{
    locale: SecondaryLocale
    catalog: Catalog
  } | null>(null)
  const setLocale = useCallback((next: Locale) => {
    if (!supported.has(next)) return
    setLocaleState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    if (locale === 'en') return
    let active = true
    const secondaryLocale = locale as SecondaryLocale
    void loadGeneratedCatalog(secondaryLocale).then((catalog) => {
      if (active) setLoadedCatalog({ locale: secondaryLocale, catalog })
    })
    return () => { active = false }
  }, [locale])
  const generatedCatalog =
    locale !== 'en' && loadedCatalog?.locale === locale ? loadedCatalog.catalog : EMPTY_CATALOG
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params, generatedCatalog),
    sector: (englishSector) => translateSector(locale, englishSector),
    relativeTime: (input, now) => formatRelativeTime(locale, input, now),
    date: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
  }), [generatedCatalog, locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
