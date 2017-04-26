var token, adminUserID;

var colors = ["#0000f0", "#007100", "#007171", "#007900", "#008300", "#009500", "#009595", "#009f00", "#009f9f", "#00a377", "#00b400", "#00bad6", "#00c791", "#00d198", "#00d800", "#00e200", "#050", "#0c2e0c", "#0fceeb", "#0fd7f5", "#134b13", "#155315", "#161663", "#1c1c81", "#1e1e89", "#1f1ff5", "#1f1fff", "#294545", "#2a8050", "#2b2b2b", "#2fc12f", "#3091ad", "#339a61", "#345fdf", "#350000", "#365c5c", "#36a265", "#371801", "#3a6262", "#3d3d3d", "#410d41", "#420073", "#423880", "#42a2be", "#434343", "#44a9c6", "#49cb49", "#4bd34b", "#4d602a", "#4f4399", "#5347a0", "#5377e4", "#560097", "#590000", "#5a2702", "#5b7ee5", "#5c00a1", "#5f125f", "#5f4ec9", "#607935", "#628220", "#630000", "#642b02", "#668039", "#681468", "#6e0b0b", "#710071", "#742918", "#7869d2", "#789f27", "#7e0000", "#7e3e11", "#7ea729", "#7f71d4", "#831fdf", "#8f0e0e", "#902fc0", "#92341f", "#9440e1", "#950095", "#980f0f", "#992727", "#9946e6", "#9a3720", "#9d4e15", "#9f009f", "#9f48cb", "#a20000", "#a54ad3", "#a65217", "#aa7b0a", "#ac0000", "#b42f2f", "#b9147c", "#bc3131", "#cb940c", "#ce1338", "#d21f8f", "#d59b0d", "#db2095", "#dd284c", "#e6284f", "#f00000", "#f04100", "#f06b00", "#f09b00", "#f51f1f", "#f5581f", "#f57e1f", "#f5a91f", "#fd2b9c", "#ff058c", "#ff1f1f", "#ff33a1", "#ff5b1f", "#ff831f", "#ffb01f"];

