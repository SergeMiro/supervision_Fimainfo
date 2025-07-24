// import { createTable } from './utils/tables';
// VERSION: 2025-07-24-15:12 - LOGS CLEANED - FORCE RELOAD

// ----------------------------- DECLARATION DES VARIABLES --------------------------------
const db_client = "HN_GUYOT"; // Nom de la base à changer en fonction du client
const cloud_1 = "[CRCDIJSQL2]";
const cloud_2 = "[CRCLONSQL]";
let customer_id = 0;
let supervisorList = {};
const urlPage = window.top.location.href; // URL de la page
let smsData = {};
let campaignData = {};
let currentCountType = 'clients'; // 'clients' ou 'sms' pour onglet "par période"
let currentServiceCountType = 'clients'; // 'clients' ou 'sms' pour onglet "par service"

// intervalle de rafraîchissement de l'interface (pop-up) quand il est visible
const REFRESH_INTERVAL_MS = 15 * 1000; // 15 secondes
let chart;
let campaignChart;

// ===== SYSTÈME DE GESTION DES ÉTATS DE LÉGENDE AVEC LOCALSTORAGE =====

// États par défaut (tous activés pour la première visite)
const defaultSmsLegendState = {
	'Reçu par client': true,
	'Erreur définitif': true,
	'En cours d\'envoi': true,
	'Envoyés au prestataire': true,
	'Acceptés par prestataire': true,
	'Erreur temporaire': true,
	'Bloqué par STOP code': true
};

const defaultCampaignLegendState = {
	'Jour en cours': true,
	'Semaine en cours': true,
	'Mois en cours': true,
	'Mois précédent': true,
	'3 derniers mois': true,
	'Année en cours': true,
	'Année précédente': true
};

// Fonction pour générer la clé localStorage
function getLegendStorageKey(tabType, countType) {
	return `legendState_${tabType}_${countType}`;
}

// Fonction pour charger l'état depuis localStorage
function loadLegendState(key, defaultState) {
	const saved = localStorage.getItem(key);
	if (saved) {
		try {
			return JSON.parse(saved);
		} catch (e) {
			console.warn(`Erreur lors du chargement de ${key}:`, e);
		}
	}
	return { ...defaultState }; // Retourner une copie pour éviter les mutations
}

// Fonction pour sauvegarder l'état dans localStorage
function saveLegendState(key, state) {
	try {
		localStorage.setItem(key, JSON.stringify(state));
	} catch (e) {
		// console.warn(`Erreur lors de la sauvegarde de ${key}:`, e);
	}
}

// Fonctions pour gérer la persistance des boutons Clients/SMS
function saveCountTypeState(tabType, countType) {
	try {
		localStorage.setItem(`countType_${tabType}`, countType);
	} catch (e) {
		// console.warn(`Erreur lors de la sauvegarde du type de comptage:`, e);
	}
}

function loadCountTypeState(tabType, defaultType = 'clients') {
	try {
		return localStorage.getItem(`countType_${tabType}`) || defaultType;
	} catch (e) {
		// console.warn(`Erreur lors du chargement du type de comptage:`, e);
		return defaultType;
	}
}

// Fonctions pour gérer la persistance de l'onglet actif (période/service)
function saveActiveTab(tabType) {
	try {
		localStorage.setItem('activeTab', tabType);
	} catch (e) {
		// console.warn(`Erreur lors de la sauvegarde de l'onglet actif:`, e);
	}
}

function loadActiveTab(defaultTab = 'periode') {
	try {
		return localStorage.getItem('activeTab') || defaultTab;
	} catch (e) {
		// console.warn(`Erreur lors du chargement de l'onglet actif:`, e);
		return defaultTab;
	}
}

// Variables globales pour les états actuels (seront initialisées dans initCountTypeTogglePersistence)
let smsLegendState = {};
let campaignLegendState = {};

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
function loadCssFileInWorkspace(filename) {
	const link = window.top.document.createElement('link');
	const timestamp = new Date().getTime(); // pour éviter le cache
	link.href = `http://192.168.9.237/hermes_net_v5/Supervision/Fimainfo_config/${filename}?v=${timestamp}`;
	link.type = 'text/css';
	link.rel = 'stylesheet';
	window.top.document.head.appendChild(link);
}

// Fonction pour ajouter le label "Filtres" et la bordure autour des légendes ECharts
function addLegendFiltersWrapper(containerSelector) {
	const container = window.top.document.querySelector(containerSelector);
	if (!container) return;

	// Vérifier si le wrapper existe déjà
	if (container.querySelector('.legend-filters-label')) return;

	// Créer le label "Filtres"
	const label = window.top.document.createElement('div');
	label.className = 'legend-filters-label';
	label.textContent = 'DONNÉES AVEC FILTRES';

	// Créer le conteneur avec bordure
	const wrapper = window.top.document.createElement('div');
	wrapper.className = 'legend-filters-container';

	// Déplacer le contenu existant dans le wrapper
	while (container.firstChild) {
		wrapper.appendChild(container.firstChild);
	}

	// Ajouter le label et le wrapper au conteneur
	container.appendChild(label);
	container.appendChild(wrapper);
}

function showSubscriptionError() {
	const containers = Array.from(window.top.document.querySelectorAll('.text-f'));
	if (!containers.length) return;
	containers.pop(); // enlever le dernier conteneur vide
	containers.forEach(container => {
		container.innerHTML = `
			<div class="supervision-error-container">
				<span class="material-icons-round supervision-error-icon">warning_amber</span>
				<div class="supervision-error-title">
					Supervision Personnalisée Non Activée
				</div>
				<div class="supervision-error-message">
					Veuillez contacter Adrien MARTIN pour activer l'accès à cette fonctionnalité
				</div>
			</div>`;
	});
}

// console.log("URL de la page actuelle :", urlPage);
const params = new URLSearchParams(urlPage.split('?')[1] || '');
const agentStation = params.get('Station');
const customerOid = params.get('Oid_Company');
// console.log("Station de l'agent est :", agentStation);
// console.log("Oid_Company (customerOid) de l'agent est :", customerOid);

// injection du fichier CSS personnalisé
loadCssFileInWorkspace('Fimainfo_supervision_vistalid.css');

// ---------------------------- REQUÊTES SQL ----------------------------------------
async function reqCheckSupervisor() {
	const reqIsSupervisor = `
		SELECT Ident, FirstName, LastName, customerId, customerOid, Rights
		FROM [HN_Admin].[dbo].[ListAgents]
		WHERE Ident = '${agentStation}'
		AND Rights NOT LIKE '0%'
		AND customerOid = '${customerOid}'
	`;
	console.warn('reqIsSupervisor :', reqIsSupervisor);

	try {
		const result = await reqSelect(db_client, reqIsSupervisor);
		console.warn('result :', result);

		if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
			console.error('Erreur : superviseur non trouvé ou résultat invalide.');
			return false;
		}

		// normalisation du résultat
		const supervisor = Array.isArray(result) ? result[0] : result;
		supervisorList = {
			Ident: supervisor.Ident,
			FirstName: supervisor.FirstName,
			LastName: supervisor.LastName,
			customerId: supervisor.customerId,
			customerOid: supervisor.customerOid,
			Rights: supervisor.Rights
		};
		// console.log("Superviseur trouvé :");
		// console.table(supervisorList);
		customer_id = supervisorList.customerId || 0;
		return true;
	} catch (error) {
		// console.error("Erreur lors de l'exécution de la requête :", error);
		return false;
	}
}

