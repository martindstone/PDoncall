var token, anyUserID;

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

function populateServiceSelect(offset) {
	var options = {
		success: function(data) {
			data.services.forEach(function (service) {
				$('#service-select').append($('<option/>', {
					value: service.id,
					text: service.summary,
					epid: service.escalation_policy.id
				}));
			});
			if ( data.more == true ) {
				populateServiceSelect(data.offset + data.limit);
			} else {
				if ( localStorage.getItem("service-select-selected") && $('#service-select option[value="' + localStorage.getItem("service-select-selected") + '"]').length > 0) {
					$('#service-select').val(localStorage.getItem("service-select-selected"));
				}
				populateEPDetails();
			}
		}
	}
	if ( offset ) {
		options['data'] = {
			'offset': offset
		};
	} else {
		$('#service-select').html('');
	}

	PDRequest(token, "/services", "GET", options);
}

function populateUserSelect(offset) {
	var options = {
		success: function(data) {
			data.users.forEach(function (user) {
				$('#user-select').append($('<option/>', {
					value: user.id,
					text: user.name,
				}));
			});
			if ( data.more == true ) {
				populateUserSelect(data.offset + data.limit);
			}
		}
	}
	if ( offset ) {
		options['data'] = {
			'offset': offset
		};
	} else {
		$('#user-select').html('');
	}

	PDRequest(token, "/users", "GET", options);
}

function populateUserDetails() {
	$('#cal').html('<div id="cal-title"></div><div id="cal-view"></div>');
	var userName = $('#user-select option:selected').text();
	var userID = $('#user-select option:selected').val();
	var events = [];

	var options = {
		data: {
			'user_ids[]': userID,
			'until': moment().add(1, 'months').toISOString()
		},
		success: function(data) {
			data.oncalls.forEach(function(oncall) {
				console.log(`Start: ${oncall.start}, End: ${oncall.end}, EP: ${oncall.escalation_policy.summary}`);
				var title = `${oncall.escalation_policy.summary} (Level ${oncall.escalation_level})`;
				if ( oncall.schedule && oncall.schedule.summary ) {
					title = `${title} (Schedule ${oncall.schedule.summary})`
				}
				events.push({
					start: oncall.start,
					end: oncall.end,
					title: title
				});
			});
			// console.log(data);
			var headline = `<h2 style="background-color: #f0f0f0">On-calls for ${userName}</h2>`;
			$('#cal-title').html(headline);

			$('#cal-view').fullCalendar({
				events: events,
				defaultView: 'listMonth'
			});
		}
	}

	PDRequest(token, '/oncalls', "GET", options);
}

function populateEPDetails() {
	$('#ep').html('');
	var serviceName = $('#service-select option:selected').text();
	var htmlstr = '';
	var options = {
		data: {
			'include[]': 'current_oncall'
		},
		success: function(data) {
			htmlstr += '<div class="escalation-policy-container pd-item">';
			htmlstr += '<div class="pd-item-header"><h2 class="escalation-policy-name">Service: ' + serviceName + '</h2><h4>Escalation Policy: ' + data.escalation_policy.summary + '</h4></div>';
			htmlstr += '<div class="pd-escalation-policy pd-escalation-policy-padded">';
			htmlstr += '<div class="escalation-rules">';
			
			
			htmlstr += '<div class="escalation-policy-layer escalation-policy-layer-trigger">';
			htmlstr += '<div class="escalation-policy-circle"><i class="fa fa-warning" aria-hidden="true"></i></div>';
			htmlstr += '<div class="escalation-policy-layer-content">';
			htmlstr += '<p>Immediately after an incident is triggered:</p>';
			htmlstr += '</div></div></div>';
			
			
			htmlstr += '<div class="escalation-rule-list">';
			var ruleNum = 0;
			data.escalation_policy.escalation_rules.forEach(function(rule) {
				ruleNum++;
				htmlstr += '<div class="escalation-rule-container">';
				
				htmlstr += '<div class="escalation-policy-layer">';
				htmlstr += '<div class="escalation-policy-circle">' + ruleNum + '</div>';
				htmlstr += '<div class="escalation-policy-layer-content">';
				htmlstr += '<p><i class="fa fa-bell" aria-hidden="true"></i> Notify:</p>';
				htmlstr += '<ul class="escalation-recipient-list">';
				
				var oncallLookup = {};
				if ( rule.current_oncalls.length > 0 ) {
					rule.current_oncalls.forEach(function(oncall) {
						if ( oncall.escalation_target.type == "schedule_reference" ) {
							oncallLookup[oncall.escalation_target.id] = oncall;
						}
					})
				}
				rule.targets.forEach(function(target) {
					htmlstr += '<li>';
					if ( target.type == "schedule_reference" && oncallLookup[target.id] ) {
						htmlstr += '<div class="escalation-recipient ' + target.type + '" id="' + target.id + '" userid="' + oncallLookup[target.id].user.id + '">' + 
							'<i class="fa fa-calendar" aria-hidden="true"></i> ' + target.summary;
						htmlstr += '<div class="current-oncall"><div class="on-call-now"> On Call Now </div>' + oncallLookup[target.id].user.name + '</div>';
					} else {
						htmlstr += '<div class="escalation-recipient ' + target.type + '" ' + 'id="' + target.id + '">';
						if ( target.type == "schedule_reference" ) {
							htmlstr += '<i class="fa fa-calendar" aria-hidden="true"></i> ';
						} else {
							htmlstr += '<i class="fa fa-user" aria-hidden="true"></i> ';
						}
						htmlstr += target.summary;
					}
					htmlstr += '</div></li> ';
				});
				htmlstr += '</ul>';
				htmlstr += '</div>'; // escalation-policy-layer-content

				htmlstr += '<div class="escalation-delay-in-minutes escalation-policy-layer-timeout">';
				htmlstr += '<p><i class="fa fa-arrow-down" aria-hidden="true"></i> Escalates after <b>' + rule.escalation_delay_in_minutes + ' minutes</b></p>';
				htmlstr += '</div>';

				htmlstr += '</div>'; // escalation-policy-layer
				htmlstr += '</div>'; // escalation-rule-container
			});
			htmlstr += '</div>' // escalation-rule-list


			htmlstr += '<div class="escalation-policy-layer show-repeats">';
			htmlstr += '<div class="escalation-policy-circle"><i class="fa fa-recycle" aria-hidden="true"></i></div>';
			htmlstr += '<div class="escalation-policy-layer-content">';
			htmlstr += '<p>Repeat <b>' + data.escalation_policy.num_loops + '</b> times if no one acknowledges</p>';
			htmlstr += '</div>';
			htmlstr += '</div>';


			htmlstr += '</div>' // escalation-rules			
			htmlstr += '</div>' // pd-escalation-policy
			htmlstr += '</div>' // escalation-policy-container
			$('#ep').html(htmlstr);
			$('.schedule_reference,.user_reference').click(function() {
				clickedEP($(this));
			});
		}
	}
	
	PDRequest(token, "/escalation_policies/" + $('#service-select option:selected').attr('epid'), "GET", options);
}