var contactMethodTypes = {
	"email_contact_method": "Email", 
	"phone_contact_method": "Phone", 
	"push_notification_contact_method": "Push",
	"sms_contact_method": "Text"
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function PDRequest(token, endpoint, method, options) {

	var merged = $.extend(true, {}, {
		type: method,
		dataType: "json",
		url: "https://api.pagerduty.com/" + endpoint,
		headers: {
			"Authorization": "Token token=" + token,
			"Accept": "application/vnd.pagerduty+json;version=2"
		},
		error: function(err) {
			$('.busy').hide();
			var alertStr = "Error '" + err.status + " - " + err.statusText + "' while attempting " + method + " request to '" + endpoint + "'";
			try {
				alertStr += ": " + err.responseJSON.error.message;
			} catch (e) {
				alertStr += ".";
			}
			
			try {
				alertStr += "\n\n" + err.responseJSON.error.errors.join("\n");
			} catch (e) {}

			alert(alertStr);
		}
	},
	options);

	$.ajax(merged);
}

function populateEPSelect() {
	var options = {
		success: function(data) {
			data.escalation_policies.forEach(function(ep) {
				console.log("EP: " + ep.id + ": " + ep.summary);
				$('#ep-select').append($('<option/>', {
					value: ep.id,
					text: ep.summary
				}));
			});
			populateEPDetails();
		}
	}
	
	PDRequest(token, "/escalation_policies", "GET", options);
}

function populateEPDetails() {
	$('#ep').html('');
	var htmlstr = '';
	var options = {
		success: function(data) {
			data.escalation_policy.escalation_rules.forEach(function(rule) {
				console.log("Rule " + rule.id);
				htmlstr += '<p class="highlight">Notify:<br>';
				rule.targets.forEach(function(target) {
					console.log("  Target " + target.id + ": " + target.summary);
					htmlstr += '<button class="highlight ' + target.type + '" id="' + target.id + '">' + target.summary + '</button>';
				});
				htmlstr += '<br>';
				htmlstr += '</p><p class="highlight">Escalate after ' + rule.escalation_delay_in_minutes + ' minutes<br></p>';
			});
			htmlstr += '<p class="highlight">Repeat ' + data.escalation_policy.num_loops + ' times</p>';
			$('#ep').html(htmlstr);
			$('.schedule_reference,.user_reference').click(function() {
				clickedEP($(this));
			});
		}
	}
	
	PDRequest(token, "/escalation_policies/" + $('#ep-select').val(), "GET", options);
}

function findAnyAdminUser() {
	var options = {
		success: function(data) {
			data.users.forEach(function(user) {
				if ( !adminUserID && user.role == "admin" ) {
					console.log("found admin user " + user.id);
					adminUserID = user.id;
				}
			});
		}
	}
	PDRequest(token, "/users", "GET", options);
}

function getCalendarFeedURL(calendarID) {
	var options = {
		data: {
			"requester_id": adminUserID
		},
		success: function(data) {
			console.log("web cal url: " + data.schedule.http_cal_url);
			showCalendar(data.schedule.http_cal_url);
		}
	}
	
	PDRequest(token, "/schedules/" + calendarID, "GET", options);
}

function showCalendar(url) {
	$('#cal').html('<div id="cal-title"></div><div id="cal-view"></div>');
	$('.busy').show();
	url = "https://cors-anywhere.herokuapp.com/" + url;

	$.ajax({
		url: url,
		type: "text",
		method: "get",
		headers: {
			"Origin": "local"
		},
		success: function(data) {
			$('.busy').hide();
			var jcalData = ICAL.parse(data);
			var comp = new ICAL.Component(jcalData);
			
			var calName = comp.getFirstProperty("x-wr-calname").getFirstValue();
			$('#cal-title').html('<h1 style="background-color: #f0f0f0">' + calName + '</h1><br>');
			
			var vevents = comp.getAllSubcomponents("vevent");
			var events = [];
			var peopleColors = {};
			vevents.forEach(function(vevent) {
				var event = new ICAL.Event(vevent);
				var title = event.summary.replace(/^On Call - /g, '');
				title = title.replace(/ - .*$/, '');
				if ( ! peopleColors[title] ) {
					peopleColors[title] = colors[Math.floor(Math.random() * colors.length)];
				}
				events.push({
					title: title,
					start: (new ICAL.Time(event.startDate)).toString(),
					end: (new ICAL.Time(event.endDate)).toString(),
					color: peopleColors[title],
					weburl: event._firstProp("attendee")
				});
			});

			$('#cal-view').fullCalendar({
				events: events,
				defaultView: getParameterByName("view") ? getParameterByName("view") : "month",
				header: {
				    left:   'title',
				    center: 'month,agendaWeek,agendaDay,listMonth',
				    right:  'today prev,next'
				},
				eventMouseover: function() {
					$(this)[0].style.cursor = "pointer";
				},
				eventClick: function(calEvent) {
					showUserFromEmail(calEvent.weburl);
				}
			});
		}
	});
}

function showUserFromEmail(email) {
	console.log(email);
	var options = {
		data: {
			"query": email
		},
		success: function(data) {
			console.log("user id is " + data.users[0].id);
			showUser(data.users[0].id);
		}
	};

	PDRequest(token, "/users", "GET", options);
}

function showUser(userID) {
	var options = {
		data: {
			"include[]": ["contact_methods", "notification_rules"]
		},
		success: function(data) {
			var name = data.user.summary;
			var title = data.user.job_title;
			var htmlStr = '';
			if ( data.user.avatar_url ) {
				htmlStr += '<img src="' + data.user.avatar_url + '"><br>';
			}
			htmlStr += "<h1>" + name + "</h1><h3>" + title + "</h3>"
			data.user.notification_rules.forEach(function(rule) {
				if (rule.urgency === "high") {
					var address = rule.contact_method.address;
					if ( rule.contact_method.type == "phone_contact_method" || rule.contact_method.type == "sms_contact_method") {
						address = libphonenumber.format("+" + rule.contact_method.country_code + address, "US", "International");
						var scheme = rule.contact_method.type == "phone_contact_method" ? 'tel:' : 'sms:';
						address = '<a href="' + scheme + address + '">' + address + '</a>';
					} else if ( rule.contact_method.type == "email_contact_method" ) {
						address = '<a href="mailto:' + address + '">' + address + '</a>';
					}
					htmlStr += contactMethodTypes[rule.contact_method.type] + ": " + address + "<br>";
				}
			});
			$('#contact').html(htmlStr);
		}
	}
	
	PDRequest(token, "/users/" + userID, "GET", options);
}

function clickedEP(element) {
	if ( element.hasClass('user_reference')) {
		console.log("User " + element.attr('id'));
		showUser(element.attr('id'))
	} else if ( element.hasClass('schedule_reference')) {
		console.log("Schedule " + element.attr('id'));
		getCalendarFeedURL(element.attr('id'));
	}
}

function main() {
	if ( getParameterByName("token") ) {
		token = getParameterByName("token");
	}
	
	$('#ep-select').change(function() {
		populateEPDetails();
	});

	populateEPSelect();
	findAnyAdminUser();

}


$(document).ready(main);
