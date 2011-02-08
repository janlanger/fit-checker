// Global variables
var _username = '';
var _savedUsername = '';

// jQuery extension
$.expr[':'].contentIs = function(el, idx, meta) {
    return $(el).text() === meta[3];
};

function loginToEdux(user, password, authProviderId, success, error) {
	_savedUsername = user;
	var loginUrl = 'https://edux.fit.cvut.cz/start?do=login';
	var hashCode = '';
	
	// Get hashcode
	$.ajax({
		async : true,
		type : 'GET',
		url : loginUrl,
		timeout: 10000,
		success : function(response) {
			if (response == '' && error) {
				error("Server is unavailable.");
			}
			var stopLogging = false;
			hashCode = $("form#dw__login input[name='sectok']", response).val();
			var username = $("div.user", response).text()
				.replace(/.*\(([a-z0-9]*)\).*/, "$1");
			username = $.trim(username);
			
			if (username != "") {
				if (username == _savedUsername && success) {
					_username = username;
					success(username);
					stopLogging = true;
				} else if (error) {
					error("Mismatching entered and logged username");
				}
			}
			
			if (stopLogging == false) {
				// Login
				$.ajax({
					async : true,
					type : 'POST',
					url : loginUrl,
					timeout: 10000,
					data : {
						'u': user,
						'p': password,
						'authnProvider': authProviderId,
						'sectok': hashCode,
						'id': 'start',
						'do': 'login',
						'r': 1
					},
					success : function(response) {
						var err = $("div.error", response);
						
						if (err.length != 0) {
							if (error) {
								error(err.text());
							}
						} else {
							// Get logged user
							username = $("div.user", response).text()
								.replace(/.*\(([a-z0-9]*)\).*/, "$1");
							if (username == _savedUsername && success) {
								_username = username;
								success(username);
							} else if (error) {
								error("Mismatching entered and logged username");
								
							}
						}
					},
					error : function(xhr, status, exception) {
						if (error) {
							error(status);
						}
					}
				});
			}
		},
		error : function(xhr, status, exception) {
			if (error) {
				error(status);
			}
		}
	});
}