async function executeQuery(query) {
	try {
		const result = await reqSelect(db_client, query);

		if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
			// console.error('Erreur : aucun donnée trouvé.');
			return false;
		}

		console.log('Données interface mises à jour');
		return result;
	} catch (error) {
		// console.error("Erreur lors de l'exécution de la requête :", error);
		return false;
	}
}

async function reqSelectAllData() {
	if (customer_id !== supervisorList.customerId) {
		console.error('Customer ID ne correspond pas.');
		showSubscriptionError();
		return false;
	}

	let tableName;

	switch (customer_id) {
		case 7:
			tableName = 'Fimainfo_FullFilSMS_Supervision_JMJ';
			break;
		case 9:
			tableName = 'Fimainfo_FullFilSMS_Supervision_DEV-FIMAINFO';
			break;
		case 30:
			tableName = 'Fimainfo_FullFilSMS_Supervision_Vistalid';
			break;
		default:
			// console.error('Customer ID non reconnu:', customer_id);
			showSubscriptionError();
			return false;
	}

	const query = `
		SELECT *
		FROM ${cloud_1}.[HN_UNICAP].[dbo].[${tableName}]
	`;
	// console.warn('🔍 Requête SQL pour SMS globaux :', query);
	const result = await executeQuery(query);

	if (result) {
		smsData.day = result;
		// console.log('📊 Données SMS reçues :', result);
		// console.table(result);
	}

	return result;
}

async function reqSelectCampaignData() {
	if (customer_id !== supervisorList.customerId) {
		console.error('Customer ID ne correspond pas.');
		showSubscriptionError();
		return false;
	}

	let tableName;

	switch (customer_id) {
		case 7:
			tableName = 'Fimainfo_FullFilSMS_Supervision_Campagnes_JMJ';
			break;
		case 9:
			tableName = 'Fimainfo_FullFilSMS_Supervision_Campagnes_DEV-FIMAINFO';
			break;
		case 30:
			tableName = 'Fimainfo_FullFilSMS_Supervision_campaigns_Vistalid';
			break;
		default:
			console.error('Customer ID non reconnu pour campagnes:', customer_id);
			showSubscriptionError();
			return false;
	}

	const query = `
		SELECT *
		FROM ${cloud_1}.[HN_UNICAP].[dbo].[${tableName}]
	`;
	// console.warn('🏢 Requête SQL pour campagnes téléphoniques :', query);
	const result = await executeQuery(query);
	// console.log('🔍 Résultat brut de executeQuery pour campagnes:', result);
	// console.log('🔍 Type de result:', typeof result, Array.isArray(result));

	if (result) {
		campaignData.campaigns = result;
		// console.log('🏢 Données des campagnes reçues :', result);
		// console.log('🏢 Nombre de lignes reçues:', result.length);
		// console.table(result.slice(0, 5)); // Afficher seulement les 5 premières lignes

		// Analyser les correspondances entre noms originaux et catégories
		const campaignMapping = {};
		const categoryTotals = {};

		result.forEach(row => {
			const category = row.CampaignDisplayName;
			const originalName = row.OriginalCampaignName;

			// Correspondances nom original -> catégorie
			if (!campaignMapping[category]) {
				campaignMapping[category] = new Set();
			}

			campaignMapping[category].add(originalName);

			// Totaux par catégorie
			if (!categoryTotals[category]) {
				categoryTotals[category] = {
					totalToday: 0,
					totalWeek: 0,
					totalMonth: 0,
					campaignCount: 0
				};
			}

			categoryTotals[category].totalToday += row.CountToday;
			categoryTotals[category].totalWeek += row.CountCurrentWeek;
			categoryTotals[category].totalMonth += row.CountCurrentMonth;
		});

		// Compter les campagnes uniques par catégorie
		Object.keys(campaignMapping).forEach(category => {
			categoryTotals[category].campaignCount = campaignMapping[category].size;
		});

		// console.log('📋 Correspondances des campagnes par catégorie :');

		// Object.keys(campaignMapping).forEach(category => {
		// 	console.log(`🏷️ ${category}:`);
		// 	console.log(` 📊 Nombre de campagnes: ${campaignMapping[category].size}`);
		// 	console.log(` 📅 Total aujourd'hui: ${categoryTotals[category].totalToday}`);
		// 	console.log(` 📅 Total semaine: ${categoryTotals[category].totalWeek}`);
		// 	console.log(` 📅 Total mois: ${categoryTotals[category].totalMonth}`);
		// 	console.log(`  Campagnes incluses:`, Array.from(campaignMapping[category]).join(', '));
		// 	console.log('   ');
		// });

		// Grouper les données par campagne pour affichage détaillé
		const groupedByCampaign = {};

		result.forEach(row => {
			if (!groupedByCampaign[row.CampaignDisplayName]) {
				groupedByCampaign[row.CampaignDisplayName] = [];
			}

			groupedByCampaign[row.CampaignDisplayName].push(row);
		});
		// console.log('📊 Données groupées par catégorie :', groupedByCampaign);
	}

	return result;
}

