/**
 * Requête Hermes SELECT 
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 * @param {int} maxRow Nombre de lignes (100 par défaut)
 * @returns {json} Résultat
 */
async function reqSelect(connection, query, maxRow = 100) {

	// Échapper tous les caractères spéciaux XML dans la requête
	const escapedQuery = escapeXml(query);

	//const url = `${window.location.origin}/hermes_net_v5/PlateformPublication//Web_Service/ScriptWS.asmx`;
	//const scriptPath = window.location.href.replace(/&/g, '&amp;');

	const url = "http://192.168.9.237/hermes_net_v5/PlateformPublication/Web_Service/ScriptWS.asmx";
	const scriptPath = "http://192.168.9.237/hermes_net_v5/PlateformPublication//Home/31_1/1625_Dev/Index.aspx?Oid_User=dA5H2XEK&amp;Oid_Company=dAlKTsEK&amp;Ws_Admin=http%3A%2F%2F192.168.9.237%2Fhermes_net_v5%2Fadmin%2Fweb_service%2FInfoAdmin.asmx&amp;Skin=LIGHT&amp;INDICE=1&amp;culture=fr-FR&amp;Oid_Network=&amp;Oid_Network_Agent=&amp;DNIS=&amp;TEL=&amp;EMAIL=&amp;COOKIE=&amp;USER=1000&amp;NAME=VOCALCOM&amp;STATION=3560&amp;ASSOCIATE=&amp;MEMO=&amp;CAMPAIGN=&amp;NATIONAL_PHONE_NUMBER=&amp;E164_PHONE_NUMBER=&amp;ANI=&amp;Debug=0&amp;WS_Admin=http://192.168.9.237/hermes_net_v5/admin/web_service/InfoAdmin.asmx&amp;Oid_Company=dAlKTsEK&amp;";

	const headers = {
		"Content-Type": "text/xml; charset=UTF-8"
	};

	const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <ExecuteServerSideCommand xmlns="http://vocalcom.com/webscripter/script">
                    <command>
                        <s:Cmd xmlns:s="urn:vocalcom-script-4" id="SQLQueryDataSet" Description="" connection="${connection}" query="${escapedQuery}" destarray="$liste" MaxRow="${maxRow}" GetColumnName="true" type="SQLDataSet"></s:Cmd>
                    </command>
                    <globalvar>
                        <o xmlns="" Id="GLOBAL"></o>
                    </globalvar>
                    <scriptPath>${scriptPath}</scriptPath>
                </ExecuteServerSideCommand>
            </soap:Body>
        </soap:Envelope>`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: body,
			redirect: 'follow'
		});

		const xml = await response.text();
		const json = await traitmentRequest(xml, connection, query);
		return json;
	} catch (error) {
		console.error('Error:', error);
	}
}

/**
 * Requête Hermes INSERT
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 */
async function reqInsert(connection, query) {
	await hermesSQLQuery(connection, query);
}

/**
 * Requête Hermes UPDATE
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 */
async function reqUpdate(connection, query) {
	await hermesSQLQuery(connection, query);
}

/**
 * Requête Hermes DELETE
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 */
async function reqDelete(connection, query) {
	await hermesSQLQuery(connection, query);
}

/**
 * Requête Hermes INSERT / UPDATE / DELETE
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 * @param {boolean} logError True => traitement du résultat / False => non traitement du résultat
 */
async function hermesSQLQuery(connection, query, logError = true) {

	// Échapper tous les caractères spéciaux XML dans la requête
	const escapedQuery = escapeXml(query);

	//const url = `${window.location.origin}/hermes_net_v5/PlateformPublication//Web_Service/ScriptWS.asmx`;
	//const scriptPath = window.location.href.replace(/&/g, '&amp;');

	const url = "http://192.168.9.237/hermes_net_v5/PlateformPublication/Web_Service/ScriptWS.asmx";
	const scriptPath = "http://192.168.9.237/hermes_net_v5/PlateformPublication//Home/31_1/1625_Dev/Index.aspx?Oid_User=dA5H2XEK&amp;Oid_Company=dAlKTsEK&amp;Ws_Admin=http%3A%2F%2F192.168.9.237%2Fhermes_net_v5%2Fadmin%2Fweb_service%2FInfoAdmin.asmx&amp;Skin=LIGHT&amp;INDICE=1&amp;culture=fr-FR&amp;Oid_Network=&amp;Oid_Network_Agent=&amp;DNIS=&amp;TEL=&amp;EMAIL=&amp;COOKIE=&amp;USER=1000&amp;NAME=VOCALCOM&amp;STATION=3560&amp;ASSOCIATE=&amp;MEMO=&amp;CAMPAIGN=&amp;NATIONAL_PHONE_NUMBER=&amp;E164_PHONE_NUMBER=&amp;ANI=&amp;Debug=0&amp;WS_Admin=http://192.168.9.237/hermes_net_v5/admin/web_service/InfoAdmin.asmx&amp;Oid_Company=dAlKTsEK&amp;";
	const headers = {
		"Content-Type": "text/xml; charset=UTF-8"
	};

	const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <ExecuteServerSideCommand xmlns="http://vocalcom.com/webscripter/script">
                    <command>
                        <s:Cmd xmlns:s="urn:vocalcom-script-4" connection="${connection}" type="SQLQuery">${escapedQuery}</s:Cmd>
                    </command>
                    <globalvar>
                        <o xmlns="" Id="GLOBAL"></o>
                    </globalvar>
                    <scriptPath>${scriptPath}</scriptPath>
                </ExecuteServerSideCommand>
            </soap:Body>
        </soap:Envelope>`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: body,
			redirect: 'follow'
		});
		const xml = await response.text();

		if (logError) {
			await traitmentRequest(xml, connection, query);
		}

	} catch (error) {
		console.error('Error:', error);
	}
}

/**
 * Traitement du résultat de la requête
 * @param {string} xml Résultat de la requête Hermes au format XML 
 * @param {string} connection Base de donnée
 * @param {string} query Requête
 * @returns Retourne le résultat de la requête
 */
async function traitmentRequest(xml, connection, query) {

	try {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xml, "text/xml");
		const errorSql = xmlDoc.querySelector('Error');

		if (errorSql) {
			// Une erreur est générée pour obtenir l'endroit où la requête a été exécutée
			throw new Error(errorSql.textContent);
		} else {
			const json = await queryXmlToJson(xml);
			return json;
		}
	} catch (error) {
		await sendError(error, connection, query);
		return '';
	}
}

/**
 * Transforme le résultat de la requête Hermes au format XML en :
 * Un tableau d'objet JSON
 * Un objet JSON
 * Une valeur
 * @param {string} xml Résultat de la requête Hermes au format XML 
 * @returns {array || json || string || int} Résultat de la conversion XML to JSON
 */
async function queryXmlToJson(xml) {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xml, "text/xml");

	// Sélection de l'élément parent "liste"
	const liste = xmlDoc.querySelector('a[Id="liste"]');

	if (!liste) {
		return;
	}

	// Extraction des noms de colonnes à partir de l'élément avec l'ID '0'
	const headers = Array.from(xmlDoc.querySelectorAll('a[Id="0"] s')).map(header => header.textContent);

	// Récupération de tous les éléments 'a' enfants de 'liste', en excluant le premier (en-tête)
	const entries = Array.from(liste.children).slice(1);

	// Construction du tableau à partir des données extraites
	const result = entries.map(entry => {
		let row = {};
		headers.forEach((header, index) => {
			const sCell = entry.querySelector(`s[Id="${index}"]`); // string
			const dCell = entry.querySelector(`d[Id="${index}"]`); // digit
			row[header] = sCell ? sCell.textContent : dCell ? parseFloat(dCell.textContent) : null;
		});
		return row;
	});

	// Si le tableau contient un seul objet, on retourne cet objet
	if (result.length == 1) {
		const jsonObj = result[0];

		// Si l'objet contient exactement une seule paire clé-valeur, on retourne cette valeur uniquement
		if (Object.keys(jsonObj).length == 1) {
			const key = Object.keys(jsonObj)[0];
			return jsonObj[key];
		} else {
			return jsonObj;
		}
	}

	return result;
}

// /**
//  * Insertion de l'erreur d'exécution de la requête
//  * @param {object} error Erreur d'exécution de la requête
//  * @param {string} connection Base de donnée
//  * @param {string} query Requête
//  */
// function sendError(error, connection, query) {
// 	// Adresse Hermes
// 	const url = window.location.href;
// 	const origin = window.location.origin;

// 	// Informations script
// 	const path = window.location.pathname.split('/');
// 	const scriptId = path[6];
// 	const customerId = path[5].split('_')[0];

// 	let queryError = `INSERT INTO [192.168.9.113].HN_FIMAINFO_CONFIG.dbo.erreurReqSQLHermes (
//         customer_id,
//         campaign_id,
//         script_id,
//         script_name,
//         serveur,
//         connexion,
//         requete_sql,
//         erreur_sql,
//         indice,
//         url
//     ) VALUES (
//         ${customerId},
//         '${GLOBAL.CAMPAIGN}',
//         '${scriptId}',
//         '',
//         '${origin}',
//         '${connection}',
//         '${query.replace(/'/g, `''`)}',
//         '${error.stack.replace(/'/g, `''`)}',
//         ${GLOBAL.INDICE},
//         '${url}'
//     )`;

// 	// Insertion de l'erreur sans traitement du retour de cette requête
// 	hermesSQLQuery(connection, queryError, false);
// }


// Echappe tous les caractères spéciaux qui ne seront pas interprétées comme du code XML invalide.
function escapeXml(unsafe) {
	return unsafe.replace(/[&<>"']/g, function (match) {
		switch (match) {
			case '&': return '&amp;';
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '"': return '&quot;';
			case "'": return '&apos;';
		}
	});
}