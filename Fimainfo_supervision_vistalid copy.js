//import { createTable } from './utils/tables';

// ----------------------------- DECLARATION DES VARIABLES --------------------------------
const db_client = "HN_GUYOT"; // Nom de la base à changer en fonction du client
const cloud_1 = "[CRCDIJSQL2]";
const cloud_2 = "[192.168.9.237]";
let customer_id = 0;

let supervisorList = {};
const urlPage = window.top.location.href; // URL de la page
let smsData = {};

// intervalle de rafraîchissement de l'interface (pop-up) quand il est visible
const REFRESH_INTERVAL_MS = 5 * 1000; // 30 secondes
let chart;

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
function loadCssFileInWorkspace(filename) {
	const link = window.top.document.createElement('link');
	const timestamp = new Date().getTime(); // pour éviter le cache
	link.href = `http://192.168.9.237/hermes_net_v5/Supervision/Fimainfo_config/${filename}?v=${timestamp}`;
	link.type = 'text/css';
	link.rel = 'stylesheet';
	window.top.document.head.appendChild(link);
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

console.log("URL de la page actuelle :", urlPage);
const params = new URLSearchParams(urlPage.split('?')[1] || '');
const agentStation = params.get('Station');
const customerOid = params.get('Oid_Company');
console.log("Station de l'agent est :", agentStation);
console.log("Oid_Company (customerOid) de l'agent est :", customerOid);

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
		console.log("Superviseur trouvé :");
		console.table(supervisorList);
		customer_id = supervisorList.customerId || 0;
		return true;
	} catch (error) {
		console.error("Erreur lors de l'exécution de la requête :", error);
		return false;
	}
}