// ---------------------- ICONE + POPUP -------------------------------------
function ajouterIconeAvecPopup() {
	if (window.top.document.querySelector('.fimainfo-icon')) return;
	const doc = window.top.document;
	const containerIcon = doc.createElement('div');
	containerIcon.className = 'fimainfo-icon';
	const img = doc.createElement('img');
	img.src = 'https://images.centrerelationsclients.com/Fimainfo/icon_fimainfo.png';
	img.alt = 'fimainfo_icon';
	containerIcon.appendChild(img);

	const popup = doc.createElement('div');
	popup.className = 'fimainfo-popup';

	popup.innerHTML = `
		<div class="superv-header">
			<div class="superv-title">
				<span>Supervision </span>
				<span>F1M</span>
				<span id="header__icon">
					<img src="https://images.centrerelationsclients.com/Fimainfo/icon_fimainfo.png" alt="fimainfo_icon">
				</span>
				<span>1INFO</span>
			</div>
			<div class='console-container'>
				<span id='text'></span>
				<div class='console-underscore' id='console'>&#95; </div>
			</div>
			<div class="superv-close">
				<span class="esc-key">ESC</span>
				<img src="http://192.168.9.237/hermes_net_v5/InterfaceDesigner/upload/dAlKTsEK/img/icon-close2.png" alt="close">
			</div>
		</div>
		<div class="superv-content">
			<div class="content-f">
				<input type="radio" name="slider-f" checked id="sms">
				<input type="radio" name="slider-f" id="emails">
				<input type="radio" name="slider-f" id="add-option">
				<div class="list-f">
					<label for="sms" data-hover="Statistiques SMS détaillées">
						<span>SMS</span>
					</label>
					<label for="emails" data-hover="Emails en détails">
						<span>Emails</span>
					</label>
					<label for="add-option" class="add-option">
						<span>+ Ajouter option</span>
					</label>
					<span class="supervisor-name">Superviseur : ${supervisorList.FirstName} ${supervisorList.LastName}</span>
				</div>
				<div class="text-content-f">
					<!-- Sous-onglets SMS style navigateur -->
					<div class="sms-tabs-container" style="display: block;">
						<div class="browser-tabs">
							<div class="tab-item active" data-tab="periode">
								<span>par période</span>
							</div>
							<div class="tab-item" data-tab="service">
								<span>par service</span>
							</div>
						</div>
					</div>
					<div class="sms-f text-f">
						<!-- Filtre Client/SMS pour le graphique par période -->
						<div class="filter-container" >
							<div class="segmented-control">
								<input type="radio" name="count-type" value="clients" id="periode-clients" checked>
								<label for="periode-clients" class="segment-label">
									<span class="segment-icon">👨🏻‍👩🏻‍👦🏻‍👦🏻</span>
									<span class="segment-text">Clients</span>
								</label>
								<input type="radio" name="count-type" value="sms" id="periode-sms">
								<label for="periode-sms" class="segment-label">
									<span class="segment-icon">📱</span>
									<span class="segment-text">SMS</span>
								</label>
							</div>
							<!-- Icône calculateur SMS -->
							<div class="sms-calculator-icon" id="sms-calculator-btn" title="Calculateur de coût SMS" style="display: none;">
								<span class="material-icons-round">calculate</span>
							</div>
						</div>
						<div class="container-big">
						</div>
					</div>
					<div class="campaigns-f text-f">
						<!-- Filtre Client/SMS pour le graphique par service -->
						<div class="filter-container" >
							<div class="segmented-control">
								<input type="radio" name="service-count-type" value="clients" id="service-clients" checked>
								<label for="service-clients" class="segment-label">
									<span class="segment-icon">👨🏻‍👩🏻‍👦🏻‍👦🏻</span>
									<span class="segment-text">Clients</span>
								</label>
								<input type="radio" name="service-count-type" value="sms" id="service-sms">
								<label for="service-sms" class="segment-label">
									<span class="segment-icon">📱</span>
									<span class="segment-text">SMS</span>
								</label>
							</div>
						</div>
						<div class="container-big-campaigns">
						</div>
					</div>
					<div class="emails-f text-f">
						<div class="title-f">Suivi d'Emails</div>
						<div class="container-f">
							<div class="grid-item">
							</div>
						</div>
					</div>
					<div class="add-option-f text-f">
						<div class="title-f">Des fonctionnalités prochainement disponibles sur la demande 🧩</div>
						<div class="container-f">
							<div class="grid-item premium-card">
								<div class="first-content">
									<span>Appels sortants</span>
								</div>
								<div class="hover-content">
									<div class="preview-block">
										<img classe="preview-presant" src="http://192.168.9.237/hermes_net_v5/Supervision/Fimainfo_config/media/img/appels_sortants.png" alt="graphique appels sortants">
									</div>
								</div>
							</div>
							<div class="grid-item premium-card">
								<div class="first-content">
									<span>Appels entrants</span>
								</div>
								<div class="hover-content">
									<div class="preview-block">
										<img classe="preview-presant" src="http://192.168.9.237/hermes_net_v5/Supervision/Fimainfo_config/media/img/appels_entrants.png" alt="graphique appels entrants">
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`;

	doc.body.appendChild(containerIcon);
	doc.body.appendChild(popup);

	let isPopupPinned = false;
	let isHovered = false;

	// Fonction to close popup
	const closePopup = () => {
		popup.classList.remove('visible');
		containerIcon.classList.remove('active');
	};

	// Fonction to open popup
	const openPopup = () => {
		popup.classList.add('visible');
		containerIcon.classList.add('active');

		// Redimensionner le graphique après ouverture de la popup
		setTimeout(() => {
			if (chart) {
				chart.resize();
			}
		}, 100);
	};

	// event listener pour ouvrir popup
	containerIcon.addEventListener('click', () => {
		isPopupPinned = !isPopupPinned;

		if (isPopupPinned) {
			openPopup();
		} else {
			closePopup();
		}
	});

	// event listener pour afficher le popup au survol
	containerIcon.addEventListener('mouseenter', () => {
		isHovered = true;

		if (!isPopupPinned) {
			openPopup();
		}
	});

	containerIcon.addEventListener('mouseleave', () => {
		isHovered = false;

		if (!isPopupPinned) {
			closePopup();
		}
	});

	// event listener pour fermer le popup en cliquant en dehors
	doc.addEventListener('click', (event) => {
		if (!popup.contains(event.target) && !containerIcon.contains(event.target)) {
			isPopupPinned = false;
			closePopup();
		}
	});

	// event listener pour fermer le popup en cliquant sur le bouton de fermeture
	popup.querySelector('.superv-close img').addEventListener('click', (event) => {
		event.stopPropagation();
		isPopupPinned = false;
		closePopup();
	});

	// event listener pour fermer le popup en cliquant sur le bouton de fermeture
	doc.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && (isPopupPinned || isHovered)) {
			isPopupPinned = false;
			closePopup();
		}
	});

	// Ajouter des listeners pour les onglets principaux et sous-onglets
	const smsRadio = popup.querySelector('#sms');
	const emailsRadio = popup.querySelector('#emails');
	const addOptionRadio = popup.querySelector('#add-option');

	// Gestion des onglets principaux
	if (smsRadio) {
		smsRadio.addEventListener('change', () => {
			if (smsRadio.checked) {
				// Afficher les sous-onglets SMS
				const tabsContainer = popup.querySelector('.sms-tabs-container');

				if (tabsContainer) {
					tabsContainer.style.display = 'block';
				}

				// Afficher par défaut le premier sous-onglet (période)
				showSmsSubTab('periode');
			}
		});
	}

	// Gestion des autres onglets (masquer les sous-onglets SMS et le contenu SMS)
	[emailsRadio, addOptionRadio].forEach(radio => {
		if (radio) {
			radio.addEventListener('change', () => {
				if (radio.checked) {
					const tabsContainer = popup.querySelector('.sms-tabs-container');
					const smsContent = popup.querySelector('.sms-f');
					const campaignsContent = popup.querySelector('.campaigns-f');

					if (tabsContainer) {
						tabsContainer.style.display = 'none';
					}

					// Masquer également le contenu des graphiques SMS
					if (smsContent) smsContent.style.display = 'none';
					if (campaignsContent) campaignsContent.style.display = 'none';
				}
			});
		}
	});

	// Gestion du filtre Client/SMS pour l'onglet "par période"
	const countTypeRadios = popup.querySelectorAll('input[name="count-type"]');

	countTypeRadios.forEach(radio => {
		radio.addEventListener('change', () => {
			if (radio.checked) {
				currentCountType = radio.value; // 'clients' ou 'sms'
				console.log('🔄 Type de comptage (par période) changé:', currentCountType);
				// Mettre à jour le graphique si nous sommes sur l'onglet "par période"
				const isOnPeriodeTab = popup.querySelector('.tab-item[data-tab="periode"].active');

				if (isOnPeriodeTab && chart && smsData.day) {
					updateSmsChart();
				}
			}
		});
	});

	// Gestion du filtre Client/SMS pour l'onglet "par service"
	const serviceCountTypeRadios = popup.querySelectorAll('input[name="service-count-type"]');

	serviceCountTypeRadios.forEach(radio => {
		radio.addEventListener('change', () => {
			if (radio.checked) {
				currentServiceCountType = radio.value; // 'clients' ou 'sms'
				console.log('🔄 Type de comptage (par service) changé:', currentServiceCountType);
				// Mettre à jour le graphique si nous sommes sur l'onglet "par service"
				const isOnServiceTab = popup.querySelector('.tab-item[data-tab="service"].active');

				if (isOnServiceTab && campaignChart && campaignData.campaigns) {
					updateCampaignChart();
				}
			}
		});
	});

	// Gestion des sous-onglets SMS
	function setupSmsSubTabs() {
		const tabItems = popup.querySelectorAll('.tab-item');

		tabItems.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabType = tab.dataset.tab;
				showSmsSubTab(tabType);

				// Mettre à jour l'état actif des onglets
				tabItems.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
			});
		});
	}

	// Fonction pour afficher le bon sous-onglet SMS
	function showSmsSubTab(tabType) {
		const smsContent = popup.querySelector('.sms-f');
		const campaignsContent = popup.querySelector('.campaigns-f');

		if (tabType === 'periode') {
			if (smsContent) smsContent.style.display = 'block';
			if (campaignsContent) campaignsContent.style.display = 'none';

			setTimeout(() => {
				if (chart) {
					chart.resize();
				}
			}, 100);
		} else if (tabType === 'service') {
			if (smsContent) smsContent.style.display = 'none';
			if (campaignsContent) campaignsContent.style.display = 'block';

			setTimeout(() => {
				showCampaignsGraph();
			}, 100);
		}
	}

	// Initialiser les sous-onglets
	setupSmsSubTabs();

	// Ajouter la phrase de bienvenue dans Header
	let visitCount = parseInt(localStorage.getItem('visitCount')) || 0;
	let lastVisitDate = localStorage.getItem('lastVisitDate');
	let currentDate = new Date().toLocaleDateString();

	if (lastVisitDate !== currentDate) {
		visitCount = 0;
		localStorage.setItem('lastVisitDate', currentDate);
	}

	visitCount++;
	localStorage.setItem('visitCount', visitCount);

	let greeting;

	if (visitCount === 1) {
		greeting = `Bonjour, ${supervisorList.FirstName}`;
	} else {
		greeting = `Rebonjour, ${supervisorList.FirstName}`;
	}

	consoleText([greeting], 'text', ['#eae8ed']);

	// Initialiser le calculateur SMS
	initSmsCalculator();

	// Initialiser la persistance des boutons Clients/SMS
	initCountTypeTogglePersistence();

	// Initialiser la persistance de l'onglet actif
	initActiveTabPersistence();
}