function findAnyUser() {
	var options = {
		success: function(data) {
			anyUserID = data.users[0].id;
		}
	}
	PDRequest(token, "/users", "GET", options);
}

function getCalendarFeedURL(calendarID) {
	var options = {
		data: {
			"requester_id": anyUserID
		},
		success: function(data) {
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

				var startdate = new Date(event.startDate.toUnixTime() * 1000);
				var enddate = new Date(event.endDate.toUnixTime() * 1000);

				events.push({
					title: title,
					start: startdate,
					end: enddate,
					color: peopleColors[title],
					weburl: event._firstProp("attendee")
				});
			});

			var headline = `<h2 style="background-color: #f0f0f0">${calName}</h2>`;
			$('#cal-title').html(headline);

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
	var options = {
		data: {
			"query": email
		},
		success: function(data) {
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
			var htmlstr = '';
			if ( data.user.avatar_url ) {
				htmlstr += '<img src="' + data.user.avatar_url + '"><br>';
			}
			htmlstr += "<h2>" + name + "</h2>";
			if ( title ) { htmlstr += "<h4>" + title + "</h4>"; }
			htmlstr += "<p><b>High-urgency notification rules:</b></p>"
			data.user.notification_rules.forEach(function(rule) {
				if (rule.urgency === "high") {
					var address = rule.contact_method.address;
					if ( rule.contact_method.type == "phone_contact_method" || rule.contact_method.type == "sms_contact_method") {
						address = libphonenumber.format("+" + rule.contact_method.country_code + address, "US", "International");
						var scheme = rule.contact_method.type == "phone_contact_method" ? 'tel:' : 'sms:';
						address = '<a href="' + scheme + address + '">' + address + '</a>';
					} else if ( rule.contact_method.type == "email_contact_method" ) {
						address = '<a href="mailto:' + address + '">' + address + '</a>';
					} else if ( rule.contact_method.type == "push_notification_contact_method" ) {
						address = rule.contact_method.summary;
					}
					htmlstr += "After " + rule.start_delay_in_minutes + " minutes: " + contactMethodTypes[rule.contact_method.type] + ": " + address + "<br>";
				}
			});
			
			htmlstr += "<p> </p><p><b>All contact methods:</b></p>"

			data.user.contact_methods.forEach(function(method) {
				var address = method.address;
				if ( method.type == "phone_contact_method" || method.type == "sms_contact_method") {
					address = libphonenumber.format("+" + method.country_code + address, "US", "International");
					var scheme = method.type == "phone_contact_method" ? 'tel:' : 'sms:';
					address = '<a href="' + scheme + address + '">' + address + '</a>';
				} else if ( method.type == "email_contact_method" ) {
					address = '<a href="mailto:' + address + '">' + address + '</a>';
				} else if ( method.type == "push_notification_contact_method" ) {
					address = method.summary;
				}
				htmlstr += contactMethodTypes[method.type] + ": " + address + "<br>";
			});

			$('#contact').html(htmlstr);
		}
	}
	
	PDRequest(token, "/users/" + userID, "GET", options);
}

function clickedEP(element) {
	if ( element.hasClass('user_reference')) {
		showUser(element.attr('id'))
	} else if ( element.hasClass('schedule_reference')) {
		getCalendarFeedURL(element.attr('id'));
		if ( element.attr('userid') ) {
			showUser(element.attr('userid'));
		}
	}
}

function main() {
	if ( getParameterByName("token") ) {
		token = getParameterByName("token");
	}
	
	$('#service-select').change(function() {
		localStorage.setItem("service-select-selected", $('#service-select').val());
		populateEPDetails();
	});

	$('#user-select').change(function() {
		populateUserDetails();
		showUser($('#user-select').val())
	})

	populateServiceSelect();
	populateUserSelect();
	findAnyUser();

}


$(document).ready(main);