async function executeQuery(query) {
	//console.warn('Executing query:', query);
	try {
		const result = await reqSelect(db_client, query);
		if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
			console.error('Erreur : aucun donnée trouvé.');
			return false;
		}
		//console.log('Query result:', result);
		console.log('Mise à jour de données : SMS');
		return result;
	} catch (error) {
		console.error("Erreur lors de l'exécution de la requête :", error);
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
			console.error('Customer ID non reconnu:', customer_id);
			showSubscriptionError();
			return false;
	}
	const query = `
         SELECT *
         FROM ${cloud_1}.[HN_UNICAP].[dbo].[${tableName}]
    `;
	const result = await executeQuery(query);
	if (result) smsData.day = result;
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
		<div class='console-underscore' id='console'>&#95;</div>
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
		 <label for="sms" data-hover="SMS en détails">
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
		 <div class="sms-f text-f">
			<div class="title-f">SMS par période</div>
			<div class="container-big">
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
							<img classe="preview-presant" src="http://192.168.9.237/hermes_net_v5/Supervision/Fimainfo_config/media/img/appels_entrants.png" alt="graphique appels sortants">
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

	// Ajouter des listeners pour redimensionner le graphique lors du changement d'onglet
	const smsRadio = popup.querySelector('#sms');
	if (smsRadio) {
		smsRadio.addEventListener('change', () => {
			if (smsRadio.checked) {
				setTimeout(() => {
					if (chart) {
						chart.resize();
					}
				}, 100);
			}
		});
	}


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
		intervalId = window.setInterval(function () {
			if (letterCount === 0 && waiting === false) {
				waiting = true;
				clearInterval(intervalId);
				con.className = 'console-underscore hidden';
				target.innerHTML = '';
			} else if (letterCount === words[0].length + 1 && waiting === false) {
				waiting = true;
				window.setTimeout(function () {
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

	let cursorBlinkInterval = window.setInterval(function () {
		if (visible === true) {
			con.className = 'console-underscore';
			visible = false;
		} else {
			con.className = 'console-underscore hidden';
			visible = true;
		}
	}, 400);

	window.setTimeout(function () {
		clearInterval(cursorBlinkInterval);
		con.className = 'console-underscore hidden';
	}, 8000);
}

// ========================================================================
// ====================== FONCTION DE CONSTRUCTION DE L'OPTION ============
// ========================================================================
function getChartOption() {
	const categories = [
		'Jour en cours',
		'Semaine en cours',
		'Mois en cours',
		'3 derniers mois',
		'Année en cours',
		'Année précédente'
	];

	const fields = [
		'n_day',
		'n_current_week',
		'n_month',
		'n_3_month',
		'n_current_year',
		'n_previous_year'
	];

	function buildSeriesArray(index) {
		return fields.map(field => smsData.day[index]?.[field] || 0);
	}

	const dataArrays = [
		buildSeriesArray(0), // Reçu par client
		buildSeriesArray(1), // Erreur définitif
		buildSeriesArray(2), // En cours d'envoi
		buildSeriesArray(3), // Envoyés au prestataire
		buildSeriesArray(4), // Acceptés par prestataire
		buildSeriesArray(5), // Erreur temporaire
		buildSeriesArray(6)  // Bloqué par STOP code
	];

	const maxX = Math.max(...dataArrays.flat());

	function createDisplayData(arr) {
		return arr.map(value => ({
			value: value > 0 ? Math.max(value, maxX * 0.02) : 0,
			itemStyle: { opacity: value > 0 ? 1 : 0 },
			label: { show: true, formatter: () => value },
			realValue: value
		}));
	}

	const displayData = dataArrays.map(createDisplayData);

	const seriesNames = [
		'Reçu par client',
		'Erreur définitif',
		'En cours d\'envoi',
		'Envoyés au prestataire',
		'Acceptés par prestataire',
		'Erreur temporaire',
		'Bloqué par STOP code'
	];


	const colors = [
		'#3BA272', // vert
		'#EE6666', // rouge
		'#FAC858', // jaune
		'#5470C6', // bleu
		'#73C0DE', // bleu clair
		'#FC8452', // orange
		'#91CC75'  // vert clair
	];

	const series = displayData.map((data, i) => ({
		name: seriesNames[i],
		type: 'bar',
		stack: 'total',
		emphasis: { focus: 'series' },
		data: data.reverse()
	}));

	return {
		legend: {
			data: seriesNames,
			top: '2%',
			left: 'center',
			itemGap: 15,
			padding: [0, 0, 10, 0],
			selected: {
				'Reçu par client': true,
				'Erreur définitif': true,
				'En cours d\'envoi': true,
				'Envoyés au prestataire': true,
				'Acceptés par prestataire': false,
				'Erreur temporaire': false,
				'Bloqué par STOP code': false
			}
		},
		tooltip: {
			trigger: 'axis',
			axisPointer: { type: 'shadow' },
			formatter: function (params) {
				const timeFrame = params[0].axisValue;
				let result = `<div style="margin:0;line-height:1;text-align:center;font-weight:700;font-size:15px;">${timeFrame}</div>`;
				params.forEach(param => {
					const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;
					result += `
                        <div style="margin-top:10px;line-height:1;">
                            ${marker}
                            <span style="font-size:14px;color:#666;font-weight:400;margin-left:2px">${param.seriesName}</span>
                            <span style="float:right;margin-left:20px;font-size:14px;color:#666;font-weight:900">${param.data.realValue}</span>
                        </div>`;
				});
				return result;
			},
			backgroundColor: 'rgba(255,255,255,0.95)',
			borderColor: '#ccc',
			borderWidth: 1,
			padding: [10, 20],
			textStyle: { color: '#333' },
			extraCssText: 'box-shadow:0 0 8px rgba(0,0,0,0.1);'
		},
		grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
		xAxis: {
			type: 'value',
			max: maxX,
			axisLabel: { formatter: v => v.toFixed(0) }
		},
		yAxis: {
			type: 'category',
			data: categories.reverse()
		},
		color: colors,
		series: series
	};
}

// ===============================================
// =========== RAFRAÎCHISSEMENT ================
// ===============================================
async function refreshDataIfVisible() {
	const popup = window.top.document.querySelector('.fimainfo-popup');
	if (popup && popup.classList.contains('visible')) {
		await reqSelectAllData();
		const newSeries = getChartOption().series;
		chart.setOption({ series: newSeries }, false);
		// Redimensionner après mise à jour des données
		setTimeout(() => {
			if (chart) {
				chart.resize();
			}
		}, 50);
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
	}
	chart.setOption(getChartOption());

	// S'assurer que le graphique utilise toute la taille disponible
	setTimeout(() => {
		if (chart) {
			chart.resize();
		}
	}, 50);
}

async function main() {
	await prepareSupervision();
	await reqSelectAllData();
	await showEchartsGraph();
	setInterval(refreshDataIfVisible, REFRESH_INTERVAL_MS);
}

main();