// ====================== CALCULATEUR SMS ============
// Fonction d'initialisation du calculateur SMS
function initSmsCalculator() {
	// Créer le popup HTML
	const calculatorHtml = `
		<div id="sms-calculator-popup" class="sms-calculator-popup">
			<div class="calculator-overlay"></div>
			<div class="calculator-content">
				<div class="calculator-header">
					<h3><span class="material-icons-round">calculate</span> Calculateur de coût SMS</h3>
					<button class="calculator-close" id="calculator-close-btn">
						<span class="material-icons-round">close</span>
					</button>
				</div>
				
				<!-- Première ligne: Prix et Période -->
				<div class="calculator-row">
					<div class="price-section">
						<label for="sms-price">Prix SMS</label>
						<input type="text" id="sms-price" class="price-input" placeholder="0,13€" value="0,13€">
					</div>
					<div class="period-section">
						<label for="period-select">Période</label>
						<select id="period-select" class="period-dropdown">
							<option value="today">Jour en cours</option>
							<option value="week">Semaine en cours</option>
							<option value="month" selected>Mois en cours</option>
							<option value="previousMonth">Mois précédent</option>
							<option value="last3months">3 derniers mois</option>
							<option value="year">Année en cours</option>
							<option value="previousYear">Année précédente</option>
						</select>
					</div>
				</div>
				
				<!-- Deuxième ligne: Badges de campagne -->
				<div class="calculator-row">
					<div class="campaign-badges">
						<label>Campagnes</label>
						<div class="badges-container">
							<button class="campaign-badge active" data-campaign="TOUS">TOUS</button>
							<button class="campaign-badge" data-campaign="PROSPECTION">PROSPECTION</button>
							<button class="campaign-badge" data-campaign="LIVRAISON">LIVRAISON</button>
							<button class="campaign-badge" data-campaign="APPEL SUIVI">APPEL SUIVI</button>
							<button class="campaign-badge" data-campaign="RENOUVELLEMENT">RENOUVELLEMENT</button>
							<button class="campaign-badge" data-campaign="RECRUTEMENT (RH)">RECRUTEMENT (RH)</button>
						</div>
					</div>
				</div>
				
				<!-- Troisième ligne: Résultat du calcul -->
				<div class="calculator-result">
					<div class="result-display" id="calculation-result">
						<span class="result-text">0 SMS x 0,13€ = 0,00€</span>
					</div>
				</div>
			</div>
		</div>
	`;

	// Ajouter le HTML au body
	window.top.document.body.insertAdjacentHTML('beforeend', calculatorHtml);

	// Ajouter les event listeners
	const calculatorBtn = window.top.document.getElementById('sms-calculator-btn');
	const calculatorPopup = window.top.document.getElementById('sms-calculator-popup');
	const calculatorClose = window.top.document.getElementById('calculator-close-btn');
	const calculatorOverlay = calculatorPopup.querySelector('.calculator-overlay');

	// Ouvrir le popup
	calculatorBtn.addEventListener('click', async () => {
		calculatorPopup.classList.add('active');

		// S'assurer que les données de campagne sont chargées
		if (!campaignData || !campaignData.campaigns || !campaignData.campaigns.length) {
			// console.log('📊 Chargement des données de campagne pour le calculateur...');
			await reqSelectCampaignData();
		}

		updateCalculation();
	});

	// Fermer le popup
	calculatorClose.addEventListener('click', () => {
		calculatorPopup.classList.remove('active');
	});

	calculatorOverlay.addEventListener('click', () => {
		calculatorPopup.classList.remove('active');
	});

	// Event listeners pour les badges de campagne
	const campaignBadges = calculatorPopup.querySelectorAll('.campaign-badge');
	campaignBadges.forEach(badge => {
		badge.addEventListener('click', () => {
			// Retirer la classe active de tous les badges
			campaignBadges.forEach(b => b.classList.remove('active'));
			// Ajouter la classe active au badge cliqué
			badge.classList.add('active');
			// Mettre à jour le calcul
			updateCalculation();
		});
	});

	// Event listeners pour les changements de prix et période
	const priceInput = calculatorPopup.querySelector('#sms-price');
	const periodSelect = calculatorPopup.querySelector('#period-select');

	// Gestion améliorée de l'input prix
	priceInput.addEventListener('input', (e) => {
		// Permettre seulement les chiffres, virgules, points et le symbole €
		let value = e.target.value.replace(/[^0-9,.€]/g, '');

		// S'assurer qu'il n'y a qu'un seul séparateur décimal
		const commaCount = (value.match(/,/g) || []).length;
		const dotCount = (value.match(/\./g) || []).length;

		if (commaCount > 1) {
			value = value.replace(/,(?=.*,)/g, '');
		}
		if (dotCount > 1) {
			value = value.replace(/\.(?=.*\.)/g, '');
		}

		// Ajouter € à la fin si pas déjà présent
		if (value && !value.includes('€')) {
			value += '€';
		}

		e.target.value = value;
		updateCalculation();
	});

	// Gestion du focus pour sélectionner le texte
	priceInput.addEventListener('focus', (e) => {
		// Sélectionner tout le texte sauf le symbole €
		const value = e.target.value;
		if (value.includes('€')) {
			e.target.setSelectionRange(0, value.length - 1);
		} else {
			e.target.select();
		}
	});

	periodSelect.addEventListener('change', updateCalculation);
}