function loginToKos(user, password, success, error) {
	var loginUrl = 'https://kos.cvut.cz/kos/login.do';
	var pageCode = '';
	var data;
	_savedUsername = user;
	
	$.ajax({
		async : true,
		type : 'GET',
		url : loginUrl,
		timeout: 10000,
		success : function(response) {
			pageCode = response.replace(
				/[\w\W]*var pageCode=\'([^;]*)\';[\w\W]*/m, "$1");
			
			$.ajax({
				async: true,
				type: 'POST',
				url: loginUrl + '?page=' + pageCode,
				timeout: 10000,
				data: {
					'sessionHash': $('input[name="sessionHash"]', response).
						val(),
					'userName': user,
					'password': password,
					'vstup': 'Vstup'
				},
				success: function (response) {
					var errors = $("span.errors", response);
					if (errors.length > 0 && error) {
						error(errors.text());
					} else if (success) {
						pageCode = response.replace(
							/[\w\W]*var pageCode=\'([^;]*)\';[\w\W]*/m, "$1");
						success(pageCode);
					}
				},
				error: function (xhr, status, exception) {
					if (error) {
						error(status);
					}
				}
			});
		},
		error : function(xhr, status, exception) {
			if (error) {
				error(status);
			}
		}
	});
            
}

function getSubjectsFromEdux(success, error) {
	var hpUrl = 'https://edux.fit.cvut.cz/';
	
	$.ajax({
		async : true,
		type : 'GET',
		url : hpUrl,
		timeout: 10000,
		success: function(response) {
			var subjects = {};
			var name, prefix;
			var username = $.trim($("div.user", response).text()
				.replace(/.*\(([a-z0-9]*)\).*/, "$1"));

			if (username != _savedUsername && error) {
				error("Mismatching entered and logged username (" + username +
					" x " + _savedUsername + ")");
			} else {
				var courses = $("a[href^=/courses/]", response);
				if (courses.length == 0 && error) {
					error("No subjects found.");
				} else {
					courses.each(function(index) {
						name = $(this).attr("href").replace(/.*\/(.*)$/, "$1");
						prefix = name.replace(/([^-])-.*/, "$1");
						if (!(prefix in subjects)) {
							subjects[prefix] = [];
						}
						subjects[prefix].push(name);

						if (index+1 == courses.length && success) {
							success(subjects);
						}
					});
				}
			}
		},
		error : function(xhr, status, exception) {
			if (error) {
				error(status);
			}
		}
	});
}

function getSubjectContent(name, success, error) {
	var user = getUsername();
	if (user == '' && error) {
		error("You're not logged in.");
	} else {
		var url = 'https://edux.fit.cvut.cz/courses/' + name +
			'/_export/xhtml/classification/student/' + user + '/start';

		$.ajax({
			async : true,
			type : 'GET',
			url : url,
			timeout: 10000,
			success: function(response) {
				var content = '';

				var firstTable = $("div.overTable:eq(0)", response).html();

				if (firstTable != null) {
					// Get rid of unneccassary content
					firstTable = firstTable.replace(
						/(.*)<thead>.*<\/thead>(.*)/, "$1$2");
					firstTable = firstTable.replace(
						/(.*)<tr><td>login<\/td>.*<\/tr>(.*)/, "$1$2");
				}
				var secondTable = $("div.overTable:eq(1)", response).html();

				if (secondTable != null) {
					secondTable = secondTable.replace(
						/(.*)<thead>.*<\/thead>(.*)/, "$1$2");
					secondTable = secondTable.replace(
						/(.*)<tr><td>login<\/td>.*<\/tr>(.*)/, "$1$2");
				}
				content += firstTable;
				content += '<h2><span>Shrnutí</span></h2>' + secondTable;

				if (content != '' && success) {
					success(content);
				} else if (error) {
					error('No data for subject found.');
				}
			},
			error : function(xhr, status, exception) {
				if (error) {
					error(status);
				}
			}
		});
	}
}

// Checks whether subject has inclusion or final mark and sum of all points
// @return {
//		status:			inclusion|succeed|failed
//		sumOfPoints:	int
//	}
function getSubjectImportantsFromEdux(html) {
	var status = null, mark, realMark, sumOfPoints = null;
	var i, ii, next, el;
	
	// Inclusion
	var inclusionStrings = ['zápočet', 'zapocet', 'Zápočet',
		'klasifikovaný zápočet', 'nárok na zápočet'];
	var inclusionValues= ['ANO', 'Ano', 'Z', '√'];
	
	for (i = 0; i < inclusionStrings.length; i++) {
		if (status == 'inclusion') {
			break;
		}

		el = $("td:contentIs('" + inclusionStrings[i] + "')", html);
		next = el.next('td');

		for (ii = 0; ii < next.length; ii++) {
			if (next[ii].firstChild != null) {
				if ($.inArray(next[ii].firstChild.nodeValue, inclusionValues)
						!= -1) {
					status = 'inclusion';
					break;
				}
			}
		}
	}

	// Mark
	var markStrings = ['klasifikovaný zápočet', 'vysledek', 'Známka', 'zápočet',
		'Zápočet'];
	var greenValues = ['A', 'B', 'C', 'D', 'E'];

	for (i = 0; i < markStrings.length; i++) {
		el = $("td:contentIs('" + markStrings[i] + "')", html);
		if (el.length > 0) {
			mark = el.next('td');

			for (ii = 0; ii < mark.length; ii++) {
				if (mark[ii].firstChild != null) {
					realMark = mark[ii].firstChild.nodeValue;
					if ($.inArray(realMark, greenValues) != -1) {
						status = 'succeed';
						break;
					} else if (realMark == 'F') {
						status = 'failed';
						break;
					}
				}
			}
		}
	}

	// Get sum of all points
	var sumStrings = ['celkem', 'Celkem', 'suma', 'cvičení celkem', 'hodnoceni',
		'celkový počet'];

	for (i = 0; i < sumStrings.length; i++) {
		el = $("td:contentIs('" + sumStrings[i] + "')", html);
		if (el.length > 0) {
			next = el.next('td');
			for (ii = 0; ii < next.length; ii++) {
				if (next[ii].firstChild != null) {
					sumOfPoints = next[ii].firstChild.nodeValue;
				}
			}
            break;
		}
	}
	
	return {'status': status, 'sumOfPoints': sumOfPoints};
}

// @return <json-formatted-object>
// @example {
//	'BI-LIN': {'inclusion': 'Z', 'mark': 'A', 'credits': '7'},
//  'BI-OSY': {'inclusion': '', 'mark': '', 'credits': '5'},
//	'BI-PA2': {'inclusion': 'Z', 'mark': 'C', 'credits': '7'}
// }
function getSubjectImportantsFromKos(pageCode, success, error) {
	var url = 'https://kos.cvut.cz/kos/results.do?page=' + pageCode;
	
	$.ajax({
		async : true,
		type : 'GET',
		url : url,
		timeout: 10000,
		success: function(response) {
			var subjects = {};
			var name, credits, inclusion, mark;
			var rows = $("td.tableRow2, td.tableRow1", response);
            rows.each(function(index) {
				if ((index-2) % 12 == 0) {
					name = $.trim($(this).text());
					credits = $.trim($(this).next().next().next().next().
						text());
					inclusion = $.trim($(this).next().next().next().next().
						next().next().next().text());
					mark = $.trim($(this).next().next().next().next().next().
						next().next().next().text());

					if (!(name in subjects)) {
						subjects[name] = {'inclusion': inclusion, 'mark': mark,
							'credits': credits};
					}
				}
				if (index+1 == rows.length && success) {
					success(subjects);
				}
			});
		},
		error : function(xhr, status, exception) {
			if (error) {
				error(status);
			}
		}
	});
}

function getJSONformattedTable(html) {
	// Small workaround to make jQuery to parse html in string
	html = "<div>" + html + "</div>";
	
	var json = {0: {}, 1: {}};
	
	$("table:eq(0) tr", html).each(function (index) {
		json[0][$("td:eq(0)", this).text()] = $("td:eq(1)", this).text();
	});
	$("table:eq(1) tr", html).each(function (index) {
		json[1][$("td:eq(0)", this).text()] = $("td:eq(1)", this).text();
	});
	
	return json;
}

function getUsername (forceRefresh, success, error) {
	if (forceRefresh == true) {
		$.ajax({
			async : true,
			type : 'GET',
			url : 'https://edux.fit.cvut.cz/',
			timeout: 10000,
			success: function(response) {
				var username = $("div.user", response).text()
					.replace(/.*\(([a-z0-9]*)\).*/, "$1");
				if (username == _savedUsername && success) {
					success(username);
				} else if(error) {
					error("Mismatching entered and logged username");
				}
			},
			error : function(xhr, status, exception) {
				if (error) {
					error(status);
				}
			}
		});
		return null;
	} else {
		return _username;
	}
}

function hideMessage() {
    $("div#status").fadeOut();
}

function showMessage(text, type, timeout) {
    $(document).scrollTop(0);
    $("div#status").html(text).show().removeClass().addClass(type);
    if (timeout) {
        setTimeout(hideMessage, timeout);
    }
}

function trackGAevent(_gaq, name, value) {
	_gaq.push(['_trackEvent', name, value]);
}