// tables.js

// Tables SMS
export function createTable(data, containerSelector) {
	const container = window.top.document.querySelector(containerSelector);
	if (!container) {
		console.error(`Контейнер с селектором ${containerSelector} не найден.`);
		return;
	}
	const table = new Tabulator(container, {
		data: data, // Данные для таблицы
		layout: "fitColumns", // Автоматическая подгонка колонок
		columns: [
			{ title: "Description", field: "Description", headerFilter: true },
			{ title: "Jour (n_day)", field: "n_day", hozAlign: "center" },
			{ title: "Semaine (n_current_week)", field: "n_current_week", hozAlign: "center" },
			{ title: "Mois (n_month)", field: "n_month", hozAlign: "center" },
			{ title: "3 Mois (n_3_month)", field: "n_3_month", hozAlign: "center" },
			{ title: "Année (n_current_year)", field: "n_current_year", hozAlign: "center" },
			{ title: "Année précédente (n_previous_year)", field: "n_previous_year", hozAlign: "center" },
		],
		rowFormatter: (row) => {
			// Применяем стили к рядам, если необходимо
			const data = row.getData();
			if (data.n_day > 50) {
				row.getElement().style.backgroundColor = "#e7f4e4";
			}
		},
		headerSort: true,
		pagination: "local",
		paginationSize: 5,
	});
	return table;
}







// ;WITH StatusList AS (
// 	SELECT 'Y'    AS GroupStatus, 'Reçu par client'   AS Description, 1 AS SortOrder
// 	UNION ALL
// 	SELECT 'E'    AS GroupStatus, 'Erreur definitif'  AS Description, 2 AS SortOrder
// 	UNION ALL
// 	SELECT 'NULL' AS GroupStatus, 'En cours d''envoi' AS Description, 3 AS SortOrder
// ),
// Aggregated AS (
// 	SELECT
// 			CASE
// 				 WHEN e.SENT = 'Y' THEN 'Y'
// 				 WHEN e.SENT = 'E' THEN 'E'
// 				 ELSE 'NULL'      -- когда e.SENT не 'Y' и не 'E', в том числе e.SENT IS NULL
// 			END AS GroupStatus
// 		 , SUM(CASE WHEN e.SEND_DATE = CONVERT(varchar(8), GETDATE(), 112) THEN 1 ELSE 0 END) AS n_day
// 		 , SUM(
// 			  CASE WHEN DATEPART(ISO_WEEK, e.SEND_DATE) = DATEPART(ISO_WEEK, GETDATE())
// 							AND DATEPART(YEAR, e.SEND_DATE) = DATEPART(YEAR, GETDATE())
// 					 THEN 1 ELSE 0
// 			  END
// 			) AS n_current_week
// 		 , SUM(CASE WHEN LEFT(e.SEND_DATE, 6) = CONVERT(varchar(6), GETDATE(), 112) THEN 1 ELSE 0 END) AS n_month
// 		 , SUM(CASE WHEN LEFT(e.SEND_DATE, 6) >= CONVERT(varchar(6), DATEADD(MONTH, -2, GETDATE()), 112) THEN 1 ELSE 0 END) AS n_3_month
// 		 , SUM(CASE WHEN LEFT(e.SEND_DATE, 4) = CONVERT(varchar(4), GETDATE(), 112) THEN 1 ELSE 0 END) AS n_current_year
// 		 , SUM(CASE WHEN LEFT(e.SEND_DATE, 4) = CONVERT(varchar(4), DATEADD(YEAR, -1, GETDATE()), 112) THEN 1 ELSE 0 END) AS n_previous_year
// 	FROM [HN_VMC].[dbo].[FULLFILMENT] AS e
// 	WHERE (e.SENT = 'Y' OR e.SENT = 'E' OR e.SENT IS NULL)
// 	  AND e.CUSTOMER_ID = 30
// 	GROUP BY
// 			CASE
// 				 WHEN e.SENT = 'Y' THEN 'Y'
// 				 WHEN e.SENT = 'E' THEN 'E'
// 				 ELSE 'NULL'
// 			END
// )
// SELECT
// 	  30                             AS id_customer
// 	, s.GroupStatus                  AS [Status]
// 	, s.Description
// 	, ISNULL(a.n_day, 0)            AS n_day
// 	, ISNULL(a.n_current_week, 0)   AS n_current_week
// 	, ISNULL(a.n_month, 0)          AS n_month
// 	, ISNULL(a.n_3_month, 0)        AS n_3_month
// 	, ISNULL(a.n_current_year, 0)   AS n_current_year
// 	, ISNULL(a.n_previous_year, 0)  AS n_previous_year
// FROM StatusList AS s
// LEFT JOIN Aggregated AS a
// 	ON s.GroupStatus = a.GroupStatus;