// Fonction pour mettre à jour le calcul
function updateCalculation() {
	const calculatorPopup = window.top.document.getElementById('sms-calculator-popup');
	if (!calculatorPopup) return;

	const priceInput = calculatorPopup.querySelector('#sms-price');
	const periodSelect = calculatorPopup.querySelector('#period-select');
	const activeBadge = calculatorPopup.querySelector('.campaign-badge.active');
	const resultDisplay = calculatorPopup.querySelector('#calculation-result .result-text');

	// Extraire le prix (enlever le symbole € et remplacer , par .)
	let priceText = priceInput.value.replace('€', '').replace(',', '.');
	let price = parseFloat(priceText) || 0;

	// Obtenir la période sélectionnée
	const selectedPeriod = periodSelect.value;
	const selectedCampaign = activeBadge.dataset.campaign;

	// Calculer le nombre de SMS selon la période et la campagne
	let smsCount = getSmsCount(selectedPeriod, selectedCampaign);

	// Calculer le coût total
	let totalCost = smsCount * price;

	// Formater l'affichage
	let formattedPrice = price.toFixed(2).replace('.', ',') + '€';
	let formattedTotal = totalCost.toFixed(2).replace('.', ',') + '€';

	// Mettre à jour l'affichage
	resultDisplay.textContent = `${smsCount} SMS x ${formattedPrice} = ${formattedTotal}`;
}

// Fonction pour obtenir le nombre de SMS selon la période et la campagne
function getSmsCount(period, campaign) {
	// Mapping des périodes vers les champs de données
	const periodMapping = {
		'today': 'SmsCountToday',
		'week': 'SmsCountCurrentWeek',
		'month': 'SmsCountCurrentMonth',
		'previousMonth': 'SmsCountPreviousMonth',
		'last3months': 'SmsCountLast3Months',
		'year': 'SmsCountCurrentYear',
		'previousYear': 'SmsCountPreviousYear'
	};

	const fieldName = periodMapping[period];
	if (!fieldName || !campaignData || !campaignData.campaigns) {
		return 0;
	}

	let totalSms = 0;

	if (campaign === 'TOUS') {
		// Sommer tous les SMS de toutes les campagnes
		campaignData.campaigns.forEach(camp => {
			const smsValue = parseInt(camp[fieldName]) || 0;
			totalSms += smsValue;
		});
	} else {
		// Chercher la campagne spécifique
		const specificCampaign = campaignData.campaigns.find(camp =>
			camp.CampaignCategory && camp.CampaignCategory.trim() === campaign.trim()
		);

		if (specificCampaign) {
			totalSms = parseInt(specificCampaign[fieldName]) || 0;
		}
	}

	return totalSms;
}

// ====================== PERSISTANCE BOUTONS CLIENTS/SMS ============
// Fonction d'initialisation de la persistance des boutons Clients/SMS
function initCountTypeTogglePersistence() {
	// Restaurer l'état des boutons depuis localStorage
	const periodeCountType = loadCountTypeState('periode');
	const serviceCountType = loadCountTypeState('service');

	// Initialiser les variables globales avec les valeurs sauvegardées
	currentCountType = periodeCountType;
	currentServiceCountType = serviceCountType;

	// Recharger les états de légende avec les bons types
	smsLegendState = loadLegendState(getLegendStorageKey('periode', currentCountType), defaultSmsLegendState);
	campaignLegendState = loadLegendState(getLegendStorageKey('service', currentServiceCountType), defaultCampaignLegendState);

	// Appliquer l'état sauvegardé pour l'onglet "par période"
	const periodeClientsBtn = window.top.document.getElementById('periode-clients');
	const periodeSmsBtn = window.top.document.getElementById('periode-sms');

	if (periodeClientsBtn && periodeSmsBtn) {
		if (periodeCountType === 'sms') {
			periodeSmsBtn.checked = true;
			periodeClientsBtn.checked = false;
			currentCountType = 'sms';
		} else {
			periodeClientsBtn.checked = true;
			periodeSmsBtn.checked = false;
			currentCountType = 'clients';
		}

		// Ajouter les event listeners
		periodeClientsBtn.addEventListener('change', () => {
			if (periodeClientsBtn.checked) {
				currentCountType = 'clients';
				saveCountTypeState('periode', 'clients');
				// Recharger les données de légende pour ce type
				smsLegendState = loadLegendState(getLegendStorageKey('periode', 'clients'), defaultSmsLegendState);
				updateSmsChart();
			}
		});

		periodeSmsBtn.addEventListener('change', () => {
			if (periodeSmsBtn.checked) {
				currentCountType = 'sms';
				saveCountTypeState('periode', 'sms');
				// Recharger les données de légende pour ce type
				smsLegendState = loadLegendState(getLegendStorageKey('periode', 'sms'), defaultSmsLegendState);
				updateSmsChart();
			}
		});
	}

	// Appliquer l'état sauvegardé pour l'onglet "par service"
	const serviceClientsBtn = window.top.document.getElementById('service-clients');
	const serviceSmsBtn = window.top.document.getElementById('service-sms');

	if (serviceClientsBtn && serviceSmsBtn) {
		if (serviceCountType === 'sms') {
			serviceSmsBtn.checked = true;
			serviceClientsBtn.checked = false;
			currentServiceCountType = 'sms';
		} else {
			serviceClientsBtn.checked = true;
			serviceSmsBtn.checked = false;
			currentServiceCountType = 'clients';
		}

		// Ajouter les event listeners
		serviceClientsBtn.addEventListener('change', () => {
			if (serviceClientsBtn.checked) {
				currentServiceCountType = 'clients';
				saveCountTypeState('service', 'clients');
				// Recharger les données de légende pour ce type
				campaignLegendState = loadLegendState(getLegendStorageKey('service', 'clients'), defaultCampaignLegendState);
				updateCampaignChart();
			}
		});

		serviceSmsBtn.addEventListener('change', () => {
			if (serviceSmsBtn.checked) {
				currentServiceCountType = 'sms';
				saveCountTypeState('service', 'sms');
				// Recharger les données de légende pour ce type
				campaignLegendState = loadLegendState(getLegendStorageKey('service', 'sms'), defaultCampaignLegendState);
				updateCampaignChart();
			}
		});
	}
}

// ====================== PERSISTANCE ONGLET ACTIF ============
// Fonction d'initialisation de la persistance de l'onglet actif
function initActiveTabPersistence() {
	// Charger l'onglet sauvegardé
	const savedTab = loadActiveTab();

	// Attendre que les éléments soient créés
	setTimeout(() => {
		const periodeTab = window.top.document.querySelector('.tab-item[data-tab="periode"]');
		const serviceTab = window.top.document.querySelector('.tab-item[data-tab="service"]');

		if (periodeTab && serviceTab) {
			// Restaurer l'onglet actif
			if (savedTab === 'service') {
				// Activer l'onglet service
				periodeTab.classList.remove('active');
				serviceTab.classList.add('active');

				// Afficher le contenu correspondant
				const periodeContent = window.top.document.getElementById('periode-content');
				const serviceContent = window.top.document.getElementById('service-content');

				if (periodeContent && serviceContent) {
					periodeContent.style.display = 'none';
					serviceContent.style.display = 'block';

					// Afficher le graphique des services
					showCampaignsGraph();
				}
			} else {
				// Activer l'onglet période (par défaut)
				serviceTab.classList.remove('active');
				periodeTab.classList.add('active');

				// Afficher le contenu correspondant
				const periodeContent = window.top.document.getElementById('periode-content');
				const serviceContent = window.top.document.getElementById('service-content');

				if (periodeContent && serviceContent) {
					serviceContent.style.display = 'none';
					periodeContent.style.display = 'block';

					// Afficher le graphique des périodes
					showEchartsGraph();
				}
			}

			// Ajouter les event listeners pour sauvegarder les changements
			periodeTab.addEventListener('click', () => {
				saveActiveTab('periode');
			});

			serviceTab.addEventListener('click', () => {
				saveActiveTab('service');
			});
		}
	}, 500); // Délai plus long pour s'assurer que tous les éléments sont créés
}

// Fonction : le texte dans HEADER qui s'affiche
function consoleText(words, id, colors) {
	if (colors === undefined) colors = ['#fff'];
	let visible = true;
	let con = window.top.document.getElementById('console');
	let letterCount = 1;
	let x = 1;
	let waiting = false;
	let target = window.top.document.getElementById(id);
	target.setAttribute('style', 'color:' + colors[0]);

	let intervalId;

	function startAnimation() {
		intervalId = window.setInterval(() => {
			if (letterCount === 0 && waiting === false) {
				waiting = true;
				clearInterval(intervalId);
				con.className = 'console-underscore hidden';
				target.innerHTML = '';
			} else if (letterCount === words[0].length + 1 && waiting === false) {
				waiting = true;

				window.setTimeout(() => {
					x = -1;
					letterCount += x;
					waiting = false;
				}, 1000);
			} else if (waiting === false) {
				target.innerHTML = words[0].substring(0, letterCount);
				letterCount += x;
			}
		}, 120);
	}

	// Demarrage de l'animation au clic sur l'icône
	window.top.document.querySelector('.fimainfo-icon').addEventListener('click', function () {
		if (this.classList.contains('active')) {
			clearInterval(intervalId);
			startAnimation();
		}
	});

	let cursorBlinkInterval = window.setInterval(() => {
		if (visible === true) {
			con.className = 'console-underscore';
			visible = false;
		} else {
			con.className = 'console-underscore hidden';
			visible = true;
		}
	}, 400);

	window.setTimeout(() => {
		clearInterval(cursorBlinkInterval);
		con.className = 'console-underscore hidden';
	}, 8000);
}
// ====================== FONCTION DE CONSTRUCTION DE L'OPTION ============
// ========================================================================
function getChartOption() {
	const categories = ['Jour en cours',
		'Semaine en cours',
		'Mois en cours',
		'Mois précédent',
		'3 derniers mois',
		'Année en cours',
		'Année précédente'
	];

	// Choisir les champs selon le type de comptage sélectionné
	const fields = currentCountType === 'sms' ? ['SmsCountToday',
		'SmsCountCurrentWeek',
		'SmsCountCurrentMonth',
		'SmsCountPreviousMonth',
		'SmsCountLast3Months',
		'SmsCountCurrentYear',
		'SmsCountPreviousYear'
	] : ['CountToday',
		'CountCurrentWeek',
		'CountCurrentMonth',
		'CountPreviousMonth',
		'CountLast3Months',
		'CountCurrentYear',
		'CountPreviousYear'
	];

	function buildSeriesArray(index) {
		return fields.map(field => smsData.day[index]?.[field] || 0);
	}

	const dataArrays = [buildSeriesArray(0), // Reçu par client
	buildSeriesArray(1), // Erreur définitif
	buildSeriesArray(2), // En cours d'envoi
	buildSeriesArray(3), // Envoyés au prestataire
	buildSeriesArray(4), // Acceptés par prestataire
	buildSeriesArray(5), // Erreur temporaire
	buildSeriesArray(6) // Bloqué par STOP code
	];

	// Calculer le maximum basé sur la somme de chaque barre (période)
	const periodTotals = fields.map((_, periodIndex) => {
		return dataArrays.reduce((sum, statusArray) => sum + (statusArray[periodIndex] || 0), 0);
	});
	const rawMax = Math.max(...periodTotals);
	const maxX = rawMax; // Utiliser la valeur exacte sans marge

	function createDisplayData(arr) {
		return arr.map(value => ({
			value: value > 0 ? Math.max(value, maxX * 0.08) : 0,
			itemStyle: {
				opacity: value > 0 ? 1 : 0
			}
			,
			label: {
				show: true, formatter: () => value
			}
			,
			realValue: value
		}));
	}

	const displayData = dataArrays.map(createDisplayData);

	const seriesNames = ['Reçu par client',
		'Erreur définitif',
		'En cours d\'envoi',
		'Envoyés au prestataire',
		'Acceptés par prestataire',
		'Erreur temporaire',
		'Bloqué par STOP code'
	];

	const colors = ['#3BA272', // vert
		'#EE6666', // rouge
		'#FAC858', // jaune
		'#5470C6', // bleu
		'#73C0DE', // bleu clair
		'#FC8452', // orange
		'#91CC75' // vert clair
	];

	const series = displayData.map((data, i) => ({
		name: seriesNames[i],
		type: 'bar',
		stack: 'total',
		emphasis: {
			focus: 'series'
		}
		,
		data: data.reverse()
	}));

	return {
		legend: {
			data: seriesNames,
			top: '2%',
			left: 'center',
			itemGap: 15,
			padding: [0, 0, 10, 0],
			selected: smsLegendState
		}
		,
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				type: 'shadow'
			}
			,
			formatter: function (params) {
				const timeFrame = params[0].axisValue;

				let result = `<div style="margin:0;line-height:1;text-align:center;font-weight:700;font-size:15px;">${timeFrame}</div>`;

				params.forEach(param => {
					const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;

					result += ` <div style="margin-top:10px;line-height:1;"> ${marker}
					<span style="font-size:14px;color:#666;font-weight:400;margin-left:2px">${param.seriesName}</span> <span style="float:right;margin-left:20px;font-size:14px;color:#666;font-weight:900">${param.data.realValue}</span> </div>`;
				});
				return result;
			}
			,
			backgroundColor: 'rgba(255,255,255,0.95)',
			borderColor: '#ccc',
			borderWidth: 1,
			padding: [10, 20],
			textStyle: {
				color: '#333'
			}
			,
			extraCssText: 'box-shadow:0 0 8px rgba(0,0,0,0.1);'
		}
		,
		grid: {
			left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true
		}
		,
		xAxis: {
			type: 'value',
			max: maxX,
			axisLabel: {
				formatter: v => v.toFixed(0)
			}
		}
		,
		yAxis: {
			type: 'category',
			data: categories.reverse()
		}
		,
		color: colors,
		series: series
	};
}

// ===============================================
// =========== RAFRAÎCHISSEMENT ================
// ===============================================
async function refreshDataIfVisible() {
	const popup = window.top.document.querySelector('.fimainfo-popup');
	if (!popup || !popup.classList.contains('visible')) return;

	const isSmsTab = popup.querySelector('#sms')?.checked;

	if (isSmsTab) {
		// Détecter quel sous-onglet SMS est actif
		const activePeriodeTab = popup.querySelector('.tab-item[data-tab="periode"].active');
		const activeServiceTab = popup.querySelector('.tab-item[data-tab="service"].active');

		if (activePeriodeTab) {
			// Sous-onglet "par période" actif
			// console.log('🔄 Données SMS mises à jour - période');
			await reqSelectAllData();
			updateSmsChart();
		} else if (activeServiceTab) {
			// Sous-onglet "par service" actif
			// console.log('🔄 Données SMS mises à jour - service');
			await reqSelectCampaignData();
			updateCampaignChart();
		}

		return; // EXIT - pas besoin d'autres appels
	}
}

// Fonctions helper pour la mise à jour des graphiques
function updateSmsChart() {
	if (chart && smsData.day) {
		// Sauvegarder l'état actuel de la légende avant mise à jour
		const currentOption = chart.getOption();

		if (currentOption && currentOption.legend && currentOption.legend[0] && currentOption.legend[0].selected) {
			smsLegendState = {
				...currentOption.legend[0].selected
			};
		}

		// Recalculer toute l'option pour mettre à jour l'axe X dynamiquement
		const newOption = getChartOption();
		chart.setOption(newOption, false);
		chart.resize();
	}
}

function updateCampaignChart() {
	if (campaignChart && campaignData.campaigns) {
		// Sauvegarder l'état actuel de la légende avant mise à jour
		const currentOption = campaignChart.getOption();

		if (currentOption && currentOption.legend && currentOption.legend[0] && currentOption.legend[0].selected) {
			campaignLegendState = {
				...currentOption.legend[0].selected
			};
		}

		campaignChart.setOption(getServiceChartOption(), false);
		campaignChart.resize();
	}
}

// ========================================================================
// ======================== TRAITEMENT ====================================
async function prepareSupervision() {
	const ok = await reqCheckSupervisor();
	if (!ok) return;
	ajouterIconeAvecPopup();
}

async function showEchartsGraph() {
	if (!smsData.day) return;
	const container = window.top.document.querySelector('.container-big');
	if (!container) return;

	if (!chart) {
		chart = echarts.init(container);

		// Ajouter un listener pour le redimensionnement de la fenêtre
		window.top.addEventListener('resize', () => {
			if (chart) {
				chart.resize();
			}
		});

		// Observer les changements de taille du conteneur
		if (window.top.ResizeObserver) {
			const resizeObserver = new window.top.ResizeObserver(() => {
				if (chart) {
					chart.resize();
				}
			});
			resizeObserver.observe(container);
		}

		// Écouter les changements de la légende pour sauvegarder l'état
		chart.on('legendselectchanged', function (params) {
			smsLegendState = {
				...params.selected
			};
		});
	}

	chart.setOption(getChartOption());

	// Ajouter le wrapper pour les filtres de légende
	setTimeout(() => {
		addLegendFiltersWrapper('.container-big');
	}, 100);

	// S'assurer que le graphique utilise toute la taille disponible
	setTimeout(() => {
		chart.resize();
	}, 150);
}

// Variables déjà déclarées en haut du fichier

async function showCampaignsGraph() {
	if (!campaignData.campaigns || !campaignData.campaigns.length) {
		// console.log('📊 Chargement des données de campagne...');
		await reqSelectCampaignData();
	}

	const container = window.top.document.querySelector('.container-big-campaigns');

	if (!container) {
		return;
	}

	if (!campaignChart) {
		campaignChart = echarts.init(container);
		window.top.addEventListener('resize', () => campaignChart?.resize());

		// Écouter les changements de la légende pour sauvegarder l'état
		campaignChart.on('legendselectchanged', function (params) {
			campaignLegendState = {
				...params.selected
			};
		});
	}

	campaignChart.setOption(getServiceChartOption());

	// Ajouter le wrapper pour les filtres de légende
	setTimeout(() => {
		addLegendFiltersWrapper('.container-big-campaigns');
	}, 100);

	campaignChart.resize();
	// console.log('✅ Graphique par service mis à jour');
}

/** Prépare le graphique stacked-bar "Périodes par Services" */
function getServiceChartOption() {
	// Périodes temporelles - choisir les champs selon le type de comptage sélectionné
	const periods = currentServiceCountType === 'sms' ? ['SmsCountToday',
		'SmsCountCurrentWeek',
		'SmsCountCurrentMonth',
		'SmsCountPreviousMonth',
		'SmsCountLast3Months',
		'SmsCountCurrentYear',
		'SmsCountPreviousYear'
	] : ['CountToday',
		'CountCurrentWeek',
		'CountCurrentMonth',
		'CountPreviousMonth',
		'CountLast3Months',
		'CountCurrentYear',
		'CountPreviousYear'
	];
	const periodLabels = ['Jour en cours', 'Semaine en cours', 'Mois en cours', 'Mois précédent', '3 derniers mois', 'Année en cours', 'Année précédente'];
	const periodColors = ['#3BA272', // vert - Jour en cours
		'#5470C6', // bleu - Semaine en cours
		'#FAC858', // jaune - Mois en cours
		'#9A6FB0', // violet - Mois précédent
		'#FC8452', // orange - 3 derniers mois
		'#91CC75', // vert clair - Année en cours
		'#EE6666' // rouge - Année précédente
	];

	// Liste fixe des campagnes selon la demande
	const fixedCampaigns = ['RECRUTEMENT (RH)', 'RENOUVELLEMENT', 'APPEL SUIVI', 'LIVRAISON', 'PROSPECTION'];

	// Groupement : {Service}{Period} -> valeurs directes de la vue SQL
	const serviceAgg = {};

	// Initialiser toutes les campagnes fixes avec 0 pour toutes les périodes
	fixedCampaigns.forEach(campaign => {
		serviceAgg[campaign] = {};
		periods.forEach(period => {
			serviceAgg[campaign][period] = 0;
		});
	});

	// Si des données existent, utiliser directement les valeurs agrégées de la vue SQL
	if (campaignData?.campaigns?.length) {
		// Utiliser directement les valeurs agrégées de la vue SQL (pas de sommation)
		campaignData.campaigns.forEach(r => {
			const serviceName = r.CampaignDisplayName;
			// Ne traiter que les campagnes qui sont dans la liste fixe
			if (serviceName && fixedCampaigns.includes(serviceName)) {
				periods.forEach(period => {
					// Utiliser directement la valeur de la vue SQL (déjà agrégée)
					serviceAgg[serviceName][period] = r[period] || 0;
				});
			}
		});
	}

	// Utiliser la liste fixe des campagnes dans l'ordre spécifié
	const allServices = [...fixedCampaigns];

	// Afficher la somme par campagne et période pour vérification
	// console.log('📊 Agrégation par campagne et période:');
	// allServices.forEach(service => {
	// 	console.log(`🏢 ${service}:`);
	// 	periods.forEach((period, index) => {
	// 		console.log(`  📅 ${periodLabels[index]}: ${serviceAgg[service][period]}`);
	// 	});
	// });

	// Créer les données brutes par période
	const dataArrays = periods.map(period => allServices.map(service => serviceAgg[service][period] || 0));



	// Calculer le maximum basé sur la somme "Année en cours" + "Année précédente" pour chaque service
	const serviceTotals = allServices.map(service => {
		const currentYearField = currentServiceCountType === 'sms' ? 'SmsCountCurrentYear' : 'CountCurrentYear';
		const previousYearField = currentServiceCountType === 'sms' ? 'SmsCountPreviousYear' : 'CountPreviousYear';
		const currentYear = serviceAgg[service][currentYearField] || 0;
		const previousYear = serviceAgg[service][previousYearField] || 0;
		const total = currentYear + previousYear;
		return total;
	});
	const rawMax = Math.max(...serviceTotals);
	const maxX = rawMax; // Utiliser la valeur exacte sans marge

	// Fonction pour créer des données d'affichage proportionnelles pour chaque service
	function createProportionalDisplayData() {
		const minDisplayWidth = maxX * 0.02; // 2% minimum visible

		// Pour chaque période, calculer les données d'affichage
		return dataArrays.map((periodArray, periodIndex) => {
			return allServices.map((service, serviceIndex) => {
				const value = periodArray[serviceIndex];

				if (value === 0) {
					return {
						value: 0,
						itemStyle: { opacity: 0 },
						label: { show: true, formatter: () => value },
						realValue: value
					};
				}

				// Récupérer toutes les valeurs non-nulles pour ce service
				const serviceValues = dataArrays.map(arr => arr[serviceIndex]).filter(v => v > 0);

				if (serviceValues.length === 0) {
					return {
						value: 0,
						itemStyle: { opacity: 0 },
						label: { show: true, formatter: () => value },
						realValue: value
					};
				}

				const minValue = Math.min(...serviceValues);
				const maxValue = Math.max(...serviceValues);

				let displayValue;
				if (minValue === maxValue) {
					// Si toutes les valeurs sont identiques
					displayValue = minDisplayWidth;
				} else {
					// Interpolation linéaire: plus la valeur est grande, plus la largeur est grande
					const ratio = (value - minValue) / (maxValue - minValue);
					displayValue = minDisplayWidth + ratio * (value - minDisplayWidth);
				}

				return {
					value: displayValue,
					itemStyle: { opacity: 1 },
					label: { show: true, formatter: () => value },
					realValue: value
				};
			});
		});
	}

	// Appliquer la logique d'affichage proportionnel
	const displayData = createProportionalDisplayData();

	// Créer les séries avec les données formatées (réorganiser par période)
	const series = periodLabels.map((label, periodIndex) => ({
		name: label,
		type: 'bar',
		stack: 'total',
		itemStyle: {
			color: periodColors[periodIndex]
		},
		emphasis: {
			focus: 'series'
		},
		data: displayData[periodIndex] // données pour cette période
	}));

	// console.log('📊 Tous les services affichés:', allServices);
	// console.log('📊 Données série générées pour', series.length, 'périodes');
	// console.log('📊 État actuel de la légende:', campaignLegendState);
	// console.log('📊 Données agrégées:', serviceAgg);

	return {
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				type: 'shadow'
			}
			,
			formatter: function (params) {
				const service = params[0].axisValue;

				let result = `<div style="margin:0;line-height:1;text-align:center;font-weight:700;font-size:15px;">${service}</div>`;

				params.forEach(param => {
					const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;

					result += ` <div style="margin-top:10px;line-height:1;"> ${marker}
					<span style="font-size:14px;color:#666;font-weight:400;margin-left:2px">${param.seriesName}</span> <span style="float:right;margin-left:20px;font-size:14px;color:#666;font-weight:900">${param.data.realValue}</span> </div>`;
				});
				return result;
			}
			,
			backgroundColor: 'rgba(255,255,255,0.95)',
			borderColor: '#ccc',
			borderWidth: 1,
			padding: [10, 20],
			textStyle: {
				color: '#333'
			}
			,
			extraCssText: 'box-shadow:0 0 8px rgba(0,0,0,0.1);'
		}
		,
		legend: {
			top: '2%',
			left: 'center',
			itemGap: 15,
			data: periodLabels,
			selected: campaignLegendState
		}
		,
		grid: {
			left: '3%', right: '4%', bottom: '3%', top: '6%', containLabel: true
		}
		,
		xAxis: {
			type: 'value',
			max: maxX,
			axisLabel: {
				show: false
			}
		}
		,
		yAxis: {
			type: 'category',
			data: allServices
		}
		,
		series,
	};
}

async function main() {
	await prepareSupervision();
	await reqSelectAllData();
	await showEchartsGraph();
	// Plus de préchargement des campagnes - chargées seulement quand nécessaire
	setInterval(refreshDataIfVisible, REFRESH_INTERVAL_MS);
}

main();